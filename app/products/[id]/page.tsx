import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { AwardBadge } from '@/components/AwardBadge';
import { ScoreBar } from '@/components/ScoreBar';
import { ProductImage } from '@/components/ProductImage';
import { CATEGORY_LABELS } from '@/lib/constants';
import type { Product } from '@/lib/types';

type Params = { id: string };

export async function generateMetadata(
  { params }: { params: Promise<Params> }
): Promise<Metadata> {
  const { id } = await params;

  const { data } = await supabase
    .from('products')
    .select('name, brand, category, summary')
    .eq('id', id)
    .single();

  const product = data as { name: string; brand: string; category: string; summary?: string | null } | null;
  if (!product) return { title: 'Product Not Found' };
  const cat = CATEGORY_LABELS[product.category] ?? product.category;
  return {
    title: `${product.name} by ${product.brand} — ${cat} BIFL Review`,
    description: product.summary?.slice(0, 155) ?? `Buy It For Life review of ${product.name} by ${product.brand}. Scored on build quality, longevity, repairability, value, and India availability.`,
    openGraph: {
      title: `${product.name} — BIFL365`,
      description: product.summary?.slice(0, 155) ?? '',
      type: 'article',
    },
  };
}

async function getProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error loading product detail', { id, error });
    return null;
  }

  if (!data) {
    return null;
  }

  return data as Product;
}

export default async function ProductDetailPage(
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) notFound();

  const totalScore = product.scores
    ? Object.values(product.scores).reduce((a, b) => a + b, 0)
    : null;

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

  const specs = product.specs;

  // Build all spec tiles in priority order
  const specTiles = [
    { label: 'Lifespan', value: lifespanText, highlight: true },
    specs?.warranty ? { label: 'Warranty', value: specs.warranty, highlight: true } : null,
    specs?.repairability_score != null ? { label: 'Repair Score', value: `${specs.repairability_score}/10`, highlight: false } : null,
    specs?.material ? { label: 'Material', value: specs.material, highlight: false } : null,
    specs?.made_in ? { label: 'Made In', value: specs.made_in, highlight: false } : null,
    specs?.weight ? { label: 'Weight', value: specs.weight, highlight: false } : null,
  ].filter(Boolean) as { label: string; value: string; highlight: boolean }[];

  // JSON-LD Product schema for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    brand: { '@type': 'Brand', name: product.brand },
    description: product.summary ?? undefined,
    image: product.image_url ?? undefined,
    offers: product.price_inr ? {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: product.price_inr,
      availability: 'https://schema.org/InStock',
    } : undefined,
    aggregateRating: totalScore ? {
      '@type': 'AggregateRating',
      ratingValue: totalScore,
      bestRating: 100,
      worstRating: 0,
      ratingCount: 1,
    } : undefined,
  };

  return (
    <div className="bg-paper min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb header */}
      <div className="border-b border-charcoal bg-charcoal text-paper">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Link href="/products" className="text-charcoal-400 text-xs font-sans uppercase tracking-widest hover:text-orange transition-colors">
            ← All Products
          </Link>
          <div className="flex flex-wrap items-start gap-4 justify-between mt-3">
            <div>
              <p className="text-xs font-sans text-charcoal-400 uppercase tracking-widest mb-1">
                {CATEGORY_LABELS[product.category] ?? product.category} · {product.brand}
              </p>
              <h1 className="font-serif font-black text-4xl md:text-5xl text-paper leading-tight">
                {product.name}
              </h1>
            </div>
            {product.award_type && <AwardBadge type={product.award_type} size="lg" />}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">

          {/* Main content */}
          <div className="md:col-span-3 space-y-7">
            {/* Image */}
            {product.image_url && (
              <div className="relative h-72 border border-charcoal bg-white overflow-hidden" style={{ boxShadow: '3px 3px 0px 0px #121212' }}>
                <ProductImage src={product.image_url} alt={product.name} />
              </div>
            )}

            {/* Specs at a glance — full priority list */}
            {specTiles.length > 0 && (
              <div>
                <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-charcoal-400 mb-3">Specs at a Glance</p>
                <div className="border border-charcoal bg-paper-dark" style={{ boxShadow: '2px 2px 0px 0px #121212' }}>
                  <div className="flex flex-wrap divide-x divide-charcoal">
                    {specTiles.map(({ label, value, highlight }) => (
                      <div key={label} className="flex flex-col px-4 py-3 min-w-[100px]">
                        <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-charcoal-400 mb-0.5">{label}</span>
                        <span className={`text-sm font-sans font-bold ${highlight ? 'text-orange' : 'text-ink'}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* BIFL Score breakdown */}
            {product.scores && (
              <div className="border border-charcoal p-5" style={{ boxShadow: '2px 2px 0px 0px #121212' }}>
                <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-charcoal-400 mb-4">Score Breakdown</p>
                <ScoreBar scores={product.scores} totalScore={totalScore ?? undefined} />
              </div>
            )}

            {/* Editorial analysis */}
            {product.summary && (
              <div className="border-l-4 border-orange pl-5 py-1">
                <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-charcoal-400 mb-2">Editorial Analysis</p>
                <p className="text-sm font-sans text-ink leading-relaxed">{product.summary}</p>
              </div>
            )}

            {/* Community verdict */}
            {product.reddit_sentiment && (
              <div className="border border-charcoal p-5 bg-paper-dark">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-orange" />
                  <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-charcoal-400">Community Verdict</p>
                </div>
                <p className="text-sm font-sans text-ink leading-relaxed italic">&quot;{product.reddit_sentiment}&quot;</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="md:col-span-2">
            <div
              className="border border-charcoal p-5 md:sticky md:top-20 space-y-5"
              style={{ boxShadow: '3px 3px 0px 0px #121212' }}
            >
              {/* Price */}
              {product.price_inr && (
                <div>
                  <p className="font-serif font-black text-4xl text-ink">
                    ₹{product.price_inr.toLocaleString('en-IN')}
                  </p>
                  {product.price_usd && (
                    <p className="text-xs font-sans text-charcoal-400 mt-0.5">${product.price_usd} USD approx.</p>
                  )}
                </div>
              )}

              {/* BIFL Score */}
              {totalScore && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-charcoal-400">BIFL Score</span>
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
              {product.affiliate_links && product.affiliate_links.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-charcoal-400">Where to Buy</p>
                  {product.affiliate_links.map((link, idx) => (
                    <a
                      key={`${link.store}-${idx}`}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block w-full text-center text-sm py-2.5 px-4 font-sans font-bold transition-colors ${
                        idx === 0
                          ? 'bg-orange text-paper hover:bg-orange/90'
                          : 'border border-charcoal text-ink hover:bg-charcoal hover:text-paper'
                      }`}
                    >
                      Buy on {link.store} ↗
                    </a>
                  ))}
                </div>
              )}

              {/* Award */}
              {product.award_type && (
                <div className="pt-2 border-t border-ghost">
                  <AwardBadge type={product.award_type} size="sm" />
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
