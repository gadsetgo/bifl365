import { supabase } from '@/lib/supabase';
import { ReviewClient } from './ReviewClient';

export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('pipeline_status', 'pending_review')
    .order('created_at', { ascending: true });

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="font-serif font-black text-3xl text-ink">Pipeline Review Queue</h1>
        <p className="text-sm font-sans text-charcoal-400 mt-2">
          {products?.length || 0} products awaiting approval. Press <kbd className="bg-charcoal-200 px-1 rounded text-ink">A</kbd> to approve, <kbd className="bg-charcoal-200 px-1 rounded text-ink">R</kbd> to reject.
        </p>
      </div>

      <ReviewClient initialProducts={products || []} />
    </div>
  );
}
