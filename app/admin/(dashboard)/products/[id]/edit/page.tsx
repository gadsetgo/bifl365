import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ProductEditClient } from './ProductEditClient';
import type { Product } from '@/lib/types';

type Params = { id: string };

export const dynamic = 'force-dynamic';

export default async function ProductEditPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) notFound();

  return <ProductEditClient product={data as Product} />;
}
