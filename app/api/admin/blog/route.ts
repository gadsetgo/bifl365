import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { supabase } from '@/lib/supabase';
import type { BlogPost } from '@/lib/types';
import { generateSlug, generateExcerpt } from '@/lib/markdown';

const createSchema = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),
  content: z.string().default(''),
  excerpt: z.string().nullable().optional(),
  cover_image_url: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  status: z.enum(['draft', 'published']).default('draft'),
  author_name: z.string().default('BIFL365 Editorial'),
  meta_title: z.string().nullable().optional(),
  meta_description: z.string().nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: (data ?? []) as BlogPost[] });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const input = parsed.data;
  const slug = input.slug?.trim() || generateSlug(input.title);
  const excerpt = input.excerpt ?? (input.content ? generateExcerpt(input.content) : null);

  const record: Record<string, unknown> = {
    title: input.title,
    slug,
    content: input.content,
    excerpt,
    cover_image_url: input.cover_image_url ?? null,
    category: input.category ?? null,
    status: input.status,
    author_name: input.author_name,
    meta_title: input.meta_title ?? null,
    meta_description: input.meta_description ?? null,
  };

  if (input.status === 'published') {
    record.published_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .insert(record as never)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data as BlogPost }, { status: 201 });
}
