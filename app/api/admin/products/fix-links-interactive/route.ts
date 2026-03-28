import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { validateAffiliateUrl } from '@/lib/link-validator';
import { AFFILIATE_TAG } from '@/lib/constants';
import type { AffiliateLink } from '@/lib/types';

const GEMINI_RETRIES = 2;
const GEMINI_RETRY_DELAY = 5000;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

async function callGeminiWithSearch(prompt: string, attempt = 1): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0.1 },
      }),
    }
  );

  if (res.status === 429 && attempt <= GEMINI_RETRIES) {
    await delay(GEMINI_RETRY_DELAY * attempt);
    return callGeminiWithSearch(prompt, attempt + 1);
  }
  if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function parseJsonFromResponse(raw: string): any {
  const value = raw.trim();
  const fencedMatch = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    try { return JSON.parse(fencedMatch[1].trim()); } catch { /* continue */ }
  }
  const firstObj = value.indexOf('{');
  const lastObj = value.lastIndexOf('}');
  if (firstObj !== -1 && lastObj > firstObj) {
    try { return JSON.parse(value.slice(firstObj, lastObj + 1)); } catch { /* continue */ }
  }
  return null;
}

// ─── Store validators ────────────────────────────────────────────────────

interface StoreValidator {
  label: string;
  match: (url: string) => boolean;
  isValid: (url: string) => boolean;
}

const STORE_VALIDATORS: Record<string, StoreValidator> = {
  amazon: {
    label: 'Amazon',
    match: (url) => {
      try { const h = new URL(url).hostname; return h.includes('amazon.in') || h.includes('amazon.com'); }
      catch { return false; }
    },
    isValid: (url) => {
      const result = validateAffiliateUrl(url, 'Amazon');
      return result.status === 'valid';
    },
  },
  flipkart: {
    label: 'Flipkart',
    match: (url) => {
      try { return new URL(url).hostname.includes('flipkart.com'); }
      catch { return false; }
    },
    isValid: (url) => {
      const result = validateAffiliateUrl(url, 'Flipkart');
      return result.status === 'valid';
    },
  },
  brand: {
    label: 'Brand/Official',
    match: (url) => {
      try {
        const h = new URL(url).hostname.toLowerCase();
        return !h.includes('amazon.') && !h.includes('flipkart.com') && !h.includes('meesho.com') && !h.includes('google.com');
      } catch { return false; }
    },
    isValid: (url) => {
      try { return new URL(url).pathname.length > 1; }
      catch { return false; }
    },
  },
};

// ─── Schemas ─────────────────────────────────────────────────────────────

const scanSchema = z.object({
  action: z.literal('scan'),
  stores: z.array(z.enum(['amazon', 'flipkart', 'brand'])).min(1),
});

const searchSchema = z.object({
  action: z.literal('search'),
  productId: z.string().uuid(),
  productName: z.string(),
  brand: z.string(),
  category: z.string().optional(),
  stores: z.array(z.enum(['amazon', 'flipkart', 'brand'])).min(1),
});

const applySchema = z.object({
  action: z.literal('apply'),
  updates: z.array(z.object({
    id: z.string().uuid(),
    affiliate_links: z.array(z.any()),
  })).min(1),
});

// ─── Handlers ────────────────────────────────────────────────────────────

async function handleScan(stores: string[]) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, brand, category, affiliate_links, pipeline_status')
    .order('name');

  if (error) throw error;

  type ProductRow = { id: string; name: string; brand: string; category: string; affiliate_links: AffiliateLink[] | null; pipeline_status: string };
  const products = (data ?? []) as ProductRow[];

  const issues: {
    id: string;
    name: string;
    brand: string;
    category: string;
    status: string;
    storeIssues: { store: string; storeKey: string; currentUrl: string | null; issueType: 'missing' | 'broken' }[];
  }[] = [];

  for (const p of products) {
    const links = p.affiliate_links ?? [];
    const storeIssues: { store: string; storeKey: string; currentUrl: string | null; issueType: 'missing' | 'broken' }[] = [];

    for (const storeKey of stores) {
      const validator = STORE_VALIDATORS[storeKey];
      if (!validator) continue;

      const existing = links.find(l => validator.match(l.url));

      if (!existing) {
        storeIssues.push({ store: validator.label, storeKey, currentUrl: null, issueType: 'missing' });
      } else if (!validator.isValid(existing.url)) {
        storeIssues.push({ store: validator.label, storeKey, currentUrl: existing.url, issueType: 'broken' });
      }
    }

    if (storeIssues.length > 0) {
      issues.push({
        id: p.id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        status: p.pipeline_status,
        storeIssues,
      });
    }
  }

  return { total: products.length, issues };
}

