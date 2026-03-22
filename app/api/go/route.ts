import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { createServerSupabaseClient } from '@/lib/supabase';

const ALLOWED_HOSTNAMES = new Set([
  'amazon.in',
  'amazon.com',
  'flipkart.com',
  'meesho.com',
]);

const paramsSchema = z.object({
  product_id: z.string().uuid(),
  store: z.string().min(1).max(50),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = paramsSchema.safeParse({
    product_id: searchParams.get('product_id'),
    store: searchParams.get('store'),
  });

  if (!parsed.success) {
    return new NextResponse('Invalid parameters', { status: 400 });
  }

  const { product_id, store } = parsed.data;

  // Fetch product affiliate links (anon client — products table is public)
  const { data: product } = await supabase
    .from('products')
    .select('affiliate_links, affiliate_url_amazon, affiliate_url_flipkart')
    .eq('id', product_id)
    .eq('status', 'published')
    .maybeSingle();

  if (!product) {
    return new NextResponse('Product not found', { status: 404 });
  }

  const links: { store: string; url: string }[] = [...((product as any).affiliate_links ?? [])];
  if (links.length === 0) {
    if ((product as any).affiliate_url_amazon) links.push({ store: 'Amazon', url: (product as any).affiliate_url_amazon });
    if ((product as any).affiliate_url_flipkart) links.push({ store: 'Flipkart', url: (product as any).affiliate_url_flipkart });
  }

  const match = links.find((l) => l.store.toLowerCase() === store.toLowerCase());
  if (!match) {
    return new NextResponse('Store link not found', { status: 404 });
  }

  // Open redirect guard — only allow known affiliate hostnames
  let targetUrl: URL;
  try {
    targetUrl = new URL(match.url);
  } catch {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  const hostname = targetUrl.hostname.replace(/^www\./, '');
  if (!ALLOWED_HOSTNAMES.has(hostname)) {
    return new NextResponse('Redirect target not allowed', { status: 403 });
  }

  // Rate limit: max 10 clicks per product per hour
  const serviceClient = createServerSupabaseClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await serviceClient
    .from('affiliate_clicks')
    .select('*', { count: 'exact', head: true })
    .eq('product_id', product_id)
    .gte('clicked_at', oneHourAgo);

  if ((count ?? 0) >= 10) {
    return new NextResponse('Rate limit exceeded', { status: 429 });
  }

  // Record click (no IP stored)
  await serviceClient.from('affiliate_clicks').insert({
    product_id,
    store,
    referrer: request.headers.get('referer'),
    user_agent: request.headers.get('user-agent'),
  } as never);

  return NextResponse.redirect(match.url, { status: 302 });
}
