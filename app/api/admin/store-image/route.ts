import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { downloadAndValidateImage, uploadImageToStorage } from '@/lib/image-storage';

const bodySchema = z.object({
  productId: z.string().uuid(),
  imageUrl: z.string().url(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const raw = await request.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ errors: parsed.error.issues }, { status: 400 });
    }

    const { productId, imageUrl } = parsed.data;

    // Download and validate
    const result = await downloadAndValidateImage(imageUrl);
    if (!result.valid || !result.buffer || !result.contentType) {
      return NextResponse.json(
        { error: result.reason ?? 'Image validation failed' },
        { status: 422 }
      );
    }

    // Upload to Supabase Storage
    const storedUrl = await uploadImageToStorage(supabase, productId, result.buffer, result.contentType);

    // Update product
    const { error: updateError } = await supabase
      .from('products')
      .update({ image_url: storedUrl, image_approved: true } as never)
      .eq('id', productId);

    if (updateError) {
      return NextResponse.json({ error: `DB update failed: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      storedUrl,
      originalUrl: imageUrl,
      productId,
      dimensions: result.width && result.height ? `${result.width}×${result.height}` : undefined,
      size: result.size,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Store image failed' }, { status: 500 });
  }
}
