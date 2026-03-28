'use client';

import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CATEGORIES } from '@/lib/constants';
import type { Product, AwardType, AffiliateLink } from '@/lib/types';
import { LinkFixerPanel } from './LinkFixerPanel';

type SuggestionRow = {
  id: string;
  name: string;
  category: string;
  notes: string | null;
  priority: number;
  status: string;
  created_at: string;
};

const AWARD_OPTIONS: { value: AwardType | 'none'; label: string }[] = [
  { value: 'none', label: 'No Award' },
  { value: 'value_buy', label: 'Value Buy' },
  { value: 'forever_pick', label: 'Forever Pick' },
  { value: 'hidden_gem', label: 'Hidden Gem' },
  { value: 'current_star', label: 'Current Star' },
];

function isSearchUrl(url: string) {
  return url.includes('/s?k=') || url.includes('/search?q=');
}

type StatusTab = 'all' | 'pending' | 'live' | 'rejected' | 'needs_image' | 'suggestions';

type ColumnKey = 'checkbox' | 'image' | 'name' | 'brand' | 'category' | 'award' | 'score' | 'status' | 'links' | 'img_status' | 'summary' | 'specs' | 'prices' | 'lifespan' | 'actions';

const ALL_COLUMNS: { key: ColumnKey; label: string; defaultOn: boolean; alwaysOn?: boolean }[] = [
  { key: 'checkbox', label: '☐', defaultOn: true, alwaysOn: true },
  { key: 'image', label: 'Img', defaultOn: true },
  { key: 'name', label: 'Name', defaultOn: true },
  { key: 'brand', label: 'Brand', defaultOn: true },
  { key: 'category', label: 'Category', defaultOn: true },
  { key: 'award', label: 'Award', defaultOn: true },
  { key: 'score', label: 'Score', defaultOn: true },
  { key: 'status', label: 'Status', defaultOn: true },
  { key: 'links', label: 'Links', defaultOn: true },
  { key: 'img_status', label: 'Img Status', defaultOn: true },
  { key: 'summary', label: 'Summary', defaultOn: false },
  { key: 'specs', label: 'Specs', defaultOn: false },
  { key: 'prices', label: 'Prices', defaultOn: false },
  { key: 'lifespan', label: 'Lifespan', defaultOn: false },
  { key: 'actions', label: 'Actions', defaultOn: true, alwaysOn: true },
];

type InlineEdits = Partial<Pick<Product, 'name' | 'image_url' | 'award_type'>>;

