import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabase } from '@/lib/supabase';
import { enrichProduct } from '@/lib/pipeline-scoring';
import type { Product } from '@/lib/types';

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const body = await request.json();
    const { ids, provider = 'gemini' } = body as {
      ids: string[];
      provider?: 'gemini' | 'claude';
    };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array required' }, { status: 400 });
    }

    if (ids.length > 20) {
      return NextResponse.json({ error: 'Maximum 20 products per request' }, { status: 400 });
    }

    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .in('id', ids);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const results: { id: string; status: 'ok' | 'error'; data?: any; error?: string }[] = [];

    for (const product of (products as Product[])) {
      try {
        const enrichment = await enrichProduct(
          { name: product.name, brand: product.brand, category: product.category },
          provider
        );

        const updates = {
          scores: enrichment.scores,
          specs: enrichment.specs,
          award_type: enrichment.award_type,
          summary: enrichment.summary,
          reddit_sentiment: enrichment.reddit_sentiment,
          estimated_lifespan_years: enrichment.estimated_lifespan_years,
          estimated_lifespan_multiplier: enrichment.estimated_lifespan_multiplier,
          is_featured: enrichment.is_featured,
        };

        const { error: updateError } = await supabase
          .from('products')
          .update(updates as never)
          .eq('id', product.id);

        if (updateError) throw new Error(updateError.message);

        results.push({ id: product.id, status: 'ok', data: updates });
      } catch (err: any) {
        results.push({ id: product.id, status: 'error', error: err.message ?? 'Unknown error' });
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Enrichment failed' }, { status: 500 });
  }
}
