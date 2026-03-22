import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { supabase } from '@/lib/supabase';

const bodySchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  priority: z.number().int().min(1).max(3).default(1),
  notes: z.string().nullable().optional(),
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

    const { data, error } = await supabase
      .from('product_suggestions')
      .insert({ ...parsed.data, status: 'pending' } as never)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
