import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import type { ProductScores, ProductSpecs, AwardType } from './types';

export interface EnrichmentResult {
  scores: ProductScores | null;
  specs: ProductSpecs | null;
  award_type: AwardType | null;
  summary: string | null;
  reddit_sentiment: string | null;
  estimated_lifespan_years: number | null;
  estimated_lifespan_multiplier: number | null;
  is_featured: boolean;
}

// --- Normalization helpers (ported from pipeline.mjs) ---

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

function normalizeAwardType(value: unknown): AwardType | null {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim().toLowerCase();
  const aliases: Record<string, string> = {
    best_buy: 'value_buy',
    value: 'value_buy',
    best_value: 'value_buy',
    forever: 'forever_pick',
    hidden: 'hidden_gem',
    star: 'current_star',
    current: 'current_star',
  };
  const normalized = aliases[raw] || raw;
  return ['value_buy', 'forever_pick', 'hidden_gem', 'current_star'].includes(normalized)
    ? (normalized as AwardType)
    : null;
}

function normalizeScores(raw: any): ProductScores | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const source =
    raw.scores && typeof raw.scores === 'object' && !Array.isArray(raw.scores)
      ? raw.scores
      : raw.scoring && typeof raw.scoring === 'object'
        ? raw.scoring
        : raw.scorecard && typeof raw.scorecard === 'object'
          ? raw.scorecard
          : ['build_quality', 'buildQuality', 'longevity', 'value', 'repairability', 'india_availability'].some(
                (key) => raw[key] !== undefined && raw[key] !== null
              )
            ? raw
            : null;

  if (!source) return null;

  const scores = {
    build_quality: parseNullableInt(source.build_quality ?? source.buildQuality ?? source.build_score) ?? 0,
    longevity: parseNullableInt(source.longevity ?? source.longevity_score) ?? 0,
    value: parseNullableInt(source.value ?? source.value_score) ?? 0,
    repairability: parseNullableInt(source.repairability ?? source.repairability_score ?? source.repair_score) ?? 0,
    india_availability: parseNullableInt(source.india_availability ?? source.indiaAvailability ?? source.availability) ?? 0,
  };

  return Object.values(scores).some((s) => s !== 0) ? scores : null;
}

function normalizeSpecs(raw: any): ProductSpecs | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const source =
    raw.specs && typeof raw.specs === 'object' && !Array.isArray(raw.specs)
      ? raw.specs
      : raw.details && typeof raw.details === 'object'
        ? raw.details
        : ['material', 'warranty', 'made_in', 'weight'].some((key) => raw[key] !== undefined)
          ? raw
          : null;

  if (!source) return null;

  const specs: ProductSpecs = {
    material: normalizeText(source.material) ?? undefined,
    warranty: normalizeText(source.warranty) ?? undefined,
    repairability_score: parseNullableInt(source.repairability_score) ?? undefined,
    made_in: normalizeText(source.made_in ?? source.madeIn) ?? undefined,
    weight: normalizeText(source.weight) ?? undefined,
  };

  return Object.values(specs).some((v) => v !== undefined) ? specs : null;
}

function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
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

  const unique = [...new Set(attempts.filter(Boolean))];
  for (const attempt of unique) {
    try {
      return JSON.parse(attempt);
    } catch {
      continue;
    }
  }

  throw new Error(`Unable to parse ${label} as JSON`);
}

// --- Scoring prompt ---

function buildScoringPrompt(product: { name: string; brand: string; category: string; [k: string]: any }): string {
  return `You are the BIFL365 editorial scorer.
Score this product and return ONLY a single JSON object.

PRODUCT:
${JSON.stringify({ name: product.name, brand: product.brand, category: product.category }, null, 2)}

Required response shape:
{
  "scores": {
    "build_quality": 18,
    "longevity": 19,
    "value": 16,
    "repairability": 15,
    "india_availability": 18
  },
  "specs": {
    "material": "Steel",
    "warranty": "Lifetime",
    "repairability_score": 8,
    "made_in": "Japan",
    "weight": "1.2 kg"
  },
  "award_type": "value_buy",
  "summary": "A short editorial summary.",
  "reddit_sentiment": "A short community sentiment note.",
  "estimated_lifespan_years": 25,
  "estimated_lifespan_multiplier": 5,
  "is_featured": false
}

Allowed award_type values: value_buy, forever_pick, hidden_gem, current_star, null.`;
}

// --- Provider callers ---

async function callGemini(prompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash' });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function callClaude(prompt: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = message.content[0];
  return block.type === 'text' ? block.text : '';
}

// --- Main export ---

export async function enrichProduct(
  product: { name: string; brand: string; category: string; [k: string]: any },
  provider: 'gemini' | 'claude' = 'gemini'
): Promise<EnrichmentResult> {
  const prompt = buildScoringPrompt(product);
  const raw = provider === 'claude' ? await callClaude(prompt) : await callGemini(prompt);
  const payload = parseJsonPayload(raw, `enrichment response for ${product.name}`);

  const firstText = (...vals: unknown[]) => {
    for (const v of vals) {
      const t = normalizeText(v);
      if (t) return t;
    }
    return null;
  };

  return {
    scores: normalizeScores(payload),
    specs: normalizeSpecs(payload),
    award_type: normalizeAwardType(firstText(payload.award_type, payload.award, payload.badge)),
    summary: firstText(payload.summary, payload.editorial_summary, payload.verdict),
    reddit_sentiment: firstText(payload.reddit_sentiment, payload.community_sentiment),
    estimated_lifespan_years: parseNullableInt(payload.estimated_lifespan_years ?? payload.lifespan_years),
    estimated_lifespan_multiplier: parseNullableNumber(payload.estimated_lifespan_multiplier ?? payload.lifespan_multiplier),
    is_featured: payload.is_featured === true,
  };
}
