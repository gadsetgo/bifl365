import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { supabase } from '@/lib/supabase';

const CATEGORY_VALUES = [
  'kitchen', 'edc', 'home', 'travel', 'tech', 'parenting', 'watches',
] as const;

const AWARD_VALUES = ['value_buy', 'forever_pick', 'hidden_gem', 'current_star'] as const;

const scoresSchema = z.object({
  build_quality: z.number().min(0).max(20),
  longevity: z.number().min(0).max(20),
  value: z.number().min(0).max(20),
  repairability: z.number().min(0).max(20),
  india_availability: z.number().min(0).max(20),
}).nullable().optional();

const specsSchema = z.object({
  material: z.string().optional(),
  warranty: z.string().optional(),
  repairability_score: z.number().optional(),
  made_in: z.string().optional(),
  weight: z.string().optional(),
}).nullable().optional();

const affiliateLinkSchema = z.object({
  store: z.string(),
  url: z.string(),
  is_affiliate: z.boolean(),
});

const bodySchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional(),
  category: z.enum(CATEGORY_VALUES),
  image_url: z.string().url().optional().or(z.literal('')).or(z.null()),
  // Extended fields for full product import
  price_inr: z.number().nullable().optional(),
  price_usd: z.number().nullable().optional(),
  scores: scoresSchema,
  specs: specsSchema,
  award_type: z.enum(AWARD_VALUES).nullable().optional(),
  affiliate_links: z.array(affiliateLinkSchema).nullable().optional(),
  image_candidates: z.array(z.string()).optional(),
  summary: z.string().nullable().optional(),
  reddit_sentiment: z.string().nullable().optional(),
  estimated_lifespan_years: z.number().nullable().optional(),
  estimated_lifespan_multiplier: z.number().nullable().optional(),
  is_featured: z.boolean().optional(),
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
    const d = parsed.data;

    const insert: Record<string, unknown> = {
      name: d.name,
      brand: d.brand ?? '',
      category: d.category,
      image_url: d.image_url || null,
      pipeline_status: 'pending_review',
      status: 'draft',
      week_of: today,
    };

    // Add extended fields if provided
    if (d.price_inr !== undefined) insert.price_inr = d.price_inr;
    if (d.price_usd !== undefined) insert.price_usd = d.price_usd;
    if (d.scores !== undefined) insert.scores = d.scores;
    if (d.specs !== undefined) insert.specs = d.specs;
    if (d.award_type !== undefined) insert.award_type = d.award_type;
    if (d.affiliate_links !== undefined) insert.affiliate_links = d.affiliate_links;
    if (d.image_candidates) insert.image_candidates = d.image_candidates;
    if (d.summary !== undefined) insert.summary = d.summary;
    if (d.reddit_sentiment !== undefined) insert.reddit_sentiment = d.reddit_sentiment;
    if (d.estimated_lifespan_years !== undefined) insert.estimated_lifespan_years = d.estimated_lifespan_years;
    if (d.estimated_lifespan_multiplier !== undefined) insert.estimated_lifespan_multiplier = d.estimated_lifespan_multiplier;
    if (d.is_featured !== undefined) insert.is_featured = d.is_featured;

    const { data, error } = await supabase
      .from('products')
      .insert(insert as never)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Create failed' }, { status: 500 });
  }
}
