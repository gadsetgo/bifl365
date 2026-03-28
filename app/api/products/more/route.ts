import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offset = Math.max(0, Number(searchParams.get('offset') ?? 6));
  const limit = Math.min(24, Math.max(1, Number(searchParams.get('limit') ?? 12)));

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const products = (data ?? []) as Product[];

  return NextResponse.json({
    products,
    hasMore: products.length === limit,
  });
}
