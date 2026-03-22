import type { Product, AwardType, AffiliateLink, ProductScores, ProductSpecs } from './types';

// --- Helpers (shared logic with pipeline-scoring.ts) ---

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseNullableInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function firstText(...vals: unknown[]): string | null {
  for (const v of vals) {
    const t = normalizeText(v);
    if (t) return t;
  }
  return null;
}

function normalizeAwardType(value: unknown): AwardType | null {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim().toLowerCase();
  const aliases: Record<string, string> = {
    best_buy: 'value_buy', value: 'value_buy', best_value: 'value_buy',
    forever: 'forever_pick', hidden: 'hidden_gem',
    star: 'current_star', current: 'current_star',
  };
  const normalized = aliases[raw] || raw;
  return ['value_buy', 'forever_pick', 'hidden_gem', 'current_star'].includes(normalized)
    ? (normalized as AwardType) : null;
}

function normalizeScores(raw: any): ProductScores | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source =
    raw.scores && typeof raw.scores === 'object' && !Array.isArray(raw.scores) ? raw.scores
    : raw.scoring && typeof raw.scoring === 'object' ? raw.scoring
    : raw.scorecard && typeof raw.scorecard === 'object' ? raw.scorecard
    : ['build_quality', 'buildQuality', 'longevity', 'value', 'repairability', 'india_availability']
        .some(k => raw[k] !== undefined && raw[k] !== null) ? raw : null;
  if (!source) return null;
  const scores = {
    build_quality: parseNullableInt(source.build_quality ?? source.buildQuality ?? source.build_score) ?? 0,
    longevity: parseNullableInt(source.longevity ?? source.longevity_score) ?? 0,
    value: parseNullableInt(source.value ?? source.value_score) ?? 0,
    repairability: parseNullableInt(source.repairability ?? source.repairability_score ?? source.repair_score) ?? 0,
    india_availability: parseNullableInt(source.india_availability ?? source.indiaAvailability ?? source.availability) ?? 0,
  };
  return Object.values(scores).some(s => s !== 0) ? scores : null;
}

function normalizeSpecs(raw: any): ProductSpecs | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source =
    raw.specs && typeof raw.specs === 'object' && !Array.isArray(raw.specs) ? raw.specs
    : raw.details && typeof raw.details === 'object' ? raw.details
    : ['material', 'warranty', 'made_in', 'weight'].some(k => raw[k] !== undefined) ? raw : null;
  if (!source) return null;
  const specs: ProductSpecs = {
    material: normalizeText(source.material) ?? undefined,
    warranty: normalizeText(source.warranty) ?? undefined,
    repairability_score: parseNullableInt(source.repairability_score) ?? undefined,
    made_in: normalizeText(source.made_in ?? source.madeIn) ?? undefined,
    weight: normalizeText(source.weight) ?? undefined,
  };
  return Object.values(specs).some(v => v !== undefined) ? specs : null;
}

function sanitizeAffiliateLinks(links: any[], affiliateTag: string): AffiliateLink[] {
  if (!Array.isArray(links)) return [];
  return links
    .filter(link => link && typeof link === 'object' && typeof link.url === 'string' && link.url.trim())
    .filter(link => {
      // Drop search URLs
      if (link.url.includes('/s?k=') || link.url.includes('/search?q=')) return false;
      return true;
    })
    .map(link => {
      const result: AffiliateLink = {
        store: normalizeText(link.store) || 'Unknown',
        url: link.url.trim(),
        is_affiliate: Boolean(link.is_affiliate),
      };
      try {
        const parsed = new URL(result.url);
        const host = parsed.hostname.toLowerCase();
        if (host.includes('amazon.in') || host.includes('amazon.com')) {
          parsed.searchParams.set('tag', affiliateTag);
          result.url = parsed.toString();
          result.is_affiliate = true;
        }
      } catch {
        // Invalid URL — keep as-is
      }
      return result;
    });
}

function stripCodeFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function parseJsonPayload(raw: string, label: string): any {
  const value = raw.trim();
  const attempts: string[] = [];
  const cleaned = stripCodeFences(value);
  if (cleaned) attempts.push(cleaned);
  const fencedMatch = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) attempts.push(fencedMatch[1].trim());
  const firstObj = value.indexOf('{');
  const lastObj = value.lastIndexOf('}');
  if (firstObj !== -1 && lastObj > firstObj) {
    attempts.push(value.slice(firstObj, lastObj + 1));
  }
  // Also try array
  const firstArr = value.indexOf('[');
  const lastArr = value.lastIndexOf(']');
  if (firstArr !== -1 && lastArr > firstArr) {
    attempts.push(value.slice(firstArr, lastArr + 1));
  }
  const unique = [...new Set(attempts.filter(Boolean))];
  for (const attempt of unique) {
    try { return JSON.parse(attempt); } catch { continue; }
  }
  throw new Error(`Unable to parse ${label} as JSON`);
}

