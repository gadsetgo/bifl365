import { createClient } from '@supabase/supabase-js';

/**
 * Delete all images for a product from Supabase Storage
 * and clear image fields on the product row.
 */
export async function deleteProductImages(productId: string) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceKey || !supabaseUrl) return;

    const sb = createClient(supabaseUrl, serviceKey);
    const { data: files } = await sb.storage.from('product-images').list(productId);
    if (files && files.length > 0) {
      const paths = files.map(f => `${productId}/${f.name}`);
      await sb.storage.from('product-images').remove(paths);
    }

    await sb.from('products').update({
      image_url: null,
      image_candidates: null,
      image_approved: false,
    } as never).eq('id', productId);
  } catch (err) {
    console.warn(`Failed to delete images for ${productId}:`, err);
  }
}
