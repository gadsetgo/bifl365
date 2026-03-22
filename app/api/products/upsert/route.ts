import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import type { ProductInsert } from '@/lib/types';
import { extractCanonicalKey } from '@/lib/dedup';

export async function POST(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get('Authorization');
  const expectedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let products: ProductInsert[];
  try {
    products = await request.json();
    if (!Array.isArray(products)) throw new Error('Expected array');
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body — expected array' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const results = await Promise.allSettled(
    products.map(async (product) => {
      // 1. Exact case-insensitive match
      const { data: existing } = await supabase
        .from('products')
        .select('id, name')
        .ilike('name', product.name)
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('products')
          .update(product as never)
          .eq('id', (existing as any).id)
          .select('id, name')
          .single();
        if (error) throw error;
        return data;
      }

      // 2. Fuzzy match via pg_trgm
      const { data: similar } = await (supabase.rpc as any)('find_similar_products', {
        target_name: product.name,
        similarity_threshold: 0.4,
        max_results: 5,
      });

      const newKey = extractCanonicalKey(product.name, product.brand);
      const matches = (similar ?? []) as { id: string; name: string; brand: string; similarity: number }[];

      // 3. Canonical key match → auto-merge
      const keyMatch = matches.find(s => extractCanonicalKey(s.name, s.brand) === newKey);
      if (keyMatch) {
        const { data, error } = await supabase
          .from('products')
          .update(product as never)
          .eq('id', keyMatch.id)
          .select('id, name')
          .single();
        if (error) throw error;
        return data;
      }

      // 4. High similarity but different key → flag for review
      const highSim = matches.find(s => s.similarity > 0.7);
      if (highSim) {
        (product as any).admin_notes = `Possible duplicate of: ${highSim.name} (similarity: ${highSim.similarity.toFixed(2)})`;
        (product as any).pipeline_status = 'pending_review';
      }

      // 5. Insert as new
      const { data, error } = await supabase
        .from('products')
        .insert(product as never)
        .select('id, name')
        .single();
      if (error) throw error;
      return data;
    })
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results
    .filter((r) => r.status === 'rejected')
    .map((r, i) => ({ index: i, error: (r as PromiseRejectedResult).reason?.message }));

  return NextResponse.json({ succeeded, failed, total: products.length });
}
