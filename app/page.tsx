import type { Metadata } from 'next';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ProductCard } from '@/components/ProductCard';
import { AwardStamp } from '@/components/AwardBadge';
import { CategoryStrip } from '@/components/CategoryStrip';
import { CATEGORIES } from '@/lib/constants';
import type { Product } from '@/lib/types';
import { LoadMoreProducts } from '@/components/LoadMoreProducts';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'BIFL365 — Products Built to Last a Lifetime',
  description:
    'Weekly AI-curated Buy It For Life product awards for Indian buyers. Scored on build quality, longevity, repairability, value and India availability.',
};

async function getFeaturedProduct(): Promise<Product | null> {
  // Check for admin override first (featured_until in the future)
  const now = new Date().toISOString();
  const { data: override } = await supabase
    .from('products')
    .select('*')
    .gt('featured_until', now)
    .eq('status', 'published')
    .order('featured_until', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (override) return override as Product;

  // Fallback to regular is_featured
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('is_featured', true)
    .eq('status', 'published')
    .order('week_of', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as Product) ?? null;
}

async function getForeverPicks(): Promise<Product[]> {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('award_type', 'forever_pick')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(6);
  const picks = (data ?? []) as Product[];
  // If not enough forever picks, fill with other published products
  if (picks.length < 6) {
    const ids = picks.map(p => p.id);
    const { data: more } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'published')
      .not('id', 'in', `(${ids.join(',')})`)
      .order('created_at', { ascending: false })
      .limit(6 - picks.length);
    return [...picks, ...((more ?? []) as Product[])];
  }
  return picks;
}

export default async function HomePage() {
  const [featured, recent] = await Promise.all([getFeaturedProduct(), getForeverPicks()]);

  return (
    <div className="bg-paper min-h-screen">
      {/* ── MANIFESTO STRIP ── */}
      <section className="border-b border-charcoal bg-orange-pale">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <p className="font-serif font-bold text-lg md:text-xl text-ink text-center">
            &quot;The best purchase you ever make is the one you never have to make again.&quot;
          </p>
        </div>
      </section>

      {/* ── HERO ── */}
      <section className="border-b border-charcoal bg-charcoal text-paper">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Left: copy */}
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-2 h-2 bg-orange" />
                <span className="section-label text-charcoal-200">Weekly AI-Curated Awards · India</span>
              </div>
              <h1 className="font-serif font-black text-5xl md:text-6xl text-paper leading-[1.05] mb-6">
                Products<br />
                Built to Last<br />
                <span className="text-orange">a Lifetime.</span>
              </h1>
              <p className="text-sm font-sans text-charcoal-200 leading-relaxed max-w-md mb-8">
                Every week, our AI pipeline surfaces the best BIFL products for Indian buyers — scored on build quality, longevity, repairability, value, and local availability.
              </p>
              <div className="flex gap-3 flex-wrap">
                <Link href="/products" id="hero-browse-btn" className="btn-primary">
                  Browse All Products ↗
                </Link>
                <Link href="/weekly-pick" id="hero-weekly-btn" className="btn-ghost border-paper text-paper hover:bg-paper hover:text-ink">
                  This Week&apos;s Pick
                </Link>
              </div>
            </div>

            {/* Right: Awards Showcase */}
            <div className="grid grid-cols-2 gap-4">
              <Link href="/products?award=value_buy" className="block h-full">
                <div className="h-full"><AwardStamp type="value_buy" /></div>
              </Link>
              <Link href="/products?award=current_star" className="block h-full">
                <div className="h-full"><AwardStamp type="current_star" /></div>
              </Link>
              <Link href="/products?award=forever_pick" className="block h-full">
                <div className="h-full"><AwardStamp type="forever_pick" /></div>
              </Link>
              <Link href="/products?award=hidden_gem" className="block h-full">
                <div className="h-full"><AwardStamp type="hidden_gem" /></div>
              </Link>
            </div>
          </div>
        </div>
      </section>



      {/* ── FEATURED PRODUCT ── */}
      {featured && (
        <section className="border-b border-charcoal">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-baseline gap-4 mb-8">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange" />
                <span className="section-label">This Week&apos;s Featured Pick</span>
              </div>
              <div className="flex-1 h-px bg-charcoal" />
              <Link href="/weekly-pick" className="section-label hover:text-orange transition-colors">
                Full breakdown →
              </Link>
            </div>
            <ProductCard product={featured} featured />
          </div>
        </section>
      )}

      {/* ── CATEGORY BAR ── */}
      <section className="border-b border-charcoal">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-baseline gap-4 mb-6">
            <h2 className="font-serif font-bold text-2xl text-ink">Browse by Category</h2>
            <div className="flex-1 h-px bg-charcoal" />
          </div>

          {/* Category grid with viral hooks */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {CATEGORIES.filter((c) => c.value !== 'all').map(({ value, label, hook }) => (
              <Link
                key={value}
                href={`/products?category=${value}`}
                id={`homepage-cat-${value}`}
                className="border border-charcoal bg-paper p-4 hover:bg-charcoal hover:text-paper transition-all duration-150 group"
                style={{ boxShadow: '2px 2px 0px 0px #121212' }}
              >
                <p className="font-serif font-bold text-base mb-1 group-hover:text-paper transition-colors">{label}</p>
                <p className="text-2xs font-sans text-charcoal-400 group-hover:text-charcoal-200 italic transition-colors">
                  &quot;{hook}&quot;
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── RECENT PRODUCTS ── */}
      {recent.length > 0 && (
        <section>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-baseline gap-4 mb-8">
              <h2 className="font-serif font-bold text-2xl text-ink">Forever Picks</h2>
              <div className="flex-1 h-px bg-charcoal" />
              <Link href="/products" className="section-label hover:text-orange transition-colors">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {recent.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            <LoadMoreProducts initialOffset={recent.length} />
          </div>
        </section>
      )}

    </div>
  );
}
