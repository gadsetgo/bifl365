import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  downloadAndValidateImage,
  uploadImageToStorage,
  isStoredUrl,
} from '@/lib/image-storage';

/**
 * Image proxy endpoint.
 * GET /api/image/{productId}
 *
 * - If the product's image is already in Supabase Storage → 302 redirect
 * - If external URL → download, store, update DB, then 302 redirect
 * - If no image → 404
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return new NextResponse('Server misconfigured', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data, error } = await supabase
    .from('products')
    .select('image_url')
    .eq('id', id)
    .single();

  if (error || !data?.image_url) {
    return new NextResponse('Not found', { status: 404 });
  }

  const imageUrl: string = data.image_url;

  // Already stored in Supabase Storage — redirect immediately with cache
  if (isStoredUrl(imageUrl, supabaseUrl)) {
    return NextResponse.redirect(imageUrl, {
      status: 302,
      headers: { 'Cache-Control': 'public, max-age=86400' },
    });
  }

  // External URL — try to download, store, then redirect
  const result = await downloadAndValidateImage(imageUrl);
  if (!result.valid || !result.buffer || !result.contentType) {
    // Can't download/validate — redirect to original as fallback
    return NextResponse.redirect(imageUrl, 302);
  }

  try {
    const storedUrl = await uploadImageToStorage(supabase, id, result.buffer, result.contentType);

    // Update DB so future requests redirect instantly
    await supabase
      .from('products')
      .update({ image_url: storedUrl } as never)
      .eq('id', id);

    return NextResponse.redirect(storedUrl, 302);
  } catch {
    // Storage failed — redirect to original
    return NextResponse.redirect(imageUrl, 302);
  }
}
