import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { join } from 'path';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import type { Product, AffiliateLink } from '@/lib/types';
import {
  downloadAndValidateImage,
  uploadImageToStorage,
  scrapeOgImage,
  extractAmazonImages,
  isStoredUrl,
} from '@/lib/image-storage';

const AFFILIATE_TAG = 'bifl365-21';
const MAX_PRODUCTS = 20;
const GEMINI_RETRIES = 2;
const GEMINI_RETRY_DELAY = 5000;

function getMaxImageCandidates(): number {
  try {
    const config = JSON.parse(readFileSync(join(process.cwd(), 'bifl365.config.json'), 'utf-8'));
    return config.pipeline?.max_image_candidates ?? 10;
  } catch {
    return 10;
  }
}

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(MAX_PRODUCTS),
});

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

  if (!res.ok) {
    throw new Error(`Gemini API error ${res.status}`);
  }

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

function sanitizeLinks(links: any[], tag: string): AffiliateLink[] {
  if (!Array.isArray(links)) return [];
  return links
    .filter((l: any) => l?.url && typeof l.url === 'string')
    .filter((l: any) => !l.url.includes('/s?k=') && !l.url.includes('/search?q='))
    .map((l: any) => {
      const result: AffiliateLink = {
        store: String(l.store || 'Unknown').trim(),
        url: l.url.trim(),
        is_affiliate: Boolean(l.is_affiliate),
      };
      try {
        const parsed = new URL(result.url);
        const host = parsed.hostname.toLowerCase();
        if (host.includes('amazon.in') || host.includes('amazon.com')) {
          parsed.searchParams.set('tag', tag);
          result.url = parsed.toString();
          result.is_affiliate = true;
        }
      } catch { /* keep as-is */ }
      return result;
    });
}

function buildVerificationPrompt(product: { name: string; brand: string; category?: string }, maxImages: number): string {
  return `You are a product research assistant. Find REAL, VERIFIED purchase links and product images for this product.

Product: "${product.name}" by ${product.brand || 'unknown brand'}
${product.category ? `Category: ${product.category}` : ''}

Tasks:
1. Search Amazon India (amazon.in) for this exact product. Find the REAL product page ASIN (the 10-character code in the /dp/ASIN URL).
2. Search Flipkart for the real product page URL (not a search page).
3. Find the manufacturer/brand official product page if it exists.
4. Find up to ${maxImages} REAL direct product image URLs. Best sources (in order):
   - Amazon CDN: https://m.media-amazon.com/images/I/XXXXX._AC_SL1500_.jpg (publicly downloadable)
   - Manufacturer/brand website images (most stable, rarely block downloads)
   - DO NOT include Flipkart CDN images (rukminim2.flixcart.com) — they block automated downloads

Return ONLY valid JSON:
{
  "affiliate_links": [
    { "store": "Amazon", "url": "https://www.amazon.in/dp/REAL_ASIN?tag=${AFFILIATE_TAG}", "is_affiliate": true },
    { "store": "Flipkart", "url": "https://www.flipkart.com/product-slug/p/REAL_PID", "is_affiliate": false },
    { "store": "Brand Store", "url": "https://brand.com/product", "is_affiliate": false }
  ],
  "image_url": "BEST_PRIMARY_IMAGE_URL",
  "image_candidates": [
    "https://m.media-amazon.com/images/I/REAL_ID._AC_SL1500_.jpg",
    "https://manufacturer-site.com/product.jpg"
  ],
  "verification_notes": "Brief note"
}

IMPORTANT: Only include URLs you actually found via search. Do NOT hallucinate or guess ASINs/URLs.`;
}

/**
 * Collect image candidates from multiple sources:
 * 1. OG tags from existing affiliate links (highest confidence)
 * 2. Amazon-specific image extraction from affiliate links
 * 3. Gemini Search results (lowest confidence, fills remaining slots)
 */
