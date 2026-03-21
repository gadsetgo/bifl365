import { supabase } from '@/lib/supabase';
import { ProductsClient } from './ProductsClient';
import type { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  const { data: raw } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });
  const products = (raw ?? []) as unknown as Product[];

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="font-serif font-black text-3xl text-ink">Product Catalogue</h1>
        <p className="text-sm font-sans text-charcoal-400 mt-2">
          Manage all products, change statuses, or make direct editorial overrides.
        </p>
      </div>

      <ProductsClient initialProducts={products} />
    </div>
  );
}
