import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabase } from '@/lib/supabase';
import { sanitizeAndValidateLinks } from '@/lib/link-validator';

interface AffLink {
  store: string;
  url: string;
  is_affiliate: boolean;
}

export async function POST() {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const { data, error } = await supabase
    .from('products')
    .select('id, affiliate_links')
    .not('affiliate_links', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const products = (data ?? []) as { id: string; affiliate_links: AffLink[] | null }[];

  let fixed = 0;
  let unchanged = 0;
  let totalRemoved = 0;

  for (const product of products) {
    const links: AffLink[] = product.affiliate_links ?? [];
    if (links.length === 0) { unchanged++; continue; }

    const { sanitized, removed } = sanitizeAndValidateLinks(links);
    totalRemoved += removed;

    const changed = JSON.stringify(sanitized) !== JSON.stringify(links);
    if (!changed) { unchanged++; continue; }

    await (supabase
      .from('products') as any)
      .update({ affiliate_links: sanitized })
      .eq('id', product.id);

    fixed++;
  }

  return NextResponse.json({ fixed, unchanged, brokenLinksRemoved: totalRemoved });
}
