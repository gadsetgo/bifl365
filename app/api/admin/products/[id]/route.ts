import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { supabase } from '@/lib/supabase';
import { deleteProductImages } from '@/lib/storage';

const UPDATABLE_FIELDS = new Set([
  'name',
  'summary',
  'description_draft',
  'award_type',
  'pipeline_status',
  'admin_notes',
  'image_url',
  'image_approved',
  'reviewed_at',
  'video_url',
  'status',
  'brand',
  'price_inr',
  'price_usd',
  'scores',
  'specs',
  'affiliate_links',
  'reddit_sentiment',
  'estimated_lifespan_years',
  'estimated_lifespan_multiplier',
  'is_featured',
  'week_of',
]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;
  try {
    const raw = await request.json() as Record<string, unknown>;

    // Strip keys not in the allowlist
    const body: Record<string, unknown> = {};
    for (const key of Object.keys(raw)) {
      if (UPDATABLE_FIELDS.has(key)) body[key] = raw[key];
    }

    if (Object.keys(body).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('products')
      .update(body as never)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // When rejecting a product, delete its images from Supabase Storage
    if (body.pipeline_status === 'rejected' || body.status === 'rejected') {
      await deleteProductImages(id);
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return new NextResponse(error.message, { status: 500 });
  }
}

