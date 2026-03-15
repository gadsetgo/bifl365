'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ProductCard } from '@/components/ProductCard';
import { CompactFilterBar } from '@/components/CompactFilterBar';
import type { Product, CategoryType, AwardType } from '@/lib/types';

type WeekFilter = 'all' | 'this_week' | 'previous_weeks';

export const dynamic = 'force-dynamic';

function ProductsPageInner() {
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryType | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [latestWeek, setLatestWeek] = useState<string | null>(null);

  const initialAward = (searchParams.get('award') as AwardType | null) ?? null;
  const categoryParam = searchParams.get('category') as CategoryType | null;
  const timeParam = (searchParams.get('time') as WeekFilter | null) ?? null;
  const searchParam = searchParams.get('search') ?? '';

  const [awardFilter, setAwardFilter] = useState<AwardType | 'all'>(initialAward ?? 'all');
  const [weekFilter, setWeekFilter] = useState<WeekFilter>(timeParam ?? 'all');
  const [searchQuery, setSearchQuery] = useState(searchParam);

  useEffect(() => {
    if (categoryParam && activeCategory === 'all') {
      setActiveCategory(categoryParam);
    }
  }, [categoryParam, activeCategory]);

  useEffect(() => {
    setSearchQuery(searchParam);
  }, [searchParam]);

  // Fetch the most recent week_of to support "This Week" / "Previous Weeks" filters
  useEffect(() => {
    async function loadLatestWeek() {
      const { data } = await supabase
        .from('products')
        .select('week_of')
        .eq('status', 'published')
        .not('week_of', 'is', null)
        .order('week_of', { ascending: false })
        .limit(1)
        .maybeSingle();

      const row = data as { week_of: string | null } | null;
      setLatestWeek(row?.week_of ?? null);
    }

    loadLatestWeek();
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let q = supabase
        .from('products')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (activeCategory !== 'all') {
        q = q.eq('category', activeCategory);
      }

      if (awardFilter !== 'all') {
        q = q.eq('award_type', awardFilter);
      }

      if (latestWeek && weekFilter === 'this_week') {
        q = q.eq('week_of', latestWeek);
      } else if (latestWeek && weekFilter === 'previous_weeks') {
        q = q.lt('week_of', latestWeek);
      }

      const { data } = await q;
    //  let filteredProducts = data ?? [];
    let filteredProducts: Product[] = (data ?? []) as Product[];
    
      // Client-side search filtering (name, brand, category)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        filteredProducts = filteredProducts.filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.brand.toLowerCase().includes(query) ||
            p.category.toLowerCase().includes(query) ||
            (p.summary && p.summary.toLowerCase().includes(query))
        );
      }

      setProducts(filteredProducts);
      setLoading(false);
    }
    load();
  }, [activeCategory, awardFilter, weekFilter, latestWeek, searchQuery]);

  return (
    <div className="bg-paper min-h-screen">
      {/* Page header */}
      <div className="border-b border-charcoal bg-charcoal text-paper">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <span className="section-label text-charcoal-400 block mb-2">BIFL Product Library</span>
          <h1 className="font-serif font-black text-4xl text-paper">All Products</h1>
          <p className="text-sm font-sans text-charcoal-200 mt-2">
            AI-scored and categorised for Indian buyers. Use the filter to browse by category.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Compact filter bar - all filters in one line */}
        <div className="mb-6 pb-4 border-b border-ghost">
          <CompactFilterBar
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            awardFilter={awardFilter}
            onAwardChange={setAwardFilter}
            weekFilter={weekFilter}
            onWeekChange={setWeekFilter}
          />
        </div>

        {/* Count + active filters */}
        {!loading && (
          <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
            <span className="section-label">
              {products.length} product{products.length !== 1 ? 's' : ''}
              {searchQuery && ` matching "${searchQuery}"`}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search query display */}
              {searchQuery && (
                <span className="text-2xs font-sans uppercase tracking-widest px-3 py-1 border border-charcoal bg-paper-dark">
                  Search: {searchQuery}
                </span>
              )}
              {/* Award filter summary */}
              {awardFilter !== 'all' && (
                <span className="text-2xs font-sans uppercase tracking-widest px-3 py-1 border border-charcoal bg-paper-dark">
                  Award: {awardFilter === 'best_buy' ? 'Best Buy' : awardFilter === 'forever_pick' ? 'Forever Pick' : 'Hidden Gem'}
                </span>
              )}
              {/* Week filter summary */}
              {weekFilter !== 'all' && (
                <span className="text-2xs font-sans uppercase tracking-widest px-3 py-1 border border-charcoal bg-paper-dark">
                  {weekFilter === 'this_week' ? 'This Week' : 'Previous Weeks'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-80 border border-ghost bg-paper-dark animate-pulse"
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-20 text-center border border-charcoal">
            <p className="font-serif font-bold text-xl text-ink mb-2">No products yet</p>
            <p className="text-xs font-sans text-charcoal-400">
              Run <code className="bg-paper-dark px-1 border border-ghost">npm run seed</code> or the weekly pipeline to populate products.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="bg-paper min-h-screen" />}>
      <ProductsPageInner />
    </Suspense>
  );
}
