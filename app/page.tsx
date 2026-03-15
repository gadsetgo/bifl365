import type { Metadata } from 'next';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ProductCard } from '@/components/ProductCard';
import { AwardStamp } from '@/components/AwardBadge';
import { CategoryStrip } from '@/components/CategoryStrip';
import { CATEGORIES } from '@/lib/constants';
import type { Product } from '@/lib/types';

export const metadata: Metadata = {
  title: 'BIFL365 — Products Built to Last a Lifetime',
  description:
    'Weekly AI-curated Buy It For Life product awards for Indian buyers. Scored on build quality, longevity, repairability, value and India availability.',
};

async function getFeaturedProduct(): Promise<Product | null> {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('is_featured', true)
    .eq('status', 'published')
    .order('week_of', { ascending: false })
    .limit(1)
    .single();
  return data ?? null;
}

async function getRecentProducts(): Promise<Product[]> {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('is_featured', false)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(6);
  return data ?? [];
}

export default async function HomePage() {
  const [featured, recent] = await Promise.all([getFeaturedProduct(), getRecentProducts()]);

  return (
    <div className="bg-paper min-h-screen">
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

            {/* Right: Why BIFL? benefit block */}
            <div className="border border-charcoal-600 bg-charcoal-700 divide-y divide-charcoal-600">
              {[
                { icon: '⏳', label: 'Built to Last a Lifetime', desc: 'Not "premium" — actually built to outlive trends, owners, and regret.' },
                { icon: '🇮🇳', label: 'Scored for India', desc: 'Every pick is weighed on local availability, price-to-durability, and repairability in Indian cities.' },
                { icon: '🔧', label: 'Repairability Rated', desc: 'A product you can fix is worth ten you cannot. We score this explicitly.' },
                { icon: '🏆', label: 'Three Award Tiers', desc: 'Best Buy, Forever Pick, and Hidden Gem — every week, with no paid placements.' },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="flex items-start gap-4 px-5 py-4">
                  <span className="text-xl mt-0.5">{icon}</span>
                  <div>
                    <p className="text-xs font-sans font-bold text-paper uppercase tracking-wider">{label}</p>
                    <p className="text-xs font-sans text-charcoal-400 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── AWARD TYPES ── */}
      <section className="border-b border-charcoal">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-baseline gap-4 mb-8">
            <h2 className="font-serif font-bold text-2xl text-ink">Three Tiers of Excellence</h2>
            <div className="flex-1 h-px bg-charcoal" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AwardStamp type="best_buy" />
            <AwardStamp type="forever_pick" />
            <AwardStamp type="hidden_gem" />
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
                href={`/category/${value}`}
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
              <h2 className="font-serif font-bold text-2xl text-ink">Recent Awards</h2>
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
          </div>
        </section>
      )}

      {/* ── MANIFESTO STRIP ── */}
      <section className="border-t border-charcoal bg-orange-pale">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="font-serif font-bold text-xl text-ink max-w-lg">
              &quot;The best purchase you ever make is the one you never have to make again.&quot;
            </p>
            <Link href="/products" className="btn-primary shrink-0">
              See All BIFL Products ↗
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
