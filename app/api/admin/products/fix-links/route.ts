import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabase } from '@/lib/supabase';
import { AFFILIATE_TAG } from '@/lib/constants';

interface AffLink {
  store: string;
  url: string;
  is_affiliate: boolean;
}

function sanitizeLinks(links: AffLink[]): { sanitized: AffLink[]; searchRemoved: number } {
  let searchRemoved = 0;

  const filtered = links.filter((link) => {
    if (link.url.includes('/s?k=') || link.url.includes('/search?q=')) {
      searchRemoved++;
      return false;
    }
    return true;
  });

  const sanitized = filtered.map((link) => {
    try {
      const parsed = new URL(link.url);
      const host = parsed.hostname.toLowerCase();
      if (host.includes('amazon.in') || host.includes('amazon.com')) {
        parsed.searchParams.set('tag', AFFILIATE_TAG);
        return { ...link, url: parsed.toString(), is_affiliate: true };
      }
    } catch {
      // Invalid URL — keep as-is
    }
    return link;
  });

  return { sanitized, searchRemoved };
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
  let totalSearchRemoved = 0;

  for (const product of products) {
    const links: AffLink[] = product.affiliate_links ?? [];
    if (links.length === 0) { unchanged++; continue; }

    const { sanitized, searchRemoved } = sanitizeLinks(links);
    totalSearchRemoved += searchRemoved;

    const changed = JSON.stringify(sanitized) !== JSON.stringify(links);
    if (!changed) { unchanged++; continue; }

    await (supabase
      .from('products') as any)
      .update({ affiliate_links: sanitized })
      .eq('id', product.id);

    fixed++;
  }

  return NextResponse.json({ fixed, unchanged, searchUrlsRemoved: totalSearchRemoved });
}
