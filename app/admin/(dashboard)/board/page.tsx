import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { BoardClient } from './BoardClient';
import type { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

type SuggestionRow = {
  id: string;
  name: string;
  category: string;
  notes: string | null;
  priority: number;
  status: string;
  created_at: string;
};

export default async function BoardPage() {
  const [productsResult, suggestionsResult] = await Promise.all([
    supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('product_suggestions')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false }),
  ]);

  const products = (productsResult.data ?? []) as Product[];
  const suggestions = (suggestionsResult.data ?? []) as unknown as SuggestionRow[];

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="font-serif font-black text-3xl text-ink">Products</h1>
        <p className="text-sm font-sans text-charcoal-400 mt-1">
          Manage, enrich, and approve all products.
        </p>
      </div>
      <Suspense>
        <BoardClient initialProducts={products} initialSuggestions={suggestions} />
      </Suspense>
    </div>
  );
}
