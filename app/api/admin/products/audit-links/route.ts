import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { supabase } from '@/lib/supabase';
import { validateAffiliateUrl, sanitizeAndValidateLinks, type LinkValidationResult } from '@/lib/link-validator';
import { AFFILIATE_TAG } from '@/lib/constants';
import type { AffiliateLink } from '@/lib/types';

interface ProductIssue {
  id: string;
  name: string;
  brand: string;
  links: LinkValidationResult[];
  total_links: number;
  broken_count: number;
  suspicious_count: number;
}

/**
 * GET: Audit all products for broken/suspicious affiliate links
 */
export async function GET() {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const { data } = await supabase
    .from('products')
    .select('id, name, brand, affiliate_links')
    .not('affiliate_links', 'is', null);

  const products = (data ?? []) as { id: string; name: string; brand: string; affiliate_links: AffiliateLink[] | null }[];

  const issues: ProductIssue[] = [];
  let totalProducts = 0;

  for (const product of products) {
    const links = product.affiliate_links ?? [];
    if (links.length === 0) continue;
    totalProducts++;

    const results = links.map(l => validateAffiliateUrl(l.url, l.store));
    const broken = results.filter(r => r.status === 'broken').length;
    const suspicious = results.filter(r => r.status === 'suspicious').length;

    if (broken > 0 || suspicious > 0) {
      issues.push({
        id: product.id,
        name: product.name,
        brand: product.brand,
        links: results,
        total_links: links.length,
        broken_count: broken,
        suspicious_count: suspicious,
      });
    }
  }

  issues.sort((a, b) => b.broken_count - a.broken_count);

  return NextResponse.json({
    total_products: totalProducts,
    products_with_issues: issues.length,
    total_broken: issues.reduce((s, i) => s + i.broken_count, 0),
    total_suspicious: issues.reduce((s, i) => s + i.suspicious_count, 0),
    issues,
  });
}

const GEMINI_RETRIES = 2;
const GEMINI_RETRY_DELAY = 5000;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
        generationConfig: { temperature: 0.2 },
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
  throw new Error('Unable to parse Gemini response as JSON');
}

const fixSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(20),
});

/**
 * POST: Fix broken links for specified products using Gemini Search
 * Removes broken links and attempts to find replacements via AI
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const raw = await request.json();
  const parsed = fixSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.issues }, { status: 400 });
  }

  const { ids } = parsed.data;

  const { data } = await supabase
    .from('products')
    .select('id, name, brand, category, affiliate_links')
    .in('id', ids);

  const products = (data ?? []) as { id: string; name: string; brand: string; category: string; affiliate_links: AffiliateLink[] | null }[];

  const results: { id: string; name: string; status: string; links_before: number; links_after: number }[] = [];

  for (const product of products) {
    const oldLinks = product.affiliate_links ?? [];

    // First: remove broken links using pattern validation
    const { sanitized: validLinks } = sanitizeAndValidateLinks(oldLinks);

    // If we still have valid links, just update with cleaned set
    if (validLinks.length > 0) {
      await (supabase.from('products') as any)
        .update({ affiliate_links: validLinks })
        .eq('id', product.id);

      results.push({
        id: product.id,
        name: product.name,
        status: 'cleaned',
        links_before: oldLinks.length,
        links_after: validLinks.length,
      });
      continue;
    }

    // No valid links left — try Gemini Search to find replacements
    try {
      const prompt = `Find REAL purchase links for this product on Amazon India and Flipkart.

Product: ${product.brand} ${product.name}
Category: ${product.category}

Return ONLY a JSON object:
{
  "affiliate_links": [
    { "store": "Amazon", "url": "https://www.amazon.in/dp/ACTUAL_ASIN", "is_affiliate": false },
    { "store": "Flipkart", "url": "https://www.flipkart.com/...", "is_affiliate": false }
  ]
}

CRITICAL:
- Amazon URLs MUST contain /dp/ followed by a 10-character ASIN code
- Flipkart URLs MUST contain /p/ followed by a product identifier
- Do NOT return search URLs, category pages, or deal pages
- Only return URLs you are confident exist`;

      const response = await callGeminiWithSearch(prompt);
      const payload = parseJsonFromResponse(response);

      if (Array.isArray(payload.affiliate_links)) {
        const newLinks: AffiliateLink[] = payload.affiliate_links
          .filter((l: any) => l?.url && typeof l.url === 'string')
          .map((l: any) => {
            const link: AffiliateLink = {
              store: String(l.store || 'Unknown').trim(),
              url: l.url.trim(),
              is_affiliate: false,
            };
            try {
              const parsed = new URL(link.url);
              const host = parsed.hostname.toLowerCase();
              if (host.includes('amazon.in') || host.includes('amazon.com')) {
                parsed.searchParams.set('tag', AFFILIATE_TAG);
                link.url = parsed.toString();
                link.is_affiliate = true;
              }
            } catch { /* keep as-is */ }
            return link;
          });

        const { sanitized: verified } = sanitizeAndValidateLinks(newLinks);

        if (verified.length > 0) {
          await (supabase.from('products') as any)
            .update({ affiliate_links: verified })
            .eq('id', product.id);

          results.push({
            id: product.id,
            name: product.name,
            status: 'replaced_via_gemini',
            links_before: oldLinks.length,
            links_after: verified.length,
          });
          continue;
        }
      }
    } catch (err) {
      console.warn(`Gemini link fix failed for ${product.name}:`, err);
    }

    // Gemini couldn't find links either — clear the broken ones
    await (supabase.from('products') as any)
      .update({ affiliate_links: [] })
      .eq('id', product.id);

    results.push({
      id: product.id,
      name: product.name,
      status: 'cleared',
      links_before: oldLinks.length,
      links_after: 0,
    });
  }

  return NextResponse.json({ results, total: results.length });
}
