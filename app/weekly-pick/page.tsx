import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { AwardBadge } from '@/components/AwardBadge';
import { ScoreBar } from '@/components/ScoreBar';
import { ProductImage } from '@/components/ProductImage';
import type { Product } from '@/lib/types';

export const metadata: Metadata = {
  title: "This Week's Pick",
  description: "BIFL365 featured product this week — full AI score breakdown, specs analysis, Reddit sentiment, and buy links.",
};

import { CATEGORY_LABELS } from '@/lib/constants';

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

export default async function WeeklyPickPage() {
  const product = await getFeaturedProduct();

  if (!product) {
    return (
      <div className="bg-paper min-h-screen">
        <div className="border-b border-charcoal bg-charcoal text-paper">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <span className="section-label text-charcoal-400 block mb-2">Weekly Pick</span>
            <h1 className="font-serif font-black text-4xl text-paper">This Week&apos;s Featured Pick</h1>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="border border-charcoal p-12 inline-block" style={{ boxShadow: '3px 3px 0px 0px #121212' }}>
            <p className="font-serif font-bold text-2xl text-ink mb-2">No Pick This Week Yet</p>
            <p className="text-xs font-sans text-charcoal-400">Run <code className="bg-paper-dark border border-ghost px-1">npm run pipeline</code> to generate this week&apos;s product.</p>
          </div>
        </div>
      </div>
    );
  }

  const totalScore = product.scores
    ? Object.values(product.scores).reduce((a, b) => a + b, 0)
    : null;

  const specs = product.specs;

  // JSON-LD Schema
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.image_url ?? '',
    description: product.summary ?? '',
    brand: {
      '@type': 'Brand',
      name: product.brand,
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: product.price_inr ?? 0,
      availability: 'https://schema.org/InStock',
    },
  };

  // Build the Lifespan text
  let lifespanText = 'Built to Last';
  if (product.estimated_lifespan_years) {
    lifespanText = `${product.estimated_lifespan_years} Years`;
    if (product.estimated_lifespan_multiplier) {
      lifespanText += ` (${product.estimated_lifespan_multiplier}× avg)`;
    }
  } else if (product.estimated_lifespan_multiplier) {
    lifespanText = `${product.estimated_lifespan_multiplier}× industry average`;
  }

  // Build all spec tiles in priority order
  const specTiles = [
    { label: 'Lifespan', value: lifespanText, highlight: true },
    specs?.warranty ? { label: 'Warranty', value: specs.warranty, highlight: true } : null,
    specs?.repairability_score != null ? { label: 'Repair Score', value: `${specs.repairability_score}/10`, highlight: false } : null,
    specs?.material ? { label: 'Material', value: specs.material, highlight: false } : null,
    specs?.made_in ? { label: 'Made In', value: specs.made_in, highlight: false } : null,
    specs?.weight ? { label: 'Weight', value: specs.weight, highlight: false } : null,
  ].filter((tile): tile is { label: string; value: string; highlight: boolean } => tile !== null);

  return (
    <div className="bg-paper min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Header band */}
      <div className="border-b border-charcoal bg-charcoal text-paper">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-orange flex-shrink-0" />
            <span className="section-label text-charcoal-400">
              {product.week_of
                ? `Week of ${new Date(product.week_of).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}`
                : 'Weekly Pick'}
            </span>
          </div>
          <div className="flex flex-wrap items-start gap-4 justify-between">
            <div>
              <p className="section-label text-charcoal-400 mb-1">{CATEGORY_LABELS[product.category] ?? product.category} · {product.brand}</p>
              <h1 className="font-serif font-black text-4xl md:text-5xl text-paper leading-tight">
                {product.name}
              </h1>
            </div>
            {product.award_type && <AwardBadge type={product.award_type} size="lg" />}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* ── MAIN CONTENT ── */}
          <div className="md:col-span-3 space-y-6">

            {/* Specs At A Glance */}
            {specTiles.length > 0 && (
              <div>
                <p className="section-label mb-3">Specs At A Glance</p>
                <div className="border border-gray-200 rounded-xl divide-x divide-gray-100 flex overflow-x-auto scrollbar-hide shadow-sm bg-white">
                  {specTiles.map((tile, i) => (
                    <div key={i} className={`flex flex-col px-5 py-4 min-w-max ${tile.highlight ? 'bg-orange-pale/30' : ''}`}>
                      <span className="section-label mb-1">{tile.label}</span>
                      <span className={`text-sm font-sans ${tile.highlight ? 'font-bold text-orange' : 'font-semibold text-ink'}`}>
                        {tile.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Score Breakdown */}
            {product.scores && (
              <div className="border border-gray-200 rounded-xl p-6 shadow-sm bg-white">
                <p className="section-label mb-4">Score Breakdown</p>
                <ScoreBar scores={product.scores} totalScore={totalScore ?? undefined} />
              </div>
            )}

            {/* AI Summary */}
            {product.summary && (
              <div className="border-l-4 border-orange pl-5 py-1">
                <p className="section-label mb-2">AI Analysis</p>
                <p className="text-sm font-sans text-ink leading-relaxed">{product.summary}</p>
              </div>
            )}

            {/* Reddit Sentiment */}
            {product.reddit_sentiment && (
              <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 bg-orange rounded-full" />
                  <p className="section-label">Reddit Sentiment</p>
                </div>
                <p className="text-sm font-sans text-charcoal-600 leading-relaxed">{product.reddit_sentiment}</p>
              </div>
            )}
          </div>

          {/* ── SIDEBAR ── */}
          <aside className="md:col-span-2 space-y-6">
            {/* Image */}
            {product.image_url && (
              <div className="relative h-80 rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-card">
                <ProductImage src={product.image_url} alt={product.name} />
              </div>
            )}
            <div
              className="rounded-2xl border border-gray-100 p-6 sticky top-20 bg-white shadow-card"
            >
              {/* Price */}
              {product.price_inr && (
                <p className="font-serif font-black text-4xl text-ink">
                  ₹{product.price_inr.toLocaleString('en-IN')}
                </p>
              )}
              {product.price_usd && (
                <p className="text-xs font-sans text-charcoal-400 mt-0.5 mb-4">${product.price_usd} USD</p>
              )}

              {/* Score bar */}
              {product.scores && totalScore && (
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="section-label">BIFL Score</span>
                    <span className="font-serif font-bold text-lg text-ink">{totalScore}/100</span>
                  </div>
                  <div className="h-2 border border-charcoal bg-ghost overflow-hidden">
                    <div
                      className="h-full bg-orange transition-all duration-700"
                      style={{ width: `${totalScore}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Affiliate buy links */}
              {(() => {
                const links = [...(product.affiliate_links ?? [])];
                if (links.length === 0) {
                  if (product.affiliate_url_amazon) links.push({ store: 'Amazon', url: product.affiliate_url_amazon, is_affiliate: false });
                  if (product.affiliate_url_flipkart) links.push({ store: 'Flipkart', url: product.affiliate_url_flipkart, is_affiliate: false });
                }
                if (links.length === 0) return null;
                return (
                  <div className="space-y-2 mt-5">
                    <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-charcoal-400">Where to Buy</p>
                    {links.map((link, idx) => (
                    <a
                      key={`${link.store}-${idx}`}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block w-full text-center text-sm py-3 px-4 font-sans font-bold transition-all rounded-lg ${
                        idx === 0
                          ? 'bg-orange text-white hover:bg-orange/90 shadow-[0_4px_14px_0_rgba(255,87,51,0.39)] hover:shadow-[0_6px_20px_0_rgba(255,87,51,0.23)] hover:-translate-y-0.5'
                          : 'border border-gray-200 text-charcoal-700 hover:bg-gray-50'
                      }`}
                    >
                      Buy on {link.store} ↗
                    </a>
                  ))}
                </div>
                );
              })()}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