async function collectImageCandidates(
  existingLinks: AffiliateLink[],
  newLinks: AffiliateLink[],
  geminiImages: string[],
  maxCandidates: number
): Promise<string[]> {
  const allLinks = [...newLinks, ...existingLinks];
  const seen = new Set<string>();
  const candidates: string[] = [];

  function addUnique(url: string) {
    const trimmed = url.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      candidates.push(trimmed);
    }
  }

  // Source 1: Amazon-specific image extraction (high-res images from product pages)
  const amazonLinks = allLinks.filter(l => {
    try {
      const host = new URL(l.url).hostname.toLowerCase();
      return host.includes('amazon.in') || host.includes('amazon.com');
    } catch { return false; }
  });

  for (const link of amazonLinks.slice(0, 2)) {
    const imgs = await extractAmazonImages(link.url);
    imgs.forEach(addUnique);
  }

  // Source 2: OG tags from non-Amazon affiliate links (brand stores, Flipkart)
  const otherLinks = allLinks.filter(l => {
    try {
      const host = new URL(l.url).hostname.toLowerCase();
      return !host.includes('amazon.');
    } catch { return false; }
  });

  for (const link of otherLinks.slice(0, 3)) {
    const imgs = await scrapeOgImage(link.url);
    imgs.forEach(addUnique);
  }

  // Source 3: Gemini Search results (fill remaining slots)
  geminiImages.forEach(addUnique);

  return candidates.slice(0, maxCandidates * 2); // get extra so validation can filter
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const maxCandidates = getMaxImageCandidates();

  try {
    const raw = await request.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ errors: parsed.error.issues }, { status: 400 });
    }

    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, name, brand, category, affiliate_links, image_url, image_candidates')
      .in('id', parsed.data.ids);

    if (fetchError) throw fetchError;
    const productList = (products ?? []) as Product[];

    const results = [];

    for (const product of productList) {
      try {
        // Step 1: Call Gemini for affiliate links and image suggestions
        const prompt = buildVerificationPrompt(product, maxCandidates);
        const rawResponse = await callGeminiWithSearch(prompt);
        const verified = parseJsonFromResponse(rawResponse);

        // Step 2: Process affiliate links
        const newLinks = sanitizeLinks(verified.affiliate_links ?? [], AFFILIATE_TAG);

        // Step 3: Collect Gemini's image suggestions
        const geminiImages: string[] = [];
        if (verified.image_url && typeof verified.image_url === 'string') {
          geminiImages.push(verified.image_url.trim());
        }
        if (Array.isArray(verified.image_candidates)) {
          for (const url of verified.image_candidates) {
            if (typeof url === 'string' && url.trim()) geminiImages.push(url.trim());
          }
        }

        // Step 4: Collect from multiple sources (OG tags, Amazon pages, Gemini)
        const existingLinks = product.affiliate_links ?? [];
        const allCandidateUrls = await collectImageCandidates(
          existingLinks, newLinks, geminiImages, maxCandidates
        );

        // Step 5: Download, validate, and auto-store valid images
        const storedUrls: string[] = [];
        let imagesChecked = 0;

        for (const url of allCandidateUrls) {
          if (storedUrls.length >= maxCandidates) break;
          imagesChecked++;

          // Skip if already stored in Supabase
          if (isStoredUrl(url, supabaseUrl)) {
            storedUrls.push(url);
            continue;
          }

          const result = await downloadAndValidateImage(url);
          if (!result.valid || !result.buffer || !result.contentType) continue;

          // Auto-store to Supabase Storage
          try {
            const storedUrl = await uploadImageToStorage(
              supabase, product.id, result.buffer, result.contentType
            );
            storedUrls.push(storedUrl);
          } catch {
            // If storage fails, keep the original external URL as fallback
            storedUrls.push(url);
          }
        }

        // Step 6: Build updates
        const updates: Record<string, unknown> = {};
        if (newLinks.length > 0) updates.affiliate_links = newLinks;
        if (storedUrls.length > 0) {
          updates.image_candidates = storedUrls;
          updates.image_url = storedUrls[0];
          updates.image_approved = false; // needs re-approval
        }

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('products')
            .update(updates as never)
            .eq('id', product.id);

          if (updateError) throw updateError;
        }

        results.push({
          id: product.id,
          name: product.name,
          status: 'ok',
          links_found: newLinks.length,
          images_stored: storedUrls.length,
          images_checked: imagesChecked,
          sources: {
            gemini: geminiImages.length,
            scraped: allCandidateUrls.length - geminiImages.length,
          },
          notes: verified.verification_notes || '',
          data: updates,
        });
      } catch (err: any) {
        results.push({
          id: product.id,
          name: product.name,
          status: 'error',
          error: err.message,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Verification failed' }, { status: 500 });
  }
}