export function BoardClient({
  initialProducts,
  initialSuggestions,
}: {
  initialProducts: Product[];
  initialSuggestions: SuggestionRow[];
}) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<StatusTab>(() => {
    const tab = searchParams.get('tab');
    if (tab === 'images') return 'needs_image';
    if (tab === 'all' || tab === 'pending' || tab === 'live' || tab === 'rejected' || tab === 'needs_image' || tab === 'suggestions') return tab;
    return 'live';
  });
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>(initialSuggestions);
  const [search, setSearch] = useState('');

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    () => new Set(ALL_COLUMNS.filter(c => c.defaultOn).map(c => c.key))
  );
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showColumnPicker) return;
    function handleClick(e: MouseEvent) {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showColumnPicker]);

  // Inline editing state
  const [edits, setEdits] = useState<Record<string, InlineEdits>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Add product form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState('kitchen');
  const [addBrand, setAddBrand] = useState('');
  const [addImageUrl, setAddImageUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Enriching state
  const [enriching, setEnriching] = useState<Set<string>>(new Set());

  // Verify links state
  const [verifying, setVerifying] = useState<Set<string>>(new Set());

  // Fix links state
  const [fixingLinks, setFixingLinks] = useState(false);
  const [showLinkFixer, setShowLinkFixer] = useState(false);

  // Store image state
  const [storingImage, setStoringImage] = useState<Set<string>>(new Set());

  // Dedup + audit state
  const [dupClusters, setDupClusters] = useState<any[] | null>(null);
  const [findingDupes, setFindingDupes] = useState(false);
  const [mergingDupe, setMergingDupe] = useState<string | null>(null);
  const [auditResults, setAuditResults] = useState<any | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [fixingAudit, setFixingAudit] = useState(false);

  // Image picker state
  const [imagePickerOpen, setImagePickerOpen] = useState<string | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState('');

  // Pagination
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState(0);

  // Computed tab counts
  const counts = useMemo(() => {
    const all = products.length;
    const pending = products.filter(p => p.pipeline_status === 'pending_review').length;
    const live = products.filter(p => p.pipeline_status === 'live').length;
    const rejected = products.filter(p => p.pipeline_status === 'rejected').length;
    const needsImage = products.filter(p => p.image_approved !== true && Array.isArray(p.image_candidates) && p.image_candidates.length > 0).length;
    return { all, pending, live, rejected, needsImage, suggestions: suggestions.length };
  }, [products, suggestions]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    let list = products;

    // Tab filter
    switch (activeTab) {
      case 'pending':
        list = list.filter(p => p.pipeline_status === 'pending_review');
        break;
      case 'live':
        list = list.filter(p => p.pipeline_status === 'live');
        break;
      case 'rejected':
        list = list.filter(p => p.pipeline_status === 'rejected');
        break;
      case 'needs_image':
        list = list.filter(p => p.image_approved !== true && Array.isArray(p.image_candidates) && p.image_candidates.length > 0);
        break;
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q));
    }

    return list;
  }, [products, activeTab, search]);

  // Paginated products
  const totalPages = pageSize === 0 ? 1 : Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = pageSize === 0
    ? filteredProducts
    : filteredProducts.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  // Reset page when filter changes
  useEffect(() => { setCurrentPage(0); }, [activeTab, search]);

  const isCol = (key: ColumnKey) => visibleColumns.has(key);

  function toggleColumn(key: ColumnKey) {
    const col = ALL_COLUMNS.find(c => c.key === key);
    if (col?.alwaysOn) return;
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function setField(id: string, field: keyof InlineEdits, value: string) {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function saveRow(id: string) {
    const changes = edits[id];
    if (!changes || Object.keys(changes).length === 0) return;
    setSaving(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();
      setProducts(prev => prev.map(p => (p.id === id ? { ...p, ...updated } : p)));
      setEdits(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch (err) {
      console.error('Save failed', err);
    } finally {
      setSaving(prev => ({ ...prev, [id]: false }));
    }
  }

  async function approveProduct(id: string) {
    const updates = {
      pipeline_status: 'live',
      status: 'published',
      reviewed_at: new Date().toISOString(),
      image_approved: true,
    };
    await fetch(`/api/admin/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } as Product : p));
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
  }

  async function rejectProduct(id: string) {
    const updates = { pipeline_status: 'rejected', status: 'draft' };
    await fetch(`/api/admin/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } as Product : p));
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
  }

  async function bulkAction(action: 'approved' | 'rejected') {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const updates =
      action === 'approved'
        ? { pipeline_status: 'live', status: 'published', reviewed_at: new Date().toISOString(), image_approved: true }
        : { pipeline_status: 'rejected', status: 'draft' };
    await fetch('/api/admin/products/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, updates }),
    });
    setProducts(prev => prev.map(p => selected.has(p.id) ? { ...p, ...updates } as Product : p));
    setSelected(new Set());
  }

  async function enrichSingle(id: string) {
    setEnriching(prev => new Set(prev).add(id));
    try {
      const res = await fetch('/api/admin/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      const { results } = await res.json();
      if (results?.[0]?.status === 'ok') {
        setProducts(prev => prev.map(p => p.id === id ? { ...p, ...results[0].data } : p));
      }
    } catch (err) {
      console.error('Enrich failed', err);
    } finally {
      setEnriching(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }

  async function bulkEnrich() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    ids.forEach(id => setEnriching(prev => new Set(prev).add(id)));
    try {
      const res = await fetch('/api/admin/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const { results } = await res.json();
      if (Array.isArray(results)) {
        setProducts(prev => prev.map(p => {
          const r = results.find((r: any) => r.id === p.id);
          return r?.status === 'ok' ? { ...p, ...r.data } : p;
        }));
      }
    } catch (err) {
      console.error('Bulk enrich failed', err);
    } finally {
      setEnriching(new Set());
      setSelected(new Set());
    }
  }

  async function verifySingle(id: string) {
    setVerifying(prev => new Set(prev).add(id));
    try {
      const res = await fetch('/api/admin/verify-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      const { results } = await res.json();
      if (results?.[0]?.status === 'ok' && results[0].data) {
        setProducts(prev => prev.map(p => p.id === id ? { ...p, ...results[0].data } : p));
      }
    } catch (err) {
      console.error('Verify links failed', err);
    } finally {
      setVerifying(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }

  async function bulkVerify() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    ids.forEach(id => setVerifying(prev => new Set(prev).add(id)));
    try {
      const res = await fetch('/api/admin/verify-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const { results } = await res.json();
      if (Array.isArray(results)) {
        setProducts(prev => prev.map(p => {
          const r = results.find((r: any) => r.id === p.id);
          return r?.status === 'ok' && r.data ? { ...p, ...r.data } : p;
        }));
      }
    } catch (err) {
      console.error('Bulk verify failed', err);
    } finally {
      setVerifying(new Set());
      setSelected(new Set());
    }
  }

  async function handleAddProduct() {
    if (!addName.trim()) return;
    setIsAdding(true);
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addName.trim(),
          brand: addBrand.trim() || undefined,
          category: addCategory,
          image_url: addImageUrl.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const newProduct = await res.json();
      setProducts(prev => [newProduct, ...prev]);
      setAddName(''); setAddBrand(''); setAddImageUrl('');
      setShowAddForm(false);
    } catch (err) {
      console.error('Add failed', err);
    } finally {
      setIsAdding(false);
    }
  }

  async function toggleFeature(id: string) {
    const product = products.find(p => p.id === id);
    const isActive = product?.featured_until && new Date(product.featured_until) > new Date();
    const updates = isActive
      ? { featured_until: null }
      : { featured_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() };
    await fetch(`/api/admin/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } as Product : p));
  }

  async function pickImage(productId: string, imageUrl: string) {
    const updates = { image_url: imageUrl, image_approved: true };
    await fetch(`/api/admin/products/${productId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, ...updates } as Product : p));
    setImagePickerOpen(null);
    setCustomImageUrl('');
  }

  async function storeImage(productId: string, imageUrl: string) {
    setStoringImage(prev => new Set(prev).add(productId));
    try {
      const res = await fetch('/api/admin/store-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProducts(prev => prev.map(p =>
        p.id === productId ? { ...p, image_url: data.storedUrl, image_approved: true } as Product : p
      ));
      setImagePickerOpen(null);
    } catch (err: any) {
      alert(`Store image failed: ${err.message ?? err}`);
    } finally {
      setStoringImage(prev => { const n = new Set(prev); n.delete(productId); return n; });
    }
  }

  async function fixAllLinks() {
    setFixingLinks(true);
    try {
      const res = await fetch('/api/admin/products/fix-links', { method: 'POST' });
      const result = await res.json();
      alert(`Fixed ${result.fixed} product(s), ${result.searchUrlsRemoved} search URL(s) removed, ${result.unchanged} unchanged.`);
      if (result.fixed > 0) window.location.reload();
    } catch (err) {
      console.error('Fix links failed', err);
    } finally {
      setFixingLinks(false);
    }
  }

  async function findDuplicates() {
    setFindingDupes(true);
    try {
      const res = await fetch('/api/admin/products/duplicates');
      const data = await res.json();
      setDupClusters(data.clusters ?? []);
    } catch (err) {
      console.error('Find duplicates failed', err);
    } finally {
      setFindingDupes(false);
    }
  }

  async function mergeDuplicate(keepId: string, removeIds: string[]) {
    setMergingDupe(keepId);
    try {
      const res = await fetch('/api/admin/products/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keep_id: keepId, remove_ids: removeIds }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Remove merged products from local state
      const removedSet = new Set(removeIds);
      setProducts(prev => prev.filter(p => !removedSet.has(p.id)));
      setDupClusters(prev => prev?.filter(c => !c.products.some((p: any) => p.id === keepId)) ?? null);
    } catch (err) {
      console.error('Merge failed', err);
    } finally {
      setMergingDupe(null);
    }
  }

  async function auditLinks() {
    setAuditing(true);
    try {
      const res = await fetch('/api/admin/products/audit-links');
      const data = await res.json();
      setAuditResults(data);
    } catch (err) {
      console.error('Audit failed', err);
    } finally {
      setAuditing(false);
    }
  }

  async function fixAuditedLinks(ids: string[]) {
    setFixingAudit(true);
    try {
      const res = await fetch('/api/admin/products/audit-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      alert(`Fixed ${data.total} product(s): ${data.results.map((r: any) => `${r.name}: ${r.status}`).join(', ')}`);
      setAuditResults(null);
      window.location.reload();
    } catch (err) {
      console.error('Fix audit failed', err);
    } finally {
      setFixingAudit(false);
    }
  }

  const totalScore = (p: Product) =>
    p.scores ? Object.values(p.scores).reduce((a, b) => a + b, 0) : null;

  const allSelected = paginatedProducts.length > 0 && paginatedProducts.every(p => selected.has(p.id));

  const tabs: { key: StatusTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'live', label: 'Live', count: counts.live },
    { key: 'rejected', label: 'Rejected', count: counts.rejected },
    { key: 'needs_image', label: 'Needs Image', count: counts.needsImage },
    { key: 'suggestions', label: 'Suggestions', count: counts.suggestions },
  ];

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-0 border-b border-charcoal overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-xs font-sans font-bold uppercase tracking-widest transition-colors border-b-2 whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-orange text-orange'
                : 'border-transparent text-charcoal-400 hover:text-ink'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* ---- SUGGESTIONS TAB ---- */}
      {activeTab === 'suggestions' && (
        <SuggestionsPanel suggestions={suggestions} setSuggestions={setSuggestions} />
      )}

      {/* ---- PRODUCT TABS ---- */}
      {activeTab !== 'suggestions' && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {selected.size > 0 ? (
                <>
                  <span className="text-xs font-sans text-charcoal-400">{selected.size} selected</span>
                  <button
                    onClick={() => bulkAction('approved')}
                    className="px-4 py-1.5 bg-orange text-paper text-xs font-bold uppercase tracking-widest hover:bg-orange/90 transition-colors"
                  >
                    Approve {selected.size}
                  </button>
                  <button
                    onClick={() => bulkAction('rejected')}
                    className="px-4 py-1.5 border border-charcoal text-ink text-xs font-bold uppercase tracking-widest hover:bg-charcoal hover:text-paper transition-colors"
                  >
                    Reject {selected.size}
                  </button>
                  <button
                    onClick={bulkEnrich}
                    className="px-4 py-1.5 bg-charcoal text-paper text-xs font-bold uppercase tracking-widest hover:bg-charcoal-700 transition-colors"
                  >
                    Enrich {selected.size}
                  </button>
                  <button
                    onClick={bulkVerify}
                    disabled={verifying.size > 0}
                    className="px-4 py-1.5 bg-charcoal text-paper text-xs font-bold uppercase tracking-widest hover:bg-charcoal-700 disabled:opacity-50 transition-colors"
                  >
                    {verifying.size > 0 ? 'Verifying...' : `Verify Links ${selected.size}`}
                  </button>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="px-3 py-1.5 text-xs text-charcoal-400 hover:text-ink transition-colors"
                  >
                    Clear
                  </button>
                </>
              ) : (
                <div />
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Search */}
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name/brand..."
                className="h-9 w-48 px-3 text-sm border border-charcoal focus:border-orange focus:outline-none"
              />
              {/* Column picker */}
              <div className="relative" ref={columnPickerRef}>
                <button
                  onClick={() => setShowColumnPicker(v => !v)}
                  className="h-9 px-3 border border-charcoal text-xs font-bold uppercase tracking-widest hover:bg-charcoal hover:text-paper transition-colors"
                >
                  Columns
                </button>
                {showColumnPicker && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-charcoal shadow-lg z-30 p-3 w-48 space-y-1">
                    {ALL_COLUMNS.filter(c => !c.alwaysOn).map(col => (
                      <label key={col.key} className="flex items-center gap-2 text-xs font-sans cursor-pointer hover:bg-ghost px-1 py-0.5">
                        <input
                          type="checkbox"
                          checked={visibleColumns.has(col.key)}
                          onChange={() => toggleColumn(col.key)}
                          className="accent-orange"
                        />
                        {col.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowLinkFixer(v => !v)}
                className={`h-9 px-3 border text-xs font-bold uppercase tracking-widest transition-colors ${
                  showLinkFixer
                    ? 'bg-orange text-paper border-orange'
                    : 'border-charcoal hover:bg-charcoal hover:text-paper'
                }`}
                title="Scan, search & fix affiliate links interactively"
              >
                Fix Links
              </button>
              <button
                onClick={auditLinks}
                disabled={auditing}
                className="h-9 px-3 border border-orange text-orange text-xs font-bold uppercase tracking-widest hover:bg-orange hover:text-paper disabled:opacity-50 transition-colors"
                title="Audit all links for broken URLs"
              >
                {auditing ? '...' : 'Audit Links'}
              </button>
              <button
                onClick={findDuplicates}
                disabled={findingDupes}
                className="h-9 px-3 border border-orange text-orange text-xs font-bold uppercase tracking-widest hover:bg-orange hover:text-paper disabled:opacity-50 transition-colors"
                title="Find duplicate products"
              >
                {findingDupes ? '...' : 'Find Dupes'}
              </button>
              <button
                onClick={() => setShowAddForm(v => !v)}
                className="h-9 px-4 bg-charcoal text-paper text-xs font-bold uppercase tracking-widest hover:bg-charcoal-700 transition-colors"
              >
                + Add
              </button>
            </div>
          </div>

          {/* Add product inline form */}
          {showAddForm && (
            <div className="bg-white border border-charcoal p-4 grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Name *</label>
                <input
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  className="w-full h-9 px-2 text-sm border border-charcoal focus:border-orange focus:outline-none"
                  placeholder="Product name"
                />
              </div>
              <div>
                <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Category *</label>
                <select
                  value={addCategory}
                  onChange={e => setAddCategory(e.target.value)}
                  className="w-full h-9 px-2 text-sm border border-charcoal focus:border-orange focus:outline-none bg-white"
                >
                  {CATEGORIES.filter(c => c.value !== 'all').map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Brand</label>
                <input
                  value={addBrand}
                  onChange={e => setAddBrand(e.target.value)}
                  className="w-full h-9 px-2 text-sm border border-charcoal focus:border-orange focus:outline-none"
                  placeholder="Brand"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddProduct}
                  disabled={isAdding || !addName.trim()}
                  className="flex-1 h-9 px-3 bg-orange text-paper text-xs font-bold uppercase tracking-widest hover:bg-orange/90 disabled:opacity-50 transition-colors"
                >
                  {isAdding ? '...' : 'Save'}
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="h-9 px-3 border border-charcoal text-xs font-bold uppercase tracking-widest hover:bg-charcoal hover:text-paper transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Link Fixer panel */}
          {showLinkFixer && (
            <LinkFixerPanel
              products={products}
              onClose={() => setShowLinkFixer(false)}
              onProductsUpdated={(updates) => {
                setProducts(prev => prev.map(p => {
                  const u = updates.find(u => u.id === p.id);
                  return u ? { ...p, affiliate_links: u.affiliate_links } as Product : p;
                }));
              }}
            />
          )}

          {/* Duplicate clusters panel */}
          {dupClusters !== null && (
            <div className="bg-white border border-orange p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest">
                  {dupClusters.length === 0 ? 'No duplicates found' : `${dupClusters.length} duplicate cluster(s)`}
                </h3>
                <button onClick={() => setDupClusters(null)} className="text-xs text-charcoal-400 hover:text-ink">Close</button>
              </div>
              {dupClusters.map((cluster, ci) => (
                <div key={ci} className="border border-charcoal-200 p-3 space-y-2">
                  <div className="text-2xs text-charcoal-400">
                    Key: <span className="font-mono">{cluster.canonical_key}</span> · Similarity: {(cluster.similarity * 100).toFixed(0)}%
                  </div>
                  {cluster.products.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className={`flex-1 ${p.pipeline_status === 'live' ? 'font-bold' : 'text-charcoal-400'}`}>
                        {p.name} <span className="text-2xs text-charcoal-300">({p.pipeline_status ?? p.status})</span>
                      </span>
                      <button
                        onClick={() => {
                          const removeIds = cluster.products.filter((x: any) => x.id !== p.id).map((x: any) => x.id);
                          mergeDuplicate(p.id, removeIds);
                        }}
                        disabled={mergingDupe === p.id}
                        className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest bg-orange text-paper hover:bg-orange/90 disabled:opacity-50"
                      >
                        {mergingDupe === p.id ? '...' : 'Keep This'}
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Audit links panel */}
          {auditResults !== null && (
            <div className="bg-white border border-orange p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest">
                  Link Audit: {auditResults.products_with_issues} product(s) with issues · {auditResults.total_broken} broken · {auditResults.total_suspicious} suspicious
                </h3>
                <div className="flex gap-2">
                  {auditResults.issues?.length > 0 && (
                    <button
                      onClick={() => fixAuditedLinks(auditResults.issues.map((i: any) => i.id))}
                      disabled={fixingAudit}
                      className="px-3 py-1 text-xs font-bold uppercase tracking-widest bg-orange text-paper hover:bg-orange/90 disabled:opacity-50"
                    >
                      {fixingAudit ? 'Fixing...' : 'Fix All'}
                    </button>
                  )}
                  <button onClick={() => setAuditResults(null)} className="text-xs text-charcoal-400 hover:text-ink">Close</button>
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {(auditResults.issues ?? []).map((issue: any) => (
                  <div key={issue.id} className="border border-charcoal-200 p-2 text-xs">
                    <div className="font-bold">{issue.name}</div>
                    {issue.links.map((link: any, li: number) => (
                      <div key={li} className={`ml-2 ${link.status === 'broken' ? 'text-red-600' : link.status === 'suspicious' ? 'text-amber-600' : 'text-green-600'}`}>
                        {link.status === 'broken' ? '✕' : link.status === 'suspicious' ? '⚠' : '✓'} {link.store}: {link.reason || 'Valid'}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table */}
          {filteredProducts.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-charcoal-200">
              <p className="text-sm font-sans text-charcoal-400">No products match the current filter.</p>
            </div>
          ) : (
            <>
            <div className="overflow-auto max-h-[80vh] border border-charcoal relative">
              <table className="w-full text-sm font-sans border-collapse">
                <thead className="bg-charcoal text-paper text-[10px] uppercase tracking-widest sticky top-0 z-20">
                  <tr>
                    {isCol('checkbox') && (
                      <th className="w-8 px-3 py-2.5 text-center sticky left-0 z-30 bg-charcoal">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={e => {
                            if (e.target.checked) setSelected(new Set(paginatedProducts.map(p => p.id)));
                            else setSelected(new Set());
                          }}
                          className="accent-orange"
                        />
                      </th>
                    )}
                    {isCol('image') && <th className="px-3 py-2.5 text-left w-12">Img</th>}
                    {isCol('name') && <th className="px-3 py-2.5 text-left min-w-[180px]">Name</th>}
                    {isCol('brand') && <th className="px-3 py-2.5 text-left">Brand</th>}
                    {isCol('category') && <th className="px-3 py-2.5 text-left">Category</th>}
                    {isCol('award') && <th className="px-3 py-2.5 text-left">Award</th>}
                    {isCol('score') && <th className="px-3 py-2.5 text-center">Score</th>}
                    {isCol('status') && <th className="px-3 py-2.5 text-center">Status</th>}
                    {isCol('links') && <th className="px-3 py-2.5 text-center">Links</th>}
                    {isCol('img_status') && <th className="px-3 py-2.5 text-center">Img Status</th>}
                    {isCol('summary') && <th className="px-3 py-2.5 text-left">Summary</th>}
                    {isCol('specs') && <th className="px-3 py-2.5 text-left">Specs</th>}
                    {isCol('prices') && <th className="px-3 py-2.5 text-center">Prices</th>}
                    {isCol('lifespan') && <th className="px-3 py-2.5 text-center">Lifespan</th>}
                    {isCol('actions') && <th className="px-3 py-2.5 text-right sticky right-0 z-30 bg-charcoal">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.map((product, i) => {
                    const rowEdits = edits[product.id] ?? {};
                    const dirty = Object.keys(rowEdits).length > 0;
                    const score = totalScore(product);
                    const affiliateLinks = product.affiliate_links ?? [];
                    const hasSearchUrl = affiliateLinks.some(l => isSearchUrl(l.url));
                    const isEnriching = enriching.has(product.id);
                    const isVerifying = verifying.has(product.id);
                    const candidates = product.image_candidates ?? [];

                    return (
                      <Fragment key={product.id}>
                        <tr
                          className={`border-t border-charcoal-200 ${i % 2 === 0 ? 'bg-white' : 'bg-paper'} ${selected.has(product.id) ? 'ring-1 ring-inset ring-orange' : ''}`}
                        >
                          {/* Checkbox */}
                          {isCol('checkbox') && (
                            <td className={`px-3 py-2 text-center sticky left-0 z-10 ${i % 2 === 0 ? 'bg-white' : 'bg-paper'}`}>
                              <input
                                type="checkbox"
                                checked={selected.has(product.id)}
                                onChange={e => {
                                  setSelected(prev => {
                                    const n = new Set(prev);
                                    if (e.target.checked) n.add(product.id);
                                    else n.delete(product.id);
                                    return n;
                                  });
                                }}
                                className="accent-orange"
                              />
                            </td>
                          )}

                          {/* Image */}
                          {isCol('image') && (
                            <td className="px-3 py-2">
                              <div className="relative group w-10 h-10">
                                {(rowEdits.image_url ?? product.image_url) ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={rowEdits.image_url ?? product.image_url ?? ''}
                                    alt=""
                                    className="w-10 h-10 object-cover border border-charcoal-200"
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-ghost border border-charcoal-200 flex items-center justify-center text-[10px] text-charcoal-400">?</div>
                                )}
                                <input
                                  type="text"
                                  value={rowEdits.image_url ?? product.image_url ?? ''}
                                  onChange={e => setField(product.id, 'image_url', e.target.value)}
                                  className="absolute inset-0 opacity-0 group-hover:opacity-100 w-full h-full text-[9px] p-0.5 border border-orange bg-white z-10"
                                  placeholder="Image URL"
                                  title="Edit image URL"
                                />
                              </div>
                            </td>
                          )}

                          {/* Name */}
                          {isCol('name') && (
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={rowEdits.name ?? product.name}
                                onChange={e => setField(product.id, 'name', e.target.value)}
                                className="w-full h-8 px-2 text-sm font-serif font-bold border border-transparent hover:border-charcoal-200 focus:border-orange focus:outline-none bg-transparent"
                              />
                            </td>
                          )}

                          {/* Brand */}
                          {isCol('brand') && (
                            <td className="px-3 py-2 text-charcoal-400 text-xs whitespace-nowrap">{product.brand}</td>
                          )}

                          {/* Category */}
                          {isCol('category') && (
                            <td className="px-3 py-2">
                              <span className="px-2 py-0.5 text-[9px] font-sans uppercase tracking-widest bg-ghost text-charcoal border border-charcoal-200">
                                {product.category}
                              </span>
                            </td>
                          )}

                          {/* Award */}
                          {isCol('award') && (
                            <td className="px-3 py-2">
                              <select
                                value={rowEdits.award_type ?? product.award_type ?? 'none'}
                                onChange={e => setField(product.id, 'award_type', e.target.value as AwardType | 'none')}
                                className="h-7 px-1 text-xs border border-charcoal-200 focus:border-orange focus:outline-none bg-transparent"
                              >
                                {AWARD_OPTIONS.map(o => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            </td>
                          )}

                          {/* Score */}
                          {isCol('score') && (
                            <td className="px-3 py-2 text-center">
                              {score !== null ? (
                                <span className={`font-bold ${score >= 80 ? 'text-green-600' : score >= 60 ? 'text-orange' : 'text-charcoal-400'}`}>
                                  {score}
                                </span>
                              ) : (
                                <span className="text-charcoal-400">–</span>
                              )}
                            </td>
                          )}

                          {/* Status */}
                          {isCol('status') && (
                            <td className="px-3 py-2 text-center">
                              <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest border ${
                                product.pipeline_status === 'live'
                                  ? 'bg-green-50 text-green-700 border-green-300'
                                  : product.pipeline_status === 'pending_review'
                                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                                    : 'bg-gray-100 text-gray-500 border-gray-300'
                              }`}>
                                {product.pipeline_status === 'pending_review' ? 'pending' : product.pipeline_status}
                              </span>
                            </td>
                          )}

                          {/* Links */}
                          {isCol('links') && (
                            <td className="px-3 py-2 text-center">
                              {affiliateLinks.length === 0 ? (
                                <span className="text-charcoal-400 text-xs">–</span>
                              ) : hasSearchUrl ? (
                                <span title="Search URL detected" className="text-amber-500 text-base">⚠</span>
                              ) : (
                                <span className="text-green-600 text-xs">✓</span>
                              )}
                            </td>
                          )}

                          {/* Image Status */}
                          {isCol('img_status') && (
                            <td className="px-3 py-2 text-center">
                              {product.image_approved ? (
                                <span className="text-green-600 text-xs font-bold">✓</span>
                              ) : candidates.length > 0 ? (
                                <button
                                  onClick={() => setImagePickerOpen(imagePickerOpen === product.id ? null : product.id)}
                                  className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100 transition-colors"
                                >
                                  {candidates.length} pick
                                </button>
                              ) : (
                                <span className="text-charcoal-400 text-xs">–</span>
                              )}
                            </td>
                          )}

                          {/* Summary */}
                          {isCol('summary') && (
                            <td className="px-3 py-2 text-xs text-charcoal-400 max-w-[200px] truncate">
                              {product.summary || '–'}
                            </td>
                          )}

                          {/* Specs */}
                          {isCol('specs') && (
                            <td className="px-3 py-2 text-xs text-charcoal-400 max-w-[200px] truncate">
                              {product.specs ? Object.entries(product.specs).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join(', ') : '–'}
                            </td>
                          )}

                          {/* Prices */}
                          {isCol('prices') && (
                            <td className="px-3 py-2 text-center text-xs">
                              {product.price_inr ? `₹${product.price_inr}` : ''}{product.price_inr && product.price_usd ? ' / ' : ''}{product.price_usd ? `$${product.price_usd}` : ''}{!product.price_inr && !product.price_usd ? '–' : ''}
                            </td>
                          )}

                          {/* Lifespan */}
                          {isCol('lifespan') && (
                            <td className="px-3 py-2 text-center text-xs">
                              {product.estimated_lifespan_years ? `${product.estimated_lifespan_years}y` : '–'}
                              {product.estimated_lifespan_multiplier ? ` (${product.estimated_lifespan_multiplier}x)` : ''}
                            </td>
                          )}

                          {/* Actions */}
                          {isCol('actions') && (
                            <td className={`px-3 py-2 text-right whitespace-nowrap sticky right-0 z-10 ${i % 2 === 0 ? 'bg-white' : 'bg-paper'}`}>
                              <div className="flex items-center justify-end gap-1">
                                {dirty && (
                                  <button
                                    onClick={() => saveRow(product.id)}
                                    disabled={saving[product.id]}
                                    className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest bg-charcoal text-paper hover:bg-charcoal-700 disabled:opacity-50 transition-colors"
                                  >
                                    {saving[product.id] ? '...' : '↑ Save'}
                                  </button>
                                )}
                                <button
                                  onClick={() => enrichSingle(product.id)}
                                  disabled={isEnriching}
                                  className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest border border-charcoal-200 hover:border-orange hover:text-orange disabled:opacity-50 transition-colors"
                                  title="AI Enrich"
                                >
                                  {isEnriching ? '...' : '❖'}
                                </button>
                                <button
                                  onClick={() => verifySingle(product.id)}
                                  disabled={isVerifying}
                                  className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest border border-charcoal-200 hover:border-blue-500 hover:text-blue-600 disabled:opacity-50 transition-colors"
                                  title="Verify Links &amp; Images via Gemini"
                                >
                                  {isVerifying ? '...' : '⟳'}
                                </button>
                                <button
                                  onClick={() => toggleFeature(product.id)}
                                  className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest border transition-colors ${
                                    product.featured_until && new Date(product.featured_until) > new Date()
                                      ? 'border-orange bg-orange text-paper hover:bg-orange/80'
                                      : 'border-charcoal-200 hover:border-orange hover:text-orange'
                                  }`}
                                  title={product.featured_until && new Date(product.featured_until) > new Date()
                                    ? `Featured until ${new Date(product.featured_until).toLocaleDateString()}`
                                    : 'Feature for 7 days'}
                                >
                                  ★
                                </button>
                                <Link
                                  href={`/admin/products/${product.id}/edit`}
                                  className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest border border-charcoal-200 hover:border-charcoal hover:bg-charcoal hover:text-paper transition-colors"
                                >
                                  Edit
                                </Link>
                                {product.pipeline_status !== 'live' && (
                                  <button
                                    onClick={() => approveProduct(product.id)}
                                    className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest bg-orange text-paper hover:bg-orange/90 transition-colors"
                                  >
                                    ✓
                                  </button>
                                )}
                                {product.pipeline_status !== 'rejected' && (
                                  <button
                                    onClick={() => rejectProduct(product.id)}
                                    className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest border border-charcoal-200 text-charcoal hover:bg-charcoal hover:text-paper transition-colors"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>

                        {/* Image picker row */}
                        {imagePickerOpen === product.id && candidates.length > 0 && (
                          <tr className="border-t border-charcoal-200 bg-paper-dark">
                            <td colSpan={ALL_COLUMNS.filter(c => visibleColumns.has(c.key)).length} className="p-4">
                              <div className="space-y-3">
                                <p className="text-xs font-sans font-bold uppercase tracking-widest text-charcoal-400">
                                  Pick image for {product.name}
                                </p>
                                <div className="flex gap-3 flex-wrap">
                                  {candidates.map((url, ci) => (
                                    <button
                                      key={ci}
                                      onClick={() => pickImage(product.id, url)}
                                      className="relative w-24 h-24 border border-charcoal-200 hover:border-orange transition-colors overflow-hidden group"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={url} alt="" className="w-full h-full object-cover" />
                                      {ci === 0 && (
                                        <span className="absolute top-0 left-0 bg-orange text-paper text-[8px] px-1 py-0.5 font-bold">AI</span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                                <div className="flex gap-2 items-center flex-wrap max-w-lg">
                                  <input
                                    type="text"
                                    value={customImageUrl}
                                    onChange={e => setCustomImageUrl(e.target.value)}
                                    placeholder="Custom image URL..."
                                    className="flex-1 min-w-[150px] h-8 px-2 text-xs border border-charcoal focus:border-orange focus:outline-none"
                                  />
                                  <button
                                    onClick={() => customImageUrl.trim() && pickImage(product.id, customImageUrl.trim())}
                                    disabled={!customImageUrl.trim()}
                                    className="h-8 px-3 bg-charcoal text-paper text-[10px] font-bold uppercase tracking-widest hover:bg-charcoal-700 disabled:opacity-50 transition-colors"
                                  >
                                    Use Custom
                                  </button>
                                  {product.image_url && (
                                    <button
                                      onClick={() => storeImage(product.id, product.image_url!)}
                                      disabled={storingImage.has(product.id)}
                                      className="h-8 px-3 bg-orange text-paper text-[10px] font-bold uppercase tracking-widest hover:bg-orange/90 disabled:opacity-50 transition-colors"
                                      title="Download current image and store permanently"
                                    >
                                      {storingImage.has(product.id) ? 'Storing...' : '⬇ Store Current'}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { setImagePickerOpen(null); setCustomImageUrl(''); }}
                                    className="h-8 px-2 text-xs text-charcoal-400 hover:text-ink"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-2 bg-white border border-t-0 border-charcoal text-xs font-sans text-charcoal-400">
              <div className="flex items-center gap-2">
                <span>Show</span>
                {[25, 50, 0].map(size => (
                  <button
                    key={size}
                    onClick={() => { setPageSize(size); setCurrentPage(0); }}
                    className={`px-2 py-0.5 border transition-colors ${pageSize === size ? 'bg-charcoal text-paper border-charcoal' : 'border-charcoal-200 hover:border-charcoal'}`}
                  >
                    {size === 0 ? 'All' : size}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span>{filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}</span>
                {pageSize > 0 && totalPages > 1 && (
                  <>
                    <span className="text-charcoal-200">|</span>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                      className="px-2 py-0.5 border border-charcoal-200 hover:border-charcoal disabled:opacity-30 transition-colors"
                    >
                      ←
                    </button>
                    <span>{currentPage + 1} / {totalPages}</span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={currentPage >= totalPages - 1}
                      className="px-2 py-0.5 border border-charcoal-200 hover:border-charcoal disabled:opacity-30 transition-colors"
                    >
                      →
                    </button>
                  </>
                )}
              </div>
            </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SuggestionsPanel({
  suggestions,
  setSuggestions,
}: {
  suggestions: SuggestionRow[];
  setSuggestions: React.Dispatch<React.SetStateAction<SuggestionRow[]>>;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('kitchen');
  const [priority, setPriority] = useState('1');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), category, priority: Number(priority), notes: notes.trim() || null }),
      });
      if (res.ok) {
        const row = await res.json();
        setSuggestions(prev => [row, ...prev]);
        setName(''); setNotes('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function markDone(id: string) {
    await fetch(`/api/admin/suggestions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });
    setSuggestions(prev => prev.filter(s => s.id !== id));
  }

  async function deleteSuggestion(id: string) {
    await fetch(`/api/admin/suggestions/${id}`, { method: 'DELETE' });
    setSuggestions(prev => prev.filter(s => s.id !== id));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      {/* Form */}
      <div className="lg:col-span-1 bg-white p-6 border border-charcoal shadow-card">
        <h2 className="font-sans font-bold text-sm tracking-wide uppercase border-b border-ghost pb-2 mb-4">Add to Queue</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Product Name / Prompt</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full h-10 px-3 text-sm border border-charcoal focus:border-orange focus:outline-none"
              placeholder="e.g. Herman Miller Aeron"
            />
          </div>
          <div>
            <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Target Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              required
              className="w-full h-10 px-3 text-sm border border-charcoal focus:border-orange focus:outline-none bg-white"
            >
              {CATEGORIES.filter(c => c.value !== 'all').map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
              <option value="other">Other / General</option>
            </select>
          </div>
          <div>
            <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Priority (1-3)</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-charcoal focus:border-orange focus:outline-none bg-white"
            >
              <option value="1">1 - Standard</option>
              <option value="2">2 - High</option>
              <option value="3">3 - Urgent/Next Run</option>
            </select>
          </div>
          <div>
            <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Additional Guidance</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full h-20 p-2 text-sm border border-charcoal focus:border-orange focus:outline-none resize-none"
              placeholder="Make sure it evaluates the 2024 model year..."
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-10 bg-orange text-paper font-sans uppercase text-xs tracking-widest font-bold hover:bg-orange/90 disabled:opacity-50 transition-colors shadow-[4px_4px_0px_0px_#121212] active:translate-y-0.5 active:shadow-none"
          >
            {submitting ? 'Submitting...' : 'Submit to Queue'}
          </button>
        </form>
      </div>

      {/* List */}
      <div className="lg:col-span-2 space-y-4">
        {suggestions.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-charcoal-200">
            <p className="text-sm font-sans text-charcoal-400">No pending suggestions.</p>
          </div>
        ) : (
          suggestions.map(item => (
            <div
              key={item.id}
              className="p-4 border border-charcoal flex flex-col sm:flex-row justify-between gap-4 bg-white"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 text-[9px] font-sans uppercase tracking-widest text-paper ${item.priority === 3 ? 'bg-orange' : item.priority === 2 ? 'bg-charcoal' : 'bg-charcoal-400'}`}>
                    Priority {item.priority}
                  </span>
                  <span className="text-[10px] font-sans uppercase tracking-widest text-charcoal-400 px-2 border border-charcoal-200">
                    {item.category}
                  </span>
                </div>
                <h3 className="font-serif font-bold text-lg text-ink">{item.name}</h3>
                {item.notes && <p className="text-xs text-charcoal-400 mt-1">{item.notes}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => markDone(item.id)}
                  className="px-3 py-1.5 border border-charcoal text-xs font-bold uppercase hover:bg-charcoal hover:text-paper transition-colors"
                >
                  Mark Done
                </button>
                <button
                  onClick={() => deleteSuggestion(item.id)}
                  className="px-3 py-1.5 text-xs text-orange hover:underline font-bold"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
