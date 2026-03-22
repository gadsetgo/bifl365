'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Product, AwardType, AffiliateLink } from '@/lib/types';

const AWARD_OPTIONS: { value: AwardType | 'none'; label: string }[] = [
  { value: 'none', label: 'No Award' },
  { value: 'value_buy', label: 'Value Buy' },
  { value: 'forever_pick', label: 'Forever Pick' },
  { value: 'hidden_gem', label: 'Hidden Gem' },
  { value: 'current_star', label: 'Current Star' },
];

const SCORE_KEYS = [
  { key: 'build_quality', label: 'Build Quality' },
  { key: 'longevity', label: 'Longevity' },
  { key: 'value', label: 'Value' },
  { key: 'repairability', label: 'Repairability' },
  { key: 'india_availability', label: 'India Availability' },
] as const;

const TONES = [
  { id: 'reddit', label: 'Reddit-style' },
  { id: 'story', label: 'Story-led' },
  { id: 'data', label: 'Data-led' },
  { id: 'compare', label: 'Comparison' },
];

function isSearchUrl(url: string) {
  return url.includes('/s?k=') || url.includes('/search?q=');
}

export function ProductEditClient({ product: initial }: { product: Product }) {
  const [product, setProduct] = useState<Product>(initial);
  const [dirty, setDirty] = useState<Partial<Product>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [descMode, setDescMode] = useState<'preview' | 'edit'>('preview');
  const [activeTones, setActiveTones] = useState<string[]>(['reddit', 'data']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isStoringImage, setIsStoringImage] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const dirtyCount = Object.keys(dirty).length;

  function set<K extends keyof Product>(field: K, value: Product[K]) {
    setProduct(prev => ({ ...prev, [field]: value }));
    setDirty(prev => ({ ...prev, [field]: value }));
  }

  function setScore(key: string, value: number) {
    const scores = { ...(product.scores ?? { build_quality: 0, longevity: 0, value: 0, repairability: 0, india_availability: 0 }), [key]: value };
    set('scores', scores as Product['scores']);
  }

  function setSpec(key: string, value: string) {
    const specs = { ...(product.specs ?? {}), [key]: value || undefined };
    set('specs', specs as Product['specs']);
  }

  function setAffiliateUrl(idx: number, field: 'store' | 'url', value: string) {
    const links = [...(product.affiliate_links ?? [])];
    links[idx] = { ...links[idx], [field]: value };
    set('affiliate_links', links);
  }

  async function handleSave() {
    if (dirtyCount === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dirty),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDirty({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(action: 'approved' | 'rejected' | 'unpublish' | 'restore') {
    let updates: Partial<Product>;
    switch (action) {
      case 'approved':
        updates = { pipeline_status: 'live', status: 'published', reviewed_at: new Date().toISOString(), image_approved: true };
        break;
      case 'rejected':
        updates = { pipeline_status: 'rejected', status: 'draft' };
        break;
      case 'unpublish':
      case 'restore':
        updates = { pipeline_status: 'pending_review', status: 'draft' };
        break;
    }
    await fetch(`/api/admin/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    setProduct(prev => ({ ...prev, ...updates }));
    const labels: Record<string, string> = {
      approved: 'Published live',
      rejected: 'Rejected',
      unpublish: 'Unpublished',
      restore: 'Restored to pending',
    };
    setActionStatus(labels[action]);
  }

  async function handleRegenerate() {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/admin/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          productName: product.name,
          category: product.category,
          specs: product.specs,
          scores: product.scores,
          tones: activeTones,
          sourceLinks: '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      if (data?.newDescription) {
        set('description_draft', data.newDescription);
        setDescMode('preview');
      }
    } catch (err: any) {
      alert(`AI Generation Failed: ${err.message ?? err}`);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleEnrich() {
    setIsEnriching(true);
    try {
      const res = await fetch('/api/admin/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [product.id] }),
      });
      const { results } = await res.json();
      if (results?.[0]?.status === 'ok') {
        const data = results[0].data;
        // Set all enriched fields as dirty so user can review before saving
        Object.entries(data).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            setProduct(prev => ({ ...prev, [key]: value }));
            setDirty(prev => ({ ...prev, [key]: value }));
          }
        });
      } else {
        alert(`Enrichment failed: ${results?.[0]?.error ?? 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Enrichment failed: ${err.message ?? err}`);
    } finally {
      setIsEnriching(false);
    }
  }

  async function handleVerify() {
    setIsVerifying(true);
    try {
      const res = await fetch('/api/admin/verify-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [product.id] }),
      });
      const { results } = await res.json();
      if (results?.[0]?.status === 'ok') {
        const data = results[0].data;
        Object.entries(data).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            setProduct(prev => ({ ...prev, [key]: value }));
            setDirty(prev => ({ ...prev, [key]: value }));
          }
        });
      } else {
        alert(`Verification failed: ${results?.[0]?.error ?? 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Verification failed: ${err.message ?? err}`);
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleStoreImage() {
    if (!product.image_url) return;
    setIsStoringImage(true);
    try {
      const res = await fetch('/api/admin/store-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, imageUrl: product.image_url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setProduct(prev => ({ ...prev, image_url: data.storedUrl, image_approved: true }));
      setDirty(prev => {
        const next = { ...prev };
        delete (next as any).image_url;
        delete (next as any).image_approved;
        return next;
      });
      setActionStatus('Image stored permanently');
    } catch (err: any) {
      alert(`Store image failed: ${err.message ?? err}`);
    } finally {
      setIsStoringImage(false);
    }
  }

  function pickCandidate(url: string) {
    set('image_url', url);
    set('image_approved', true as any);
  }

  const totalScore = product.scores
    ? Object.values(product.scores).reduce((a, b) => a + b, 0)
    : null;

  const candidates = product.image_candidates ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/board" className="text-xs font-sans text-charcoal-400 hover:text-orange transition-colors uppercase tracking-widest">
            ← Products
          </Link>
          <h1 className="font-serif font-black text-2xl text-ink mt-1">{product.name}</h1>
          {actionStatus && (
            <p className="text-xs font-sans text-green-600 mt-1">{actionStatus}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {dirtyCount > 0 && (
            <span className="text-xs font-sans text-charcoal-400 bg-ghost px-2 py-1 border border-charcoal-200">
              {dirtyCount} unsaved {dirtyCount === 1 ? 'change' : 'changes'}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={dirtyCount === 0 || saving}
            className="px-4 py-2 bg-charcoal text-paper text-xs font-bold uppercase tracking-widest hover:bg-charcoal-700 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
          </button>
          {/* Status-aware action buttons */}
          {product.pipeline_status === 'live' ? (
            <button
              onClick={() => handleAction('unpublish')}
              className="px-4 py-2 border border-charcoal text-ink text-xs font-bold uppercase tracking-widest hover:bg-charcoal hover:text-paper transition-colors"
            >
              Unpublish
            </button>
          ) : product.pipeline_status === 'rejected' ? (
            <button
              onClick={() => handleAction('restore')}
              className="px-4 py-2 bg-orange text-paper text-xs font-bold uppercase tracking-widest hover:bg-orange/90 transition-colors"
            >
              Restore
            </button>
          ) : (
            <button
              onClick={() => handleAction('approved')}
              className="px-4 py-2 bg-orange text-paper text-xs font-bold uppercase tracking-widest hover:bg-orange/90 transition-colors"
            >
              Approve & Publish
            </button>
          )}
          {product.pipeline_status !== 'rejected' && (
            <button
              onClick={() => handleAction('rejected')}
              className="px-4 py-2 border border-charcoal text-ink text-xs font-bold uppercase tracking-widest hover:bg-charcoal hover:text-paper transition-colors"
            >
              Reject
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Left: main content */}
        <div className="md:col-span-3 space-y-6">

          {/* Image + candidates */}
          <div className="space-y-2">
            {product.image_url && (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.image_url} alt={product.name} className="w-full max-h-64 object-contain border border-gray-200 bg-white" />
                <button
                  onClick={handleStoreImage}
                  disabled={isStoringImage}
                  className="absolute top-2 right-2 px-2 py-1 text-[10px] font-bold uppercase tracking-widest bg-charcoal text-paper hover:bg-charcoal-700 disabled:opacity-50 transition-colors"
                  title="Download and store image permanently in Supabase Storage"
                >
                  {isStoringImage ? 'Storing...' : '⬇ Store'}
                </button>
              </div>
            )}
            {/* Image candidates grid */}
            {candidates.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-charcoal-400">Image Candidates</p>
                <div className="flex gap-2 flex-wrap">
                  {candidates.map((url, ci) => (
                    <button
                      key={ci}
                      onClick={() => pickCandidate(url)}
                      className="relative w-20 h-20 border border-charcoal-200 hover:border-orange transition-colors overflow-hidden"
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      {ci === 0 && (
                        <span className="absolute top-0 left-0 bg-orange text-paper text-[7px] px-1 py-0.5 font-bold">AI</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Image URL</label>
              <input
                type="text"
                value={product.image_url ?? ''}
                onChange={e => set('image_url', e.target.value || null)}
                className="w-full h-9 px-2 text-sm border border-charcoal focus:border-orange focus:outline-none"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Video URL</label>
              <input
                type="url"
                value={product.video_url ?? ''}
                onChange={e => set('video_url', e.target.value || null)}
                className="w-full h-9 px-2 text-sm border border-charcoal focus:border-orange focus:outline-none"
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
          </div>

          {/* Specs */}
          <div>
            <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-charcoal-400 mb-3">Specs</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'material', label: 'Material', type: 'text' },
                { key: 'warranty', label: 'Warranty', type: 'text' },
                { key: 'made_in', label: 'Made In', type: 'text' },
                { key: 'weight', label: 'Weight', type: 'text' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">{label}</label>
                  <input
                    type={type}
                    value={(product.specs as Record<string, string | number | undefined> | null)?.[key] as string ?? ''}
                    onChange={e => setSpec(key, e.target.value)}
                    className="w-full h-9 px-2 text-sm border border-charcoal focus:border-orange focus:outline-none"
                  />
                </div>
              ))}
              <div>
                <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Repair Score /10</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={product.specs?.repairability_score ?? ''}
                  onChange={e => setSpec('repairability_score', e.target.value)}
                  className="w-full h-9 px-2 text-sm border border-charcoal focus:border-orange focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Scores */}
          <div>
            <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-charcoal-400 mb-3">
              Scores — Total: {totalScore ?? '–'}/100
            </p>
            {totalScore !== null && (
              <div className="h-2 border border-charcoal bg-ghost mb-4 overflow-hidden">
                <div className="h-full bg-orange transition-all" style={{ width: `${totalScore}%` }} />
              </div>
            )}
            <div className="grid grid-cols-1 gap-3">
              {SCORE_KEYS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs font-sans text-charcoal-400 w-36 shrink-0">{label}</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={(product.scores as Record<string, number> | null)?.[key] ?? ''}
                    onChange={e => setScore(key, Number(e.target.value))}
                    className="w-20 h-8 px-2 text-sm border border-charcoal focus:border-orange focus:outline-none"
                  />
                  <div className="flex-1 h-1.5 bg-ghost overflow-hidden">
                    <div
                      className="h-full bg-orange"
                      style={{ width: `${(((product.scores as Record<string, number> | null)?.[key] ?? 0) / 20) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-charcoal-400">Editorial Description</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDescMode(m => m === 'preview' ? 'edit' : 'preview')}
                  className="text-[10px] font-bold uppercase tracking-widest text-charcoal-400 hover:text-ink border border-charcoal-200 px-2 py-0.5 transition-colors"
                >
                  {descMode === 'preview' ? 'Edit' : 'Preview'}
                </button>
              </div>
            </div>

            {/* AI Tone + Rewrite / Enrich */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {TONES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTones(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                  className={`px-3 py-1 text-[10px] font-sans border transition-colors ${activeTones.includes(t.id) ? 'bg-orange text-paper border-orange' : 'bg-transparent text-charcoal-400 border-charcoal-200 hover:border-charcoal'}`}
                >
                  {activeTones.includes(t.id) && '✓ '}{t.label}
                </button>
              ))}
              <button
                onClick={handleRegenerate}
                disabled={isGenerating || activeTones.length === 0}
                className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-charcoal text-paper hover:bg-charcoal-700 disabled:opacity-50 transition-colors"
              >
                {isGenerating ? 'Generating...' : 'Rewrite Description'}
              </button>
              <button
                onClick={handleEnrich}
                disabled={isEnriching}
                className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-orange text-paper hover:bg-orange/90 disabled:opacity-50 transition-colors"
              >
                {isEnriching ? 'Enriching...' : '❖ Full Enrich'}
              </button>
              <button
                onClick={handleVerify}
                disabled={isVerifying}
                className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-charcoal text-paper hover:bg-charcoal-700 disabled:opacity-50 transition-colors"
              >
                {isVerifying ? 'Verifying...' : '⟳ Verify Links'}
              </button>
            </div>

            {descMode === 'preview' ? (
              <div
                className="min-h-[120px] p-4 border border-charcoal-200 bg-white prose prose-sm max-w-none text-ink [&>p]:mb-3 [&>p:last-child]:mb-0"
                dangerouslySetInnerHTML={{ __html: product.description_draft || '<p class="text-charcoal-400 text-sm">No description yet.</p>' }}
              />
            ) : (
              <textarea
                value={product.description_draft ?? ''}
                onChange={e => set('description_draft', e.target.value || null)}
                className="w-full h-48 p-3 text-sm font-sans border border-charcoal focus:border-orange focus:outline-none resize-y leading-relaxed"
              />
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <aside className="md:col-span-2 space-y-5">
          <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4 shadow-sm">
            {/* Name */}
            <div>
              <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Name</label>
              <input
                type="text"
                value={product.name}
                onChange={e => set('name', e.target.value)}
                className="w-full h-10 px-3 text-base font-serif font-bold border border-charcoal focus:border-orange focus:outline-none"
              />
            </div>

            {/* Brand */}
            <div>
              <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Brand</label>
              <input
                type="text"
                value={product.brand}
                onChange={e => set('brand', e.target.value)}
                className="w-full h-9 px-3 text-sm border border-charcoal focus:border-orange focus:outline-none"
              />
            </div>

            {/* Category — read-only */}
            <div>
              <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Category</label>
              <div className="h-9 px-3 bg-paper-dark border border-ghost flex items-center text-sm uppercase tracking-wider text-charcoal font-bold">{product.category}</div>
            </div>

            {/* Award */}
            <div>
              <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Award</label>
              <select
                value={product.award_type ?? 'none'}
                onChange={e => set('award_type', e.target.value === 'none' ? null : e.target.value as AwardType)}
                className="w-full h-9 px-3 text-sm border border-charcoal focus:border-orange focus:outline-none bg-white"
              >
                {AWARD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Featured Override */}
            <div>
              <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Feature Until (override)</label>
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={product.featured_until ? new Date(product.featured_until).toISOString().slice(0, 16) : ''}
                  onChange={e => set('featured_until', e.target.value ? new Date(e.target.value).toISOString() : null)}
                  className="flex-1 h-9 px-2 text-sm border border-charcoal focus:border-orange focus:outline-none"
                />
                {product.featured_until && (
                  <button
                    type="button"
                    onClick={() => set('featured_until', null)}
                    className="px-2 h-9 text-xs border border-charcoal hover:bg-charcoal hover:text-paper transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              {product.featured_until && new Date(product.featured_until) > new Date() && (
                <p className="text-2xs text-orange mt-1 font-bold">Active override — this product is featured on homepage</p>
              )}
              {product.featured_until && new Date(product.featured_until) <= new Date() && (
                <p className="text-2xs text-charcoal-400 mt-1">Expired — override no longer active</p>
              )}
            </div>

            {/* Prices */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Price ₹</label>
                <input
                  type="number"
                  value={product.price_inr ?? ''}
                  onChange={e => set('price_inr', e.target.value ? Number(e.target.value) : null)}
                  className="w-full h-9 px-2 text-sm border border-charcoal focus:border-orange focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Price $</label>
                <input
                  type="number"
                  value={product.price_usd ?? ''}
                  onChange={e => set('price_usd', e.target.value ? Number(e.target.value) : null)}
                  className="w-full h-9 px-2 text-sm border border-charcoal focus:border-orange focus:outline-none"
                />
              </div>
            </div>

            {/* Affiliate links */}
            <div>
              <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-2">Affiliate Links</label>
              <div className="space-y-2">
                {(product.affiliate_links ?? []).map((link, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={link.store}
                        onChange={e => setAffiliateUrl(idx, 'store', e.target.value)}
                        className="w-24 h-8 px-2 text-xs border border-charcoal-200 focus:border-orange focus:outline-none"
                        placeholder="Store"
                      />
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={link.url}
                          onChange={e => setAffiliateUrl(idx, 'url', e.target.value)}
                          className={`w-full h-8 px-2 text-xs border focus:outline-none ${isSearchUrl(link.url) ? 'border-amber-400 bg-amber-50' : 'border-charcoal-200 focus:border-orange'}`}
                          placeholder="https://..."
                        />
                        {isSearchUrl(link.url) && (
                          <span className="absolute right-2 top-1.5 text-amber-500 text-xs" title="Search URL — not a direct product page">⚠</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const links: AffiliateLink[] = [...(product.affiliate_links ?? []), { store: 'Amazon', url: '', is_affiliate: true }];
                    set('affiliate_links', links);
                  }}
                  className="text-[10px] font-bold uppercase tracking-widest text-charcoal-400 hover:text-ink transition-colors"
                >
                  + Add Link
                </button>
              </div>
            </div>

            {/* Reddit sentiment */}
            <div>
              <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Community Verdict</label>
              <textarea
                value={product.reddit_sentiment ?? ''}
                onChange={e => set('reddit_sentiment', e.target.value || null)}
                className="w-full h-20 p-2 text-sm border border-charcoal focus:border-orange focus:outline-none resize-none"
              />
            </div>

            {/* Lifespan */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Lifespan (yrs)</label>
                <input
                  type="number"
                  value={product.estimated_lifespan_years ?? ''}
                  onChange={e => set('estimated_lifespan_years', e.target.value ? Number(e.target.value) : null)}
                  className="w-full h-9 px-2 text-sm border border-charcoal focus:border-orange focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Multiplier</label>
                <input
                  type="number"
                  step="0.1"
                  value={product.estimated_lifespan_multiplier ?? ''}
                  onChange={e => set('estimated_lifespan_multiplier', e.target.value ? Number(e.target.value) : null)}
                  className="w-full h-9 px-2 text-sm border border-charcoal focus:border-orange focus:outline-none"
                />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
