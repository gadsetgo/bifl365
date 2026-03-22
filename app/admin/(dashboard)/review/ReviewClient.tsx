'use client';

import { useState, useEffect } from 'react';
import type { Product, AwardType } from '@/lib/types';
import { AFFILIATE_TAG } from '@/lib/constants';

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

const TONES = [
  { id: 'reddit', label: 'Reddit-style' },
  { id: 'story', label: 'Story-led' },
  { id: 'data', label: 'Data-led' },
  { id: 'compare', label: 'Comparison' },
];

export function ReviewClient({ initialProducts }: { initialProducts: Product[] }) {
  const [queue, setQueue] = useState<Product[]>(initialProducts);
  const [currentIndex, setCurrentIndex] = useState(0);

  const activeProduct = queue[currentIndex];

  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftAward, setDraftAward] = useState<AwardType | 'none'>('none');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTones, setActiveTones] = useState<string[]>(['reddit', 'data']);
  const [sourceLinks, setSourceLinks] = useState('');
  const [descCopied, setDescCopied] = useState(false);

  // Reset draft state when active product changes
  useEffect(() => {
    if (activeProduct) {
      setDraftName(activeProduct.name || '');
      setDraftDesc(activeProduct.description_draft || activeProduct.summary || '');
      setDraftAward(activeProduct.award_type || 'none');
      setActiveTones(['reddit', 'data']);
      setSourceLinks('');
    }
  }, [activeProduct]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!activeProduct || isGenerating) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key.toLowerCase() === 'a') handleAction('approved');
      if (e.key.toLowerCase() === 'r') handleAction('rejected');
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, activeProduct, draftedUpdates, isGenerating]);

  function draftedUpdates() {
    return {
      name: draftName,
      description_draft: draftDesc,
      summary: stripHtml(draftDesc),
      award_type: draftAward === 'none' ? null : draftAward,
      amazon_tag: AFFILIATE_TAG
    };
  }

  async function handleAction(action: 'approved' | 'rejected') {
    if (!activeProduct) return;
    const currentId = activeProduct.id;
    const updates = {
      pipeline_status: action === 'approved' ? 'live' : 'rejected',
      status: action === 'approved' ? 'published' : 'draft',
      reviewed_at: new Date().toISOString(),
      ...(action === 'approved' ? draftedUpdates() : {})
    };

    setCurrentIndex(prev => prev + 1);
    try {
      await fetch(`/api/admin/products/${currentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (err) {
      console.error('Failed to update product', err);
      setCurrentIndex(prev => prev - 1);
    }
  }

  async function handleAI() {
    if (!activeProduct) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/admin/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: activeProduct.id,
          productName: draftName,
          category: activeProduct.category,
          specs: activeProduct.specs,
          scores: activeProduct.scores,
          tones: activeTones,
          sourceLinks
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      if (data?.newDescription) setDraftDesc(data.newDescription);
    } catch (err: any) {
      console.error(err);
      alert(`AI Generation Failed: ${err.message ?? err}`);
    } finally {
      setIsGenerating(false);
    }
  }

  function toggleTone(id: string) {
    setActiveTones(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  }

  if (!activeProduct) {
    return (
      <div className="py-20 text-center border border-charcoal bg-white shadow-card">
        <p className="font-serif font-bold text-xl text-ink mb-2">Queue Empty</p>
        <p className="text-sm font-sans text-charcoal-400">All caught up. Trigger a new pipeline or drop a research file to add products.</p>
      </div>
    );
  }

  const progressPercent = Math.round((currentIndex / queue.length) * 100);

  return (
    <div className="relative">
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs font-sans font-bold text-charcoal-400 uppercase tracking-widest mb-2">
          <span>Reviewing {currentIndex + 1} of {queue.length}</span>
          <button onClick={() => setCurrentIndex(p => Math.min(p + 1, queue.length))} className="hover:text-orange transition-colors">
            Skip →
          </button>
        </div>
        <div className="h-1.5 bg-ghost border border-charcoal-200 overflow-hidden">
          <div
            className="h-full bg-orange transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="bg-white border border-charcoal p-6 lg:p-8 shadow-[8px_8px_0px_0px_#121212] flex flex-col gap-6">

        {/* Core Product Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Product Name</label>
              <input
                type="text"
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                className="w-full h-12 px-3 text-lg font-serif font-bold border border-charcoal focus:border-orange focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Category</label>
                <div className="h-10 px-3 bg-paper-dark border border-ghost flex items-center text-sm uppercase tracking-wider text-charcoal font-bold">{activeProduct.category}</div>
              </div>
              <div>
                <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Award Type</label>
                <select
                  value={draftAward}
                  onChange={e => setDraftAward(e.target.value as any)}
                  className="w-full h-10 px-3 border border-charcoal focus:border-orange focus:outline-none text-sm font-sans appearance-none bg-paper"
                >
                  <option value="none">No Award</option>
                  <option value="value_buy">Value Buy</option>
                  <option value="forever_pick">Forever Pick</option>
                  <option value="hidden_gem">Hidden Gem</option>
                  <option value="current_star">Current Star</option>
                </select>
              </div>
            </div>
          </div>

          {/* Scores panel — now includes india_availability */}
          <div className="bg-paper-dark p-4 border border-ghost flex flex-col gap-2">
            <span className="text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Scores /20</span>
            <ul className="text-xs font-sans text-ink space-y-1.5">
              {[
                { label: 'Build Quality', key: 'build_quality' },
                { label: 'Longevity', key: 'longevity' },
                { label: 'Value', key: 'value' },
                { label: 'Repairability', key: 'repairability' },
                { label: 'India Availability', key: 'india_availability' },
              ].map(({ label, key }) => {
                const score = activeProduct.scores?.[key as keyof typeof activeProduct.scores] as number | null;
                return (
                  <li key={key} className="flex justify-between items-center gap-2">
                    <span className="text-charcoal-400">{label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="w-16 h-1.5 bg-ghost overflow-hidden">
                        <div
                          className="h-full bg-orange"
                          style={{ width: score !== null && score !== undefined ? `${(score / 20) * 100}%` : '0%' }}
                        />
                      </div>
                      <strong className="w-6 text-right">{score ?? '–'}</strong>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <hr className="border-ghost" />

        {/* Generative AI Section */}
        <div className="space-y-4">
          <div className="flex flex-wrap lg:flex-nowrap items-start gap-4">

            {/* Tone Builder */}
            <div className="flex-1 space-y-2">
              <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">AI Tone Matrix Builder</label>
              <div className="flex flex-wrap gap-2">
                {TONES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => toggleTone(t.id)}
                    className={`px-3 py-1.5 text-xs font-sans border transition-colors ${activeTones.includes(t.id) ? 'bg-orange text-paper border-orange' : 'bg-transparent text-charcoal-400 border-charcoal-200 hover:border-charcoal'}`}
                  >
                    {activeTones.includes(t.id) && '✓ '}{t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Source Link Integrator */}
            <div className="flex-1 space-y-2">
              <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Source Quotes & Links</label>
              <textarea
                placeholder="Paste raw quotes or URLs from Reddit, Amazon..."
                value={sourceLinks}
                onChange={e => setSourceLinks(e.target.value)}
                className="w-full h-16 p-2 text-xs font-sans border border-charcoal focus:border-orange focus:outline-none resize-none"
              />
            </div>

            {/* Regenerate button */}
            <div className="pt-5 shrink-0">
              <button
                onClick={handleAI}
                disabled={isGenerating || activeTones.length === 0}
                className="h-16 px-6 bg-charcoal text-paper font-sans uppercase text-xs tracking-widest font-bold hover:bg-charcoal-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <span className="animate-pulse">Generating...</span>
                ) : (
                  <><span>❖</span> Regenerate</>
                )}
              </button>
            </div>
          </div>

          {/* Draft Editor */}
          <div>
            <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1 flex justify-between items-center">
              <span>Description Draft (HTML allowed)</span>
              <span className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(draftDesc);
                    setDescCopied(true);
                    setTimeout(() => setDescCopied(false), 2000);
                  }}
                  className="text-[10px] font-bold uppercase tracking-widest text-charcoal-400 hover:text-ink transition-colors border border-charcoal-200 px-2 py-0.5"
                >
                  {descCopied ? '✓ Copied' : 'Copy'}
                </button>
                <span className="text-orange">{draftDesc.length} chars</span>
              </span>
            </label>
            <textarea
              value={draftDesc}
              onChange={e => setDraftDesc(e.target.value)}
              className="w-full h-48 p-4 text-sm font-sans border border-charcoal focus:border-orange focus:outline-none leading-relaxed"
            />
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-4 pt-4 border-t border-ghost">
          <button
            onClick={() => handleAction('rejected')}
            className="px-6 py-3 border border-charcoal text-ink text-sm font-bold uppercase tracking-widest hover:bg-charcoal hover:text-paper transition-colors"
          >
            [R] Reject
          </button>
          <button
            onClick={() => handleAction('approved')}
            className="flex-1 px-6 py-3 bg-orange border border-charcoal text-paper text-sm font-bold uppercase tracking-widest hover:bg-orange-hover transition-colors shadow-[4px_4px_0px_0px_#121212] active:translate-y-1 active:shadow-none"
          >
            [A] Approve & Push Live
          </button>
        </div>
      </div>
    </div>
  );
}
