import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_featured', true)
    .eq('status', 'published')
    .order('week_of', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'No featured product found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
