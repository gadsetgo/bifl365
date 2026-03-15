'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Product, AffiliateLink } from '@/lib/types';

// Use a plain untyped client so `.update()` accepts any partial shape
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function DraftEditor({ product, onPublish }: { product: Product, onPublish: (id: string) => void }) {
  const [summary, setSummary] = useState(product.summary || '');
  const [imageUrl, setImageUrl] = useState(product.image_url || '');
  const [priceInr, setPriceInr] = useState(product.price_inr?.toString() || '');
  const [lifespanYears, setLifespanYears] = useState(product.estimated_lifespan_years?.toString() || '');
  const [lifespanMultiplier, setLifespanMultiplier] = useState(product.estimated_lifespan_multiplier?.toString() || '');
  const [affiliateLinks, setAffiliateLinks] = useState<AffiliateLink[]>(
    product.affiliate_links ?? []
  );
  const [isPublishing, setIsPublishing] = useState(false);

  function updateLink(index: number, field: keyof AffiliateLink, value: string | boolean) {
    setAffiliateLinks(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  }

  function addLink() {
    setAffiliateLinks(prev => [...prev, { store: '', url: '', is_affiliate: false }]);
  }

  function removeLink(index: number) {
    setAffiliateLinks(prev => prev.filter((_, i) => i !== index));
  }

  async function handlePublish() {
    setIsPublishing(true);
    const { error } = await sb
      .from('products')
      .update({
        summary,
        image_url: imageUrl || null,
        price_inr: parseInt(priceInr) || product.price_inr,
        estimated_lifespan_years: parseInt(lifespanYears) || null,
        estimated_lifespan_multiplier: parseFloat(lifespanMultiplier) || null,
        affiliate_links: affiliateLinks,
        status: 'published'
      })
      .eq('id', product.id);

    if (!error) {
      onPublish(product.id);
    } else {
      console.error(error);
      alert('Failed to publish. Check console.');
    }
    setIsPublishing(false);
  }

  const nonAffiliateCount = affiliateLinks.filter(l => !l.is_affiliate).length;

  return (
    <div className="border border-charcoal bg-paper p-5 mb-5" style={{ boxShadow: '3px 3px 0px 0px #121212' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 pb-4 border-b border-ghost">
        <div>
          <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-charcoal-400">
            [{product.category.toUpperCase()}] {product.award_type?.toUpperCase().replace('_', ' ')}
          </span>
          <h3 className="font-serif font-bold text-xl leading-tight text-ink mt-0.5">
            {product.brand} — {product.name}
          </h3>
        </div>
        {nonAffiliateCount > 0 && (
          <span className="bg-orange/10 text-orange border border-orange/30 text-[10px] font-bold uppercase tracking-widest px-2 py-1 shrink-0">
            {nonAffiliateCount} Link{nonAffiliateCount > 1 ? 's' : ''} Need Affiliate URL
          </span>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Col */}
        <div className="md:w-1/3 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-charcoal-400 block">Image URL</label>
            <input
              type="text"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="Paste direct image link..."
              className="w-full border border-charcoal bg-paper-dark p-2 text-sm font-sans text-ink focus:outline-none focus:border-orange"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-charcoal-400 block">Price (INR)</label>
            <input
              type="number"
              value={priceInr}
              onChange={e => setPriceInr(e.target.value)}
              className="w-full border border-charcoal bg-paper-dark p-2 text-sm font-sans text-ink focus:outline-none focus:border-orange"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-charcoal-400 block">Lifespan (Years)</label>
              <input
                type="number"
                value={lifespanYears}
                onChange={e => setLifespanYears(e.target.value)}
                className="w-full border border-charcoal bg-paper-dark p-2 text-sm font-sans text-ink focus:outline-none focus:border-orange"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-charcoal-400 block">Longevity vs Avg</label>
              <input
                type="number"
                step="0.1"
                value={lifespanMultiplier}
                onChange={e => setLifespanMultiplier(e.target.value)}
                placeholder="e.g. 5.5"
                className="w-full border border-charcoal bg-paper-dark p-2 text-sm font-sans text-ink focus:outline-none focus:border-orange"
              />
            </div>
          </div>

          {/* ── Affiliate Links Manager ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-charcoal-400">Affiliate Links</label>
              <button
                onClick={addLink}
                className="text-[10px] font-sans font-bold uppercase text-orange hover:underline"
              >
                + Add Link
              </button>
            </div>

            {affiliateLinks.length === 0 && (
              <p className="text-[11px] font-sans text-charcoal-400 italic">No purchase links. Add one above.</p>
            )}

            {affiliateLinks.map((link, i) => (
              <div key={i} className="border border-charcoal bg-paper-dark p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    value={link.store}
                    onChange={e => updateLink(i, 'store', e.target.value)}
                    placeholder="Store (e.g. Amazon)"
                    className="flex-1 border border-ghost bg-paper p-1.5 text-xs font-sans text-ink focus:outline-none focus:border-orange"
                  />
                  <button onClick={() => removeLink(i)} className="text-charcoal-400 hover:text-orange text-xs font-bold">✕</button>
                </div>
                <input
                  value={link.url}
                  onChange={e => updateLink(i, 'url', e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-ghost bg-paper p-1.5 text-xs font-sans text-ink focus:outline-none focus:border-orange"
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={link.is_affiliate}
                    onChange={e => updateLink(i, 'is_affiliate', e.target.checked)}
                    className="accent-orange"
                  />
                  <span className={`text-[10px] font-sans font-bold uppercase tracking-wider ${link.is_affiliate ? 'text-green-600' : 'text-orange'}`}>
                    {link.is_affiliate ? 'Affiliate Link' : 'Not Affiliated (needs affiliate URL)'}
                  </span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Summary editor */}
        <div className="md:w-2/3 flex flex-col space-y-3">
          <div className="flex-1 flex flex-col space-y-1">
            <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-charcoal-400 block">Editorial Summary</label>
            <textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              className="flex-1 min-h-[200px] w-full border border-charcoal bg-paper-dark p-3 text-sm font-sans text-ink leading-relaxed focus:outline-none focus:border-orange resize-y"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className="btn-primary w-full md:w-auto"
            >
              {isPublishing ? 'Publishing...' : 'Approve & Publish ↗'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
