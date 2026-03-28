import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { supabase } from '@/lib/supabase';
import type { BlogPost } from '@/lib/types';

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().optional(),
  content: z.string().optional(),
  excerpt: z.string().nullable().optional(),
  cover_image_url: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  status: z.enum(['draft', 'published']).optional(),
  author_name: z.string().optional(),
  meta_title: z.string().nullable().optional(),
  meta_description: z.string().nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updates: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() };

  // Auto-set published_at when publishing
  if (parsed.data.status === 'published') {
    // Only set if not already published
    const { data: existing } = await supabase
      .from('blog_posts')
      .select('published_at')
      .eq('id', id)
      .single();
    if (!(existing as unknown as Record<string, unknown>)?.published_at) {
      updates.published_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .update(updates as never)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data as BlogPost });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { error } = await supabase
    .from('blog_posts')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