// --- Normalization categories ---

const VALID_CATEGORIES = new Set(['kitchen', 'edc', 'home', 'travel', 'tech', 'parenting', 'watches']);

function normalizeCategory(raw: any): string {
  const value = normalizeText(raw);
  if (value && VALID_CATEGORIES.has(value.toLowerCase())) return value.toLowerCase();
  return 'kitchen'; // fallback
}

// --- Image candidates extraction ---

function extractImageCandidates(raw: any): string[] {
  const candidates: string[] = [];

  // From image_candidates array
  if (Array.isArray(raw.image_candidates)) {
    for (const url of raw.image_candidates) {
      if (typeof url === 'string' && url.trim()) candidates.push(url.trim());
    }
  }

  // From image_url (single)
  const singleUrl = normalizeText(raw.image_url);
  if (singleUrl && !candidates.includes(singleUrl)) {
    candidates.unshift(singleUrl); // primary image first
  }

  // From image_urls array (alternate key)
  if (Array.isArray(raw.image_urls)) {
    for (const url of raw.image_urls) {
      if (typeof url === 'string' && url.trim() && !candidates.includes(url.trim())) {
        candidates.push(url.trim());
      }
    }
  }

  return candidates.slice(0, 5);
}

// --- Main export ---

export interface NormalizedProductResult {
  valid: boolean;
  product: Partial<Product>;
  warnings: string[];
  errors: string[];
}

export function normalizeExternalProductJson(raw: string, affiliateTag: string): NormalizedProductResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  let payload: any;
  try {
    payload = parseJsonPayload(raw, 'external AI response');
  } catch (e: any) {
    return { valid: false, product: {}, warnings: [], errors: [e.message] };
  }

  // Handle array — take first element
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return { valid: false, product: {}, warnings: [], errors: ['JSON array is empty'] };
    }
    if (payload.length > 1) warnings.push(`Array contains ${payload.length} items — using the first one`);
    payload = payload[0];
  }

  // Extract name
  const name = firstText(payload.name, payload.title, payload.product_name, payload.productName, payload.item_name, payload.model);
  if (!name) {
    return { valid: false, product: {}, warnings, errors: ['No product name found in JSON'] };
  }

  // Extract fields
  const brand = firstText(payload.brand, payload.manufacturer, payload.maker) || '';
  const category = normalizeCategory(payload.category ?? payload.type ?? payload.segment);
  const scores = normalizeScores(payload);
  const specs = normalizeSpecs(payload);
  const award_type = normalizeAwardType(firstText(payload.award_type, payload.award, payload.badge));

  // Affiliate links
  const rawLinks = payload.affiliate_links ?? payload.affiliateLinks ?? payload.links ?? [];
  const affiliateLinks = sanitizeAffiliateLinks(rawLinks, affiliateTag);
  const droppedSearchUrls = Array.isArray(rawLinks)
    ? rawLinks.filter((l: any) => l?.url && (l.url.includes('/s?k=') || l.url.includes('/search?q='))).length
    : 0;
  if (droppedSearchUrls > 0) warnings.push(`Removed ${droppedSearchUrls} search URL(s) from affiliate links`);

  // Images
  const imageCandidates = extractImageCandidates(payload);
  if (imageCandidates.length === 0) warnings.push('No image URLs provided');
  if (imageCandidates.length === 1) warnings.push('Only 1 image URL — consider providing up to 5 for better success rate');

  // Validation warnings
  if (!scores) warnings.push('No scores found — product will need enrichment');
  if (affiliateLinks.length === 0) warnings.push('No affiliate links found');
  if (!award_type) warnings.push('No award type assigned');

  const product: Partial<Product> = {
    name,
    brand,
    category: category as any,
    price_inr: parseNullableInt(payload.price_inr ?? payload.priceInr) ?? null,
    price_usd: parseNullableInt(payload.price_usd ?? payload.priceUsd) ?? null,
    scores: scores ?? null,
    specs: specs ?? null,
    award_type: award_type ?? null,
    affiliate_links: affiliateLinks.length > 0 ? affiliateLinks : null,
    image_url: imageCandidates[0] || null,
    image_candidates: imageCandidates,
    summary: firstText(payload.summary, payload.editorial_summary, payload.verdict),
    reddit_sentiment: firstText(payload.reddit_sentiment, payload.community_sentiment, payload.reddit_context),
    estimated_lifespan_years: parseNullableInt(payload.estimated_lifespan_years ?? payload.lifespan_years),
    estimated_lifespan_multiplier: parseNullableNumber(payload.estimated_lifespan_multiplier ?? payload.lifespan_multiplier),
    is_featured: payload.is_featured === true,
  };

  return { valid: true, product, warnings, errors };
}
