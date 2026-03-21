'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ProductCard } from '@/components/ProductCard';
import type { Product, CategoryType, AwardType } from '@/lib/types';

type WeekFilter = 'all' | 'this_week' | 'previous_weeks';

export const dynamic = 'force-dynamic';

function ProductsPageInner() {
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestWeek, setLatestWeek] = useState<string | null>(null);

  const awardFilter = (searchParams.get('award') as AwardType | 'all') ?? 'all';
  const categoryFilter = (searchParams.get('category') as CategoryType | 'all') ?? 'all';
  const weekFilter = (searchParams.get('time') as WeekFilter | null) ?? 'all';
  const searchQuery = searchParams.get('search') ?? '';

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

      if (categoryFilter !== 'all') {
        q = q.eq('category', categoryFilter);
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
  }, [categoryFilter, awardFilter, weekFilter, latestWeek, searchQuery]);

  return (
    <div className="bg-paper min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Count + active filters (compact breadcrumb) */}
        {!loading && (
          <div className="mb-4 flex items-center justify-between gap-3 flex-wrap border-b border-ghost pb-3">
            <span className="section-label">
              {products.length} product{products.length !== 1 ? 's' : ''}
              {searchQuery && ` matching "${searchQuery}"`}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search query display */}
              {searchQuery && (
                <span className="text-2xs font-sans uppercase tracking-widest px-3 py-1 bg-charcoal text-paper rounded">
                  Search: {searchQuery}
                </span>
              )}
              {/* Award filter summary */}
              {awardFilter !== 'all' && (
                <span className="text-2xs font-sans uppercase tracking-widest px-3 py-1 bg-charcoal text-paper rounded">
                  Award: {awardFilter.replace('_', ' ')}
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
                className="h-80 border border-gray-100 rounded-2xl bg-white shadow-card animate-pulse"
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-20 text-center border border-charcoal rounded-2xl bg-white">
            <p className="font-serif font-bold text-xl text-ink mb-2">No products found</p>
            <p className="text-xs font-sans text-charcoal-400">
              Try adjusting your filters in the header.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
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
