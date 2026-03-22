import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { supabase } from '@/lib/supabase';

const CATEGORY_VALUES = [
  'kitchen', 'edc', 'home', 'travel', 'tech', 'parenting', 'watches',
] as const;

const bodySchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional(),
  category: z.enum(CATEGORY_VALUES),
  image_url: z.string().url().optional().or(z.literal('')),
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

    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('products')
      .insert({
        name: parsed.data.name,
        brand: parsed.data.brand ?? '',
        category: parsed.data.category,
        image_url: parsed.data.image_url || null,
        pipeline_status: 'pending_review',
        status: 'draft',
        week_of: today,
      } as never)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Create failed' }, { status: 500 });
  }
}
