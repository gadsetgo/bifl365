import { supabase } from '@/lib/supabase';
import { ImageClient } from './ImageClient';

export const dynamic = 'force-dynamic';

export default async function ImagesPage() {
  const { data: products } = await supabase
    .from('products')
    .select('id, name, summary, category, image_candidates, video_url')
    .eq('image_approved', false)
    .not('image_candidates', 'is', null)
    .order('created_at', { ascending: true });

  // Filter out any products where the array might somehow be empty
  const validProducts = (products || []).filter(p => Array.isArray(p.image_candidates) && p.image_candidates.length > 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="font-serif font-black text-3xl text-ink">Image & Media Queue</h1>
        <p className="text-sm font-sans text-charcoal-400 mt-2">
          {validProducts.length} products waiting for visual approval. The AI pipeline recommends the first image based on resolution and aesthetic fit.
        </p>
      </div>

      <ImageClient initialProducts={validProducts} />
    </div>
  );
}
