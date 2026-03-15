import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import type { ProductInsert } from '@/lib/types';

export async function POST(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get('Authorization');
  const expectedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let products: ProductInsert[];
  try {
    products = await request.json();
    if (!Array.isArray(products)) throw new Error('Expected array');
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body — expected array' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const results = await Promise.allSettled(
    products.map(async (product) => {
      const { data, error } = await supabase
        .from('products')
        .upsert(product, { onConflict: 'name,week_of', ignoreDuplicates: false })
        .select('id, name')
        .single();
      if (error) throw error;
      return data;
    })
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results
    .filter((r) => r.status === 'rejected')
    .map((r, i) => ({ index: i, error: (r as PromiseRejectedResult).reason?.message }));

  return NextResponse.json({ succeeded, failed, total: products.length });
}
