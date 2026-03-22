import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { supabase } from '@/lib/supabase';

const bodySchema = z.object({
  ids: z.array(z.string()).min(1, 'At least one id required'),
  updates: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const raw = await request.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ errors: parsed.error.issues }, { status: 400 });
    }

    const { ids, updates } = parsed.data;

    const { data, error } = await supabase
      .from('products')
      .update(updates as never)
      .in('id', ids)
      .select('id');

    if (error) throw error;
    return NextResponse.json({ updated: data?.length ?? 0 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Bulk update failed' }, { status: 500 });
  }
}
