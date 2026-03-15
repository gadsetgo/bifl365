'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ProductCard } from '@/components/ProductCard';
import { CategoryStrip } from '@/components/CategoryStrip';
import type { Product, CategoryType } from '@/lib/types';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryType | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let q = supabase.from('products').select('*').eq('status', 'published').order('created_at', { ascending: false });
      if (activeCategory !== 'all') q = q.eq('category', activeCategory);
      const { data } = await q;
      setProducts(data ?? []);
      setLoading(false);
    }
    load();
  }, [activeCategory]);

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
        {/* Category filter */}
        <div className="mb-8 pb-4 border-b border-ghost">
          <CategoryStrip activeCategory={activeCategory} onSelect={setActiveCategory} />
        </div>

        {/* Count */}
        {!loading && (
          <div className="mb-4 flex items-center justify-between">
            <span className="section-label">{products.length} product{products.length !== 1 ? 's' : ''}</span>
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
