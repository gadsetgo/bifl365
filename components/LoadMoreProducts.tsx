'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ProductCard } from './ProductCard';
import type { Product } from '@/lib/types';

const BATCH_SIZE = 12;
const MAX_LOADS = 3;

export function LoadMoreProducts({ initialOffset = 6 }: { initialOffset?: number }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadCount, setLoadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  async function loadMore() {
    setLoading(true);
    try {
      const offset = initialOffset + loadCount * BATCH_SIZE;
      const res = await fetch(`/api/products/more?offset=${offset}&limit=${BATCH_SIZE}`);
      if (!res.ok) return;
      const data = await res.json();
      setProducts(prev => [...prev, ...data.products]);
      setHasMore(data.hasMore);
      setLoadCount(prev => prev + 1);
    } finally {
      setLoading(false);
    }
  }

  const showLoadMore = hasMore && loadCount < MAX_LOADS;
  const showViewAll = !hasMore || loadCount >= MAX_LOADS;

  return (
    <>
      {products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-5">
          {products.map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      <div className="flex justify-center mt-8">
        {showLoadMore && (
          <button
            onClick={loadMore}
            disabled={loading}
            className="btn-ghost border-charcoal text-ink hover:bg-charcoal hover:text-paper disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-charcoal border-t-transparent rounded-full animate-spin" />
                Loading...
              </span>
            ) : (
              'Load More Products'
            )}
          </button>
        )}
        {showViewAll && products.length > 0 && (
          <Link
            href="/products"
            className="section-label hover:text-orange transition-colors text-sm"
          >
            View All Products →
          </Link>
        )}
      </div>
    </>
  );
}
