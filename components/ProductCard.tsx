'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/lib/types';
import { AwardBadge } from './AwardBadge';
import { ScoreBar } from './ScoreBar';
import { CATEGORY_LABELS } from '@/lib/constants';

interface ProductCardProps {
  product: Product;
  featured?: boolean;
}

/** Core specs are always shown on the card (max 3 tiles). Secondary shown on detail/featured. */
function SpecsBar({ product, featured = false }: { product: Product; featured?: boolean }) {
  const specs = product.specs;
  const lifespan = product.estimated_lifespan_multiplier;

  // Core tier — always shown
  const core = [
    lifespan != null
      ? { label: 'Lifespan', value: `${lifespan}x Avg`, highlight: true }
      : null,
    specs?.warranty
      ? { label: 'Warranty', value: specs.warranty, highlight: true }
      : null,
    specs?.repairability_score != null
      ? { label: 'Repair', value: `${specs.repairability_score}/10`, highlight: false }
      : null,
  ].filter(Boolean) as { label: string; value: string; highlight: boolean }[];

  // Secondary tier — only on featured / detail view
  const secondary = featured ? [
    specs?.material ? { label: 'Material', value: specs.material, highlight: false } : null,
    specs?.made_in ? { label: 'Made In', value: specs.made_in, highlight: false } : null,
    specs?.weight ? { label: 'Weight', value: specs.weight, highlight: false } : null,
  ].filter(Boolean) as { label: string; value: string; highlight: boolean }[] : [];

  const tiles = [...core, ...secondary];
  if (tiles.length === 0) return null;

  return (
    <div className="border border-charcoal bg-paper-dark">
      <div className="flex flex-wrap divide-x divide-charcoal">
        {tiles.map(({ label, value, highlight }) => (
          <div key={label} className="flex flex-col px-3 py-2 min-w-[80px]">
            <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-charcoal-400 mb-0.5">{label}</span>
            <span className={`text-xs font-sans font-bold ${highlight ? 'text-orange' : 'text-ink'}`}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AffiliateButtons({ product }: { product: Product }) {
  const links = [...(product.affiliate_links ?? [])];
  if (links.length === 0) {
    if (product.affiliate_url_amazon) links.push({ store: 'Amazon', url: product.affiliate_url_amazon, is_affiliate: false });
    if (product.affiliate_url_flipkart) links.push({ store: 'Flipkart', url: product.affiliate_url_flipkart, is_affiliate: false });
  }
  if (links.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap">
      {links.map((link, idx) => (
        <button
          key={`${link.store}-${idx}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            window.open(`/api/go?product_id=${product.id}&store=${encodeURIComponent(link.store)}`, '_blank', 'noopener,noreferrer');
          }}
          className={`text-xs py-2 px-3 flex-1 text-center font-sans font-bold transition-colors ${
            idx === 0
              ? 'bg-orange text-paper hover:bg-orange/90'
              : 'border border-charcoal text-ink hover:bg-charcoal hover:text-paper'
          }`}
          style={{ borderRadius: '2px' }}
        >
          {link.store} ↗
        </button>
      ))}
    </div>
  );
}

export function ProductCard({ product, featured = false }: ProductCardProps) {
  const [imgError, setImgError] = useState(false);

  // Formatting strings
  const title = `${product.brand} ${product.name}`;
  const totalScore = product.scores
    ? Object.values(product.scores).reduce((a, b) => a + b, 0)
    : null;

  const cardContent = (
    <article
      className={`
        group relative bg-paper border border-gray-100 rounded-xl overflow-hidden h-full
        transition-all duration-300 shadow-card hover:shadow-card-hover hover:-translate-y-1
        ${featured ? 'md:flex md:flex-row' : 'flex flex-col'}
      `}
    >
      {/* Lifespan Prominent Badge (Top Right) */}
      {product.estimated_lifespan_years && (
        <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur border border-orange/20 text-orange font-sans font-bold text-xs px-3 py-1.5 rounded-full shadow-sm">
          {product.estimated_lifespan_years} Years expected
        </div>
      )}
      {/* Image area */}
      <div
        className={`
          relative overflow-hidden bg-white border-b border-gray-100
          ${featured ? 'md:w-2/5 h-80 md:h-auto md:border-b-0 md:border-r' : 'h-64'}
        `}
      >
        {product.image_url && !imgError ? (
          <Image
            src={`/api/image/${product.id}`}
            alt={title}
            fill
            className="object-contain p-8 group-hover:scale-105 transition-transform duration-500"
            unoptimized
            onError={() => setImgError(true)}
          />
        ) : product.image_url && imgError ? (
          <div className="absolute inset-0 flex items-center justify-center font-serif font-bold text-charcoal-400 text-sm opacity-50">
            {product.brand}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl text-ghost font-serif">?</div>
              <p className="text-2xs text-charcoal-200 font-sans uppercase tracking-widest mt-1">No image</p>
            </div>
          </div>
        )}

        {/* Week badge */}
        {product.is_featured && (
          <div className="absolute top-4 left-4 bg-charcoal text-white text-xs font-sans font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-md">
            This Week
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`flex flex-col ${featured ? 'md:flex-1 p-7' : 'p-5'} gap-4`}>

        {/* Top: Category + Award */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-charcoal-400">
            {CATEGORY_LABELS[product.category] ?? product.category}
          </span>
          {product.award_type && <AwardBadge type={product.award_type} size="sm" />}
        </div>

        {/* Title + Brand */}
        <div>
          <h3 className={`font-serif font-bold text-ink leading-tight ${featured ? 'text-3xl' : 'text-xl'}`}>
            {product.name}
          </h3>
          <p className="text-sm font-sans text-charcoal-400 mt-0.5">{product.brand}</p>
        </div>

        {/* Specs — priority tier */}
        <SpecsBar product={product} featured={featured} />

        {/* Price */}
        <div className="flex items-baseline gap-2 flex-wrap">
          {product.price_inr && (
            <span className={`font-serif font-bold text-ink ${featured ? 'text-3xl' : 'text-2xl'}`}>
              ₹{product.price_inr.toLocaleString('en-IN')}
            </span>
          )}
          {product.price_usd && (
            <span className="text-sm text-charcoal-400 font-sans">${product.price_usd}</span>
          )}
        </div>

        {/* BIFL Score bar */}
        {product.scores && !featured && (
          <ScoreBar scores={product.scores} totalScore={totalScore ?? undefined} compact />
        )}
        {product.scores && featured && (
          <ScoreBar scores={product.scores} totalScore={totalScore ?? undefined} />
        )}

        {/* Summary (featured only) */}
        {product.summary && featured && (
          <p className="text-sm font-sans text-charcoal-400 leading-relaxed border-l-2 border-orange pl-3">
            {product.summary}
          </p>
        )}

        {/* Affiliate buttons — clean, no (No Aff) for end users */}
        <div className="mt-auto pt-1">
          <AffiliateButtons product={product} />
        </div>

        {featured && (
          <span className="section-label text-orange flex items-center gap-1 text-xs">
            Full breakdown + scores →
          </span>
        )}
      </div>
    </article>
  );

  // Wrap entire card as a link to detail page; inner affiliate buttons are <button>, so no nested <a>.
  return (
    <Link
      href={`/products/${product.id}`}
      className="block h-full"
      prefetch={false}
    >
      {cardContent}
    </Link>
  );
}
