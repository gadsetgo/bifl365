'use client';

import { useState } from 'react';
import type { Product, AffiliateLink } from '@/lib/types';

type StoreKey = 'amazon' | 'flipkart' | 'brand';

interface StoreIssue {
  store: string;
  storeKey: StoreKey;
  currentUrl: string | null;
  issueType: 'missing' | 'broken';
}

interface ScanIssue {
  id: string;
  name: string;
  brand: string;
  category: string;
  status: string;
  storeIssues: StoreIssue[];
}

interface FoundLink {
  store: string;
  storeKey: StoreKey;
  url: string;
}

interface Proposal {
  productId: string;
  name: string;
  brand: string;
  storeIssues: StoreIssue[];
  foundLinks: FoundLink[];
  approved: boolean;
  existingLinks: AffiliateLink[];
}

type Phase = 'config' | 'scanning' | 'scanned' | 'searching' | 'review' | 'applying' | 'done';

const STORE_OPTIONS: { key: StoreKey; label: string; color: string }[] = [
  { key: 'amazon', label: 'Amazon', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { key: 'flipkart', label: 'Flipkart', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { key: 'brand', label: 'Brand/Official', color: 'bg-purple-100 text-purple-800 border-purple-300' },
];

export function LinkFixerPanel({
  products,
  onClose,
  onProductsUpdated,
}: {
  products: Product[];
  onClose: () => void;
  onProductsUpdated: (updates: { id: string; affiliate_links: AffiliateLink[] }[]) => void;
}) {
  const [selectedStores, setSelectedStores] = useState<Set<StoreKey>>(new Set(['amazon', 'flipkart', 'brand']));
  const [phase, setPhase] = useState<Phase>('config');
  const [scanResults, setScanResults] = useState<ScanIssue[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [searchProgress, setSearchProgress] = useState({ current: 0, total: 0 });
  const [applyResult, setApplyResult] = useState<{ applied: number; errors: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleStore(key: StoreKey) {
    setSelectedStores(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Phase 1: Scan
  async function handleScan() {
    setPhase('scanning');
    setError(null);
    try {
      const res = await fetch('/api/admin/products/fix-links-interactive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan', stores: Array.from(selectedStores) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setScanResults(data.issues ?? []);
      setTotalProducts(data.total ?? 0);
      setPhase('scanned');
    } catch (err: any) {
      setError(err.message);
      setPhase('config');
    }
  }

  // Phase 2: Search for fixes via Gemini (one product at a time for live progress)
  async function handleSearch() {
    setPhase('searching');
    setError(null);
    const newProposals: Proposal[] = [];
    setSearchProgress({ current: 0, total: scanResults.length });

    for (let i = 0; i < scanResults.length; i++) {
      const issue = scanResults[i];
      setSearchProgress({ current: i + 1, total: scanResults.length });

      try {
        const res = await fetch('/api/admin/products/fix-links-interactive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'search',
            productId: issue.id,
            productName: issue.name,
            brand: issue.brand,
            category: issue.category,
            stores: issue.storeIssues.map(si => si.storeKey),
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const existingProduct = products.find(p => p.id === issue.id);
        const existingLinks = existingProduct?.affiliate_links ?? [];

        if (data.found?.length > 0) {
          newProposals.push({
            productId: issue.id,
            name: issue.name,
            brand: issue.brand,
            storeIssues: issue.storeIssues,
            foundLinks: data.found,
            approved: true, // default approved
            existingLinks,
          });
        }
        // Update proposals in real-time
        setProposals([...newProposals]);
      } catch {
        // Skip failed products
      }
    }

    setProposals(newProposals);
    setPhase('review');
  }

  // Phase 3: Apply approved changes
  async function handleApply() {
    setPhase('applying');
    setError(null);

    const approved = proposals.filter(p => p.approved);
    const updates: { id: string; affiliate_links: AffiliateLink[] }[] = [];

    for (const proposal of approved) {
      let updatedLinks = [...proposal.existingLinks];

      for (const found of proposal.foundLinks) {
        const validator = STORE_OPTIONS.find(s => s.key === found.storeKey);
        if (!validator) continue;

        // Remove old links for this store
        updatedLinks = updatedLinks.filter(l => {
          try {
            const h = new URL(l.url).hostname.toLowerCase();
            if (found.storeKey === 'amazon') return !h.includes('amazon.');
            if (found.storeKey === 'flipkart') return !h.includes('flipkart.com');
            // For brand: don't auto-remove existing brand links, just add
            return true;
          } catch { return true; }
        });

        updatedLinks.push({
          store: found.store,
          url: found.url,
          is_affiliate: found.storeKey === 'amazon',
          link_type: found.storeKey === 'brand' ? 'brand' : 'affiliate',
        });
      }

      updates.push({ id: proposal.productId, affiliate_links: updatedLinks });
    }

    try {
      const res = await fetch('/api/admin/products/fix-links-interactive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply', updates }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setApplyResult({
        applied: data.applied ?? 0,
        errors: (data.results ?? []).filter((r: any) => r.status !== 'ok').length,
      });

      // Update parent state
      onProductsUpdated(updates);
      setPhase('done');
    } catch (err: any) {
      setError(err.message);
      setPhase('review');
    }
  }

  function toggleProposal(idx: number) {
    setProposals(prev => prev.map((p, i) => i === idx ? { ...p, approved: !p.approved } : p));
  }

  function approveAll() {
    setProposals(prev => prev.map(p => ({ ...p, approved: true })));
  }

  function rejectAll() {
    setProposals(prev => prev.map(p => ({ ...p, approved: false })));
  }

  const approvedCount = proposals.filter(p => p.approved).length;

  return (
    <div className="bg-white border border-orange p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest font-sans">
          Fix Links
        </h3>
        <button onClick={onClose} className="text-xs text-charcoal-400 hover:text-ink">Close</button>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2">{error}</div>
      )}

      {/* Phase: Config */}
      {phase === 'config' && (
        <div className="space-y-3">
          <p className="text-xs text-charcoal-400">Select which link types to scan and fix:</p>
          <div className="flex gap-3">
            {STORE_OPTIONS.map(opt => (
              <label
                key={opt.key}
                className={`flex items-center gap-2 px-3 py-2 border text-xs font-bold uppercase tracking-widest cursor-pointer transition-colors ${
                  selectedStores.has(opt.key)
                    ? opt.color
                    : 'bg-white text-charcoal-400 border-charcoal-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedStores.has(opt.key)}
                  onChange={() => toggleStore(opt.key)}
                  className="accent-orange"
                />
                {opt.label}
              </label>
            ))}
          </div>
          <button
            onClick={handleScan}
            disabled={selectedStores.size === 0}
            className="px-4 py-2 bg-orange text-paper text-xs font-bold uppercase tracking-widest hover:bg-orange/90 disabled:opacity-50 transition-colors"
          >
            Scan Products
          </button>
        </div>
      )}

      {/* Phase: Scanning */}
      {phase === 'scanning' && (
        <div className="flex items-center gap-2 text-xs text-charcoal-400">
          <span className="inline-block w-4 h-4 border-2 border-orange border-t-transparent rounded-full animate-spin" />
          Scanning all products...
        </div>
      )}

      {/* Phase: Scan results */}
      {phase === 'scanned' && (
        <div className="space-y-3">
          <div className="text-xs text-charcoal-400">
            Scanned <span className="font-bold text-ink">{totalProducts}</span> products.{' '}
            <span className="font-bold text-orange">{scanResults.length}</span> have broken or missing links.
          </div>

          {scanResults.length === 0 ? (
            <div className="text-xs text-green-600 font-bold">All links look good! Nothing to fix.</div>
          ) : (
            <>
              <div className="max-h-48 overflow-y-auto border border-charcoal-200">
                <table className="w-full text-xs">
                  <thead className="bg-charcoal text-paper text-[10px] uppercase tracking-widest sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-left">Brand</th>
                      <th className="px-3 py-2 text-left">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanResults.map((issue, i) => (
                      <tr key={issue.id} className={i % 2 === 0 ? 'bg-white' : 'bg-paper'}>
                        <td className="px-3 py-1.5 font-medium">{issue.name}</td>
                        <td className="px-3 py-1.5 text-charcoal-400">{issue.brand}</td>
                        <td className="px-3 py-1.5">
                          <div className="flex gap-1 flex-wrap">
                            {issue.storeIssues.map((si, j) => {
                              const opt = STORE_OPTIONS.find(s => s.key === si.storeKey);
                              return (
                                <span key={j} className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase border ${
                                  si.issueType === 'broken' ? 'bg-red-50 text-red-700 border-red-300' : 'bg-amber-50 text-amber-700 border-amber-300'
                                }`}>
                                  {opt?.label}: {si.issueType}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 bg-orange text-paper text-xs font-bold uppercase tracking-widest hover:bg-orange/90 transition-colors"
                >
                  Search for Correct Links ({scanResults.length} products)
                </button>
                <button
                  onClick={() => setPhase('config')}
                  className="px-4 py-2 border border-charcoal text-xs font-bold uppercase tracking-widest hover:bg-charcoal hover:text-paper transition-colors"
                >
                  Back
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Phase: Searching */}
      {phase === 'searching' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-charcoal-400">
            <span className="inline-block w-4 h-4 border-2 border-orange border-t-transparent rounded-full animate-spin" />
            Searching via Gemini... {searchProgress.current} / {searchProgress.total}
          </div>
          <div className="w-full h-2 bg-charcoal-200 overflow-hidden">
            <div
              className="h-full bg-orange transition-all duration-300"
              style={{ width: `${searchProgress.total > 0 ? (searchProgress.current / searchProgress.total) * 100 : 0}%` }}
            />
          </div>
          {/* Show proposals found so far */}
          {proposals.length > 0 && (
            <div className="text-xs text-green-600">{proposals.length} replacement(s) found so far...</div>
          )}
        </div>
      )}

      {/* Phase: Review proposals */}
      {(phase === 'review' || phase === 'applying') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-charcoal-400">
              Found replacements for <span className="font-bold text-ink">{proposals.length}</span> product(s).
              {' '}<span className="font-bold text-green-600">{approvedCount} approved</span>
            </div>
            <div className="flex gap-2">
              <button onClick={approveAll} className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest border border-green-300 text-green-700 hover:bg-green-50 transition-colors">
                Select All
              </button>
              <button onClick={rejectAll} className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest border border-charcoal-200 text-charcoal-400 hover:bg-ghost transition-colors">
                Deselect All
              </button>
            </div>
          </div>

          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {proposals.map((proposal, idx) => (
              <div
                key={proposal.productId}
                className={`border p-3 space-y-2 transition-colors ${
                  proposal.approved ? 'border-green-300 bg-green-50/30' : 'border-charcoal-200 bg-white opacity-60'
                }`}
              >
                {/* Product header with checkbox */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={proposal.approved}
                    onChange={() => toggleProposal(idx)}
                    className="accent-orange w-4 h-4"
                    disabled={phase === 'applying'}
                  />
                  <div>
                    <span className="text-sm font-serif font-bold">{proposal.name}</span>
                    <span className="text-xs text-charcoal-400 ml-2">{proposal.brand}</span>
                  </div>
                </div>

                {/* Link changes */}
                <div className="ml-7 space-y-1.5">
                  {proposal.storeIssues.map((issue, i) => {
                    const found = proposal.foundLinks.find(f => f.storeKey === issue.storeKey);
                    const opt = STORE_OPTIONS.find(s => s.key === issue.storeKey);

                    return (
                      <div key={i} className="text-xs space-y-0.5">
                        <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase border ${opt?.color ?? 'border-charcoal-200'} mr-2`}>
                          {issue.store}
                        </span>

                        {/* Old link */}
                        <div className="ml-1 flex items-center gap-2">
                          <span className="text-red-500 font-bold w-8 shrink-0">OLD:</span>
                          {issue.currentUrl ? (
                            <a
                              href={issue.currentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-red-600 underline decoration-red-300 hover:decoration-red-600 truncate max-w-[500px]"
                              title={issue.currentUrl}
                            >
                              {issue.currentUrl}
                            </a>
                          ) : (
                            <span className="text-charcoal-400 italic">(missing)</span>
                          )}
                        </div>

                        {/* New link */}
                        <div className="ml-1 flex items-center gap-2">
                          <span className="text-green-600 font-bold w-8 shrink-0">NEW:</span>
                          {found ? (
                            <a
                              href={found.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-700 underline decoration-green-300 hover:decoration-green-700 truncate max-w-[500px]"
                              title={found.url}
                            >
                              {found.url}
                            </a>
                          ) : (
                            <span className="text-charcoal-400 italic">(not found — will keep old)</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {proposals.length === 0 ? (
            <div className="text-xs text-amber-600 font-bold">
              No valid replacements found. Try with different store types.
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleApply}
                disabled={approvedCount === 0 || phase === 'applying'}
                className="px-4 py-2 bg-orange text-paper text-xs font-bold uppercase tracking-widest hover:bg-orange/90 disabled:opacity-50 transition-colors"
              >
                {phase === 'applying' ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 border-2 border-paper border-t-transparent rounded-full animate-spin" />
                    Applying...
                  </span>
                ) : (
                  `Apply ${approvedCount} Change${approvedCount !== 1 ? 's' : ''}`
                )}
              </button>
              <button
                onClick={() => setPhase('scanned')}
                disabled={phase === 'applying'}
                className="px-4 py-2 border border-charcoal text-xs font-bold uppercase tracking-widest hover:bg-charcoal hover:text-paper disabled:opacity-50 transition-colors"
              >
                Back
              </button>
            </div>
          )}
        </div>
      )}

      {/* Phase: Done */}
      {phase === 'done' && applyResult && (
        <div className="space-y-3">
          <div className="text-xs">
            <span className="text-green-600 font-bold">{applyResult.applied} product(s) updated successfully.</span>
            {applyResult.errors > 0 && (
              <span className="text-red-600 font-bold ml-2">{applyResult.errors} error(s).</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setPhase('config');
                setProposals([]);
                setScanResults([]);
                setApplyResult(null);
              }}
              className="px-4 py-2 border border-charcoal text-xs font-bold uppercase tracking-widest hover:bg-charcoal hover:text-paper transition-colors"
            >
              Run Again
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-orange text-paper text-xs font-bold uppercase tracking-widest hover:bg-orange/90 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
