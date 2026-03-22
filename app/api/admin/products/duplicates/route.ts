import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { supabase } from '@/lib/supabase';
import { extractCanonicalKey } from '@/lib/dedup';
import { deleteProductImages } from '@/lib/storage';
import type { AffiliateLink } from '@/lib/types';

interface ClusterProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  pipeline_status: string | null;
  status: string;
  created_at: string;
  affiliate_links: AffiliateLink[] | null;
}

interface Cluster {
  canonical_key: string;
  similarity: number;
  products: ClusterProduct[];
}

/**
 * GET: Find duplicate product clusters using pg_trgm similarity + canonical key matching
 */
export async function GET() {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const { data } = await supabase
    .from('products')
    .select('id, name, brand, category, pipeline_status, status, created_at, affiliate_links')
    .order('created_at', { ascending: false });

  const products = (data ?? []) as ClusterProduct[];
  const clusters: Cluster[] = [];
  const assigned = new Set<string>();

  for (const product of products) {
    if (assigned.has(product.id)) continue;

    // Find similar products via RPC
    const { data: similar } = await (supabase.rpc as any)('find_similar_products', {
      target_name: product.name,
      similarity_threshold: 0.5,
      max_results: 10,
      exclude_id: product.id,
    });

    const matches = (similar ?? []) as { id: string; name: string; brand: string; category: string; similarity: number }[];
    if (matches.length === 0) continue;

    const myKey = extractCanonicalKey(product.name, product.brand);
    const dupes = matches.filter(m => {
      if (assigned.has(m.id)) return false;
      const theirKey = extractCanonicalKey(m.name, m.brand);
      // Same canonical key or very high similarity
      return myKey === theirKey || m.similarity > 0.75;
    });

    if (dupes.length === 0) continue;

    const clusterProducts = [product, ...dupes.map(d => products.find(p => p.id === d.id)!).filter(Boolean)];
    const maxSimilarity = Math.max(...dupes.map(d => d.similarity));

    clusters.push({
      canonical_key: myKey,
      similarity: maxSimilarity,
      products: clusterProducts,
    });

    for (const cp of clusterProducts) assigned.add(cp.id);
  }

  clusters.sort((a, b) => b.similarity - a.similarity);

  return NextResponse.json({ clusters, total: clusters.length });
}

const mergeSchema = z.object({
  keep_id: z.string().uuid(),
  remove_ids: z.array(z.string().uuid()).min(1),
});

/**
 * POST: Merge duplicate products — keep one, delete the rest
 * Transfers unique affiliate links from removed products to the kept one
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const raw = await request.json();
  const parsed = mergeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.issues }, { status: 400 });
  }

  const { keep_id, remove_ids } = parsed.data;

  // Fetch all products involved
  const { data: products } = await supabase
    .from('products')
    .select('id, affiliate_links')
    .in('id', [keep_id, ...remove_ids]);

  const all = (products ?? []) as { id: string; affiliate_links: AffiliateLink[] | null }[];
  const keeper = all.find(p => p.id === keep_id);

  if (!keeper) {
    return NextResponse.json({ error: 'Product to keep not found' }, { status: 404 });
  }

  // Merge unique affiliate links from removed products into keeper
  const existingUrls = new Set((keeper.affiliate_links ?? []).map(l => l.url));
  const mergedLinks = [...(keeper.affiliate_links ?? [])];

  for (const removedId of remove_ids) {
    const removed = all.find(p => p.id === removedId);
    if (!removed?.affiliate_links) continue;
    for (const link of removed.affiliate_links) {
      if (!existingUrls.has(link.url)) {
        mergedLinks.push(link);
        existingUrls.add(link.url);
      }
    }
  }

  // Update keeper with merged links
  await (supabase.from('products') as any)
    .update({ affiliate_links: mergedLinks })
    .eq('id', keep_id);

  // Delete removed products and their images
  for (const id of remove_ids) {
    await deleteProductImages(id);
    await supabase.from('products').delete().eq('id', id);
  }

  return NextResponse.json({
    kept: keep_id,
    removed: remove_ids.length,
    merged_links: mergedLinks.length,
  });
}