async function handleSearch(productName: string, brand: string, category: string | undefined, stores: string[]) {
  const storeInstructions: string[] = [];

  if (stores.includes('amazon')) {
    storeInstructions.push(
      `- Amazon India (amazon.in): Find the REAL product page with ASIN. URL format: https://www.amazon.in/dp/REAL_ASIN\n  MUST contain /dp/ followed by a 10-character ASIN code. Do NOT return search pages (/s?k=...)`
    );
  }
  if (stores.includes('flipkart')) {
    storeInstructions.push(
      `- Flipkart: Find the REAL product page URL. Format: https://www.flipkart.com/product-slug/p/PRODUCT_ID\n  MUST contain /p/ followed by product identifier. Do NOT return search pages (/search?q=...), category pages, deal pages, or review pages`
    );
  }
  if (stores.includes('brand')) {
    storeInstructions.push(
      `- Brand/Official: Find the manufacturer's official product page URL if it exists.\n  Must be the brand's own domain (not a marketplace)`
    );
  }

  const prompt = `Search for this product and find REAL, VERIFIED purchase links.

Product: "${productName}" by ${brand || 'unknown brand'}
${category ? `Category: ${category}` : ''}

Find these links:
${storeInstructions.join('\n')}

Return ONLY a JSON object:
{
  "affiliate_links": [
    ${stores.includes('amazon') ? '{ "store": "Amazon", "url": "https://www.amazon.in/dp/REAL_ASIN", "is_affiliate": true },' : ''}
    ${stores.includes('flipkart') ? '{ "store": "Flipkart", "url": "https://www.flipkart.com/product-slug/p/REAL_PID", "is_affiliate": false },' : ''}
    ${stores.includes('brand') ? '{ "store": "Brand", "url": "https://brand.com/product-page", "is_affiliate": false }' : ''}
  ]
}

CRITICAL: Only include URLs you actually found via search. Do NOT guess or hallucinate URLs.
If a store link cannot be found, OMIT that entry entirely.`;

  const raw = await callGeminiWithSearch(prompt);
  const parsed = parseJsonFromResponse(raw);

  if (!parsed || !Array.isArray(parsed.affiliate_links)) {
    return { found: [] };
  }

  const found: { store: string; storeKey: string; url: string }[] = [];

  for (const storeKey of stores) {
    const validator = STORE_VALIDATORS[storeKey];
    if (!validator) continue;

    const suggestion = parsed.affiliate_links.find((l: any) => {
      if (!l?.url || typeof l.url !== 'string') return false;
      return validator.match(l.url.trim());
    });

    if (!suggestion) continue;

    let url = suggestion.url.trim();
    if (!validator.isValid(url)) continue;

    // Apply affiliate tag to Amazon
    if (storeKey === 'amazon') {
      try {
        const u = new URL(url);
        u.searchParams.set('tag', AFFILIATE_TAG);
        url = u.toString();
      } catch { /* keep as-is */ }
    }

    found.push({ store: validator.label, storeKey, url });
  }

  return { found };
}

async function handleApply(updates: { id: string; affiliate_links: any[] }[]) {
  const supabase = getSupabase();
  const results: { id: string; status: string }[] = [];

  for (const update of updates) {
    const { error } = await supabase
      .from('products')
      .update({ affiliate_links: update.affiliate_links } as never)
      .eq('id', update.id);

    results.push({
      id: update.id,
      status: error ? `error: ${error.message}` : 'ok',
    });
  }

  return { results, applied: results.filter(r => r.status === 'ok').length };
}

// ─── Route handler ───────────────────────────────────────────────────────

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const body = await request.json();
    const action = body?.action;

    if (action === 'scan') {
      const parsed = scanSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ errors: parsed.error.issues }, { status: 400 });
      const result = await handleScan(parsed.data.stores);
      return NextResponse.json(result);
    }

    if (action === 'search') {
      const parsed = searchSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ errors: parsed.error.issues }, { status: 400 });
      const { productName, brand, category, stores } = parsed.data;
      const result = await handleSearch(productName, brand, category, stores);
      return NextResponse.json(result);
    }

    if (action === 'apply') {
      const parsed = applySchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ errors: parsed.error.issues }, { status: 400 });
      const result = await handleApply(parsed.data.updates);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Request failed' }, { status: 500 });
  }
}
