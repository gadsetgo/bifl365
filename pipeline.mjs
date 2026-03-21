#!/usr/bin/env node

import { config } from 'dotenv';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, renameSync } from 'fs';
import { join, resolve, basename, extname } from 'path';
import http from 'http';
import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

config();

const configData = JSON.parse(readFileSync(join(process.cwd(), 'bifl365.config.json'), 'utf-8'));
const { pipeline, categories } = configData;

const VALID_CATEGORIES = new Set(categories.map((category) => category.value));
const CATEGORY_NAMES = categories.map((category) => category.value).join('|');
const AUTO_APPROVE = Boolean(pipeline.auto_approve_mode);
const weekOf = new Date().toISOString().split('T')[0];

const runtime = buildRuntimeConfig();

const supabase =
  !runtime.skipUpsert && runtime.supabaseUrl && runtime.serviceRoleKey
    ? createClient(runtime.supabaseUrl, runtime.serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      })
    : null;

validateRuntime(runtime);

function buildRuntimeConfig() {
  const researchSource = normalizeMode(process.env.PIPELINE_RESEARCH_SOURCE, 'local');
  const researchProvider =
    researchSource === 'local'
      ? normalizeProvider(process.env.PIPELINE_RESEARCH_PROVIDER, 'ollama')
      : researchSource === 'online'
        ? normalizeProvider(process.env.PIPELINE_RESEARCH_PROVIDER, 'claude')
        : 'none';

  const scoringProvider =
    researchSource === 'import'
      ? normalizeProvider(process.env.PIPELINE_SCORING_PROVIDER, 'none')
      : normalizeProvider(process.env.PIPELINE_SCORING_PROVIDER, researchProvider);

  const contentProvider =
    researchSource === 'import'
      ? normalizeProvider(process.env.PIPELINE_CONTENT_PROVIDER, 'none')
      : normalizeProvider(process.env.PIPELINE_CONTENT_PROVIDER, scoringProvider);

  const importFile = process.env.PIPELINE_IMPORT_FILE ? resolve(process.cwd(), process.env.PIPELINE_IMPORT_FILE) : null;
  const importDir =
    process.env.PIPELINE_IMPORT_DIR
      ? resolve(process.cwd(), process.env.PIPELINE_IMPORT_DIR)
      : researchSource === 'import' && !importFile
        ? resolve(process.cwd(), 'research-drop')
        : null;

  return {
    researchSource,
    researchProvider,
    scoringProvider,
    contentProvider,
    importFile,
    importDir,
    importProcessedDir: process.env.PIPELINE_IMPORT_PROCESSED_DIR
      ? resolve(process.cwd(), process.env.PIPELINE_IMPORT_PROCESSED_DIR)
      : importDir
        ? join(importDir, 'processed')
        : null,
    importFailedDir: process.env.PIPELINE_IMPORT_FAILED_DIR
      ? resolve(process.cwd(), process.env.PIPELINE_IMPORT_FAILED_DIR)
      : importDir
        ? join(importDir, 'failed')
        : null,
    importSelection: normalizeImportSelection(process.env.PIPELINE_IMPORT_SELECTION, 'all'),
    archiveImports: readBooleanEnv('PIPELINE_IMPORT_ARCHIVE', true),
    upsertMode: normalizeUpsertMode(process.env.PIPELINE_UPSERT_MODE, 'direct'),
    totalCandidates: parsePositiveInt(process.env.PIPELINE_TOTAL_CANDIDATES, 3),
    skipUpsert: readBooleanEnv('PIPELINE_SKIP_UPSERT', false),
    ollamaModel: process.env.OLLAMA_MODEL || 'phi3:latest',
    ollamaHost: process.env.OLLAMA_HOST || 'localhost',
    ollamaPort: parsePositiveInt(process.env.OLLAMA_PORT, 11434),
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    claudeModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    claudeApiKey: process.env.ANTHROPIC_API_KEY || '',
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  };
}

function validateRuntime(currentRuntime) {
  if (currentRuntime.researchSource === 'import' && !currentRuntime.importFile && !currentRuntime.importDir) {
    throw new Error('PIPELINE_IMPORT_FILE or PIPELINE_IMPORT_DIR is required when PIPELINE_RESEARCH_SOURCE=import');
  }

  if (currentRuntime.importFile && !existsSync(currentRuntime.importFile)) {
    throw new Error(`Import file not found: ${currentRuntime.importFile}`);
  }

  if (currentRuntime.importDir) {
    ensureDirectory(currentRuntime.importDir);
    if (currentRuntime.archiveImports) {
      if (currentRuntime.importProcessedDir) ensureDirectory(currentRuntime.importProcessedDir);
      if (currentRuntime.importFailedDir) ensureDirectory(currentRuntime.importFailedDir);
    }
  }

  if (requiresGemini(currentRuntime) && !currentRuntime.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is required for online or Gemini-backed pipeline modes');
  }

  if (requiresClaude(currentRuntime) && !currentRuntime.claudeApiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for Claude-backed pipeline modes');
  }

  if (!currentRuntime.skipUpsert) {
    if (!currentRuntime.serviceRoleKey || !currentRuntime.supabaseUrl) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL are required unless PIPELINE_SKIP_UPSERT=true');
    }

    if (currentRuntime.upsertMode === 'api' && !currentRuntime.siteUrl) {
      throw new Error('NEXT_PUBLIC_SITE_URL is required when PIPELINE_UPSERT_MODE=api');
    }
  }
}

function requiresGemini(currentRuntime) {
  return (
    currentRuntime.researchProvider === 'gemini' ||
    currentRuntime.scoringProvider === 'gemini' ||
    currentRuntime.contentProvider === 'gemini'
  );
}

function requiresClaude(currentRuntime) {
  return (
    currentRuntime.researchProvider === 'claude' ||
    currentRuntime.scoringProvider === 'claude' ||
    currentRuntime.contentProvider === 'claude'
  );
}

function normalizeMode(value, fallback) {
  const normalized = String(value || fallback).trim().toLowerCase();
  return ['local', 'import', 'online'].includes(normalized) ? normalized : fallback;
}

function normalizeProvider(value, fallback) {
  const normalized = String(value || fallback).trim().toLowerCase();
  return ['ollama', 'gemini', 'claude', 'none'].includes(normalized) ? normalized : fallback;
}

function normalizeUpsertMode(value, fallback) {
  const normalized = String(value || fallback).trim().toLowerCase();
  return ['direct', 'api'].includes(normalized) ? normalized : fallback;
}

function normalizeImportSelection(value, fallback) {
  const normalized = String(value || fallback).trim().toLowerCase();
  return ['all', 'latest'].includes(normalized) ? normalized : fallback;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNullableInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function readBooleanEnv(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function normalizeText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function firstText(...values) {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }
  return null;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', '1'].includes(normalized)) return true;
    if (['false', 'no', '0'].includes(normalized)) return false;
  }
  return fallback;
}

function stripCodeFences(raw) {
  return String(raw ?? '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function ensureDirectory(path) {
  mkdirSync(path, { recursive: true });
}

function parseJsonPayload(raw, label) {
  const value = String(raw ?? '').trim();
  const attempts = [];

  const cleaned = stripCodeFences(value);
  if (cleaned) attempts.push(cleaned);

  const fencedMatch = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) attempts.push(fencedMatch[1].trim());

  const firstArrayStart = value.indexOf('[');
  const lastArrayEnd = value.lastIndexOf(']');
  if (firstArrayStart !== -1 && lastArrayEnd > firstArrayStart) {
    attempts.push(value.slice(firstArrayStart, lastArrayEnd + 1));
  }

  const firstObjectStart = value.indexOf('{');
  const lastObjectEnd = value.lastIndexOf('}');
  if (firstObjectStart !== -1 && lastObjectEnd > firstObjectStart) {
    attempts.push(value.slice(firstObjectStart, lastObjectEnd + 1));
  }

  const uniqueAttempts = [...new Set(attempts.filter(Boolean))];
  for (const attempt of uniqueAttempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      continue;
    }
  }

  throw new Error(`Unable to parse ${label} as JSON`);
}

function extractArray(payload, preferredKeys = [], allowFallbackSearch = true) {
  if (Array.isArray(payload)) return payload;

  for (const key of preferredKeys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }

  if (allowFallbackSearch && payload && typeof payload === 'object') {
    for (const value of Object.values(payload)) {
      if (Array.isArray(value)) return value;
    }
  }

  return null;
}

function normalizeCategory(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\s+/g, '_');

  const aliases = {
    desk: 'tech',
    office: 'tech',
    work: 'tech',
    tools: 'edc',
    carry: 'travel',
    luggage: 'travel',
    baby: 'parenting',
    babies: 'parenting'
  };

  const normalized = aliases[raw] || raw;
  if (!VALID_CATEGORIES.has(normalized)) {
    throw new Error(`Unsupported category "${value}". Expected one of: ${CATEGORY_NAMES}`);
  }

  return normalized;
}

function normalizeAwardType(value) {
  if (value === null || value === undefined || value === '') return null;

  const raw = String(value).trim().toLowerCase();
  const aliases = {
    best_buy: 'value_buy',
    value: 'value_buy',
    best_value: 'value_buy',
    forever: 'forever_pick',
    hidden: 'hidden_gem',
    star: 'current_star',
    current: 'current_star'
  };

  const normalized = aliases[raw] || raw;
  return ['value_buy', 'forever_pick', 'hidden_gem', 'current_star'].includes(normalized) ? normalized : null;
}

function normalizeAffiliateLinks(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((link) => {
        const store = normalizeText(link?.store);
        const url = normalizeText(link?.url);
        if (!store || !url) return null;
        return {
          store,
          url,
          is_affiliate: normalizeBoolean(link?.is_affiliate, false)
        };
      })
      .filter(Boolean);
  }

  return [];
}

function buildLegacyAffiliateLinks(raw) {
  const links = [];

  const amazon = normalizeText(raw?.affiliate_url_amazon);
  if (amazon) links.push({ store: 'Amazon', url: amazon, is_affiliate: false });

  const flipkart = normalizeText(raw?.affiliate_url_flipkart);
  if (flipkart) links.push({ store: 'Flipkart', url: flipkart, is_affiliate: false });

  return links;
}

function normalizeScores(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const source =
    raw.scores && typeof raw.scores === 'object' && !Array.isArray(raw.scores)
      ? raw.scores
      : raw.scoring && typeof raw.scoring === 'object' && !Array.isArray(raw.scoring)
        ? raw.scoring
        : raw.scorecard && typeof raw.scorecard === 'object' && !Array.isArray(raw.scorecard)
          ? raw.scorecard
          : raw.ratings && typeof raw.ratings === 'object' && !Array.isArray(raw.ratings)
            ? raw.ratings
            : ['build_quality', 'buildQuality', 'longevity', 'value', 'repairability', 'india_availability', 'indiaAvailability'].some(
                  (key) => raw[key] !== undefined && raw[key] !== null
                )
              ? raw
              : null;

  if (!source) return null;

  const scores = {
    build_quality: parseNullableInt(source.build_quality ?? source.buildQuality ?? source.build_score),
    longevity: parseNullableInt(source.longevity ?? source.longevity_score),
    value: parseNullableInt(source.value ?? source.value_score),
    repairability: parseNullableInt(source.repairability ?? source.repairability_score ?? source.repair_score),
    india_availability: parseNullableInt(
      source.india_availability ?? source.indiaAvailability ?? source.availability ?? source.availability_score
    )
  };

  return Object.values(scores).some((score) => score !== null) ? scores : null;
}

function normalizeSpecs(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const source =
    raw.specs && typeof raw.specs === 'object' && !Array.isArray(raw.specs)
      ? raw.specs
      : raw.details && typeof raw.details === 'object' && !Array.isArray(raw.details)
        ? raw.details
        : raw.product_specs && typeof raw.product_specs === 'object' && !Array.isArray(raw.product_specs)
          ? raw.product_specs
          : ['material', 'warranty', 'made_in', 'madeIn', 'weight'].some((key) => raw[key] !== undefined && raw[key] !== null)
            ? raw
            : null;

  if (!source) return null;

  const specs = {
    material: normalizeText(source.material),
    warranty: normalizeText(source.warranty),
    repairability_score: parseNullableInt(source.repairability_score),
    made_in: normalizeText(source.made_in ?? source.madeIn),
    weight: normalizeText(source.weight)
  };

  return Object.values(specs).some((value) => value !== null) ? specs : null;
}

function normalizeStatus(rawStatus, affiliateLinks) {
  const normalized = String(rawStatus || '').trim().toLowerCase();
  if (['draft', 'published'].includes(normalized)) return normalized;
  return AUTO_APPROVE && affiliateLinks.length > 0 ? 'published' : 'draft';
}

function normalizePipelineStatus(rawStatus, status) {
  const normalized = String(rawStatus || '').trim().toLowerCase();
  if (['pending_review', 'approved', 'rejected', 'live'].includes(normalized)) return normalized;
  return status === 'draft' ? 'pending_review' : 'live';
}

function looksLikePublishReadyProduct(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;

  return Boolean(
    normalizeScores(raw) ||
      normalizeAwardType(firstText(raw.award_type, raw.award, raw.badge)) ||
      normalizeText(firstText(raw.summary, raw.editorial_summary, raw.verdict)) ||
      parseNullableInt(raw.estimated_lifespan_years ?? raw.lifespan_years) !== null ||
      parseNullableNumber(raw.estimated_lifespan_multiplier ?? raw.lifespan_multiplier) !== null
  );
}

function unwrapCandidateObject(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;

  const directName = firstText(raw.name, raw.title, raw.product_name, raw.productName, raw.item_name, raw.model);
  if (directName) return raw;

  for (const key of ['product', 'candidate', 'item', 'data', 'result']) {
    const nested = raw[key];
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) continue;

    const nestedName = firstText(
      nested.name,
      nested.title,
      nested.product_name,
      nested.productName,
      nested.item_name,
      nested.model
    );
    if (nestedName) {
      return {
        ...raw,
        ...nested
      };
    }
  }

  return raw;
}

function inferCategoryFromText(text) {
  const haystack = String(text || '').toLowerCase();
  if (!haystack) return null;

  if (/(casio|g-shock|gshock|seiko|timex|watch|clock)/.test(haystack)) return 'watches';
  if (/(wallet|backpack|luggage|travel|suitcase|carry-on|carry on|bag)/.test(haystack)) return 'travel';
  if (/(knife|multitool|pliers|flashlight|torch|edc|pocket tool|victorinox|leatherman)/.test(haystack)) return 'edc';
  if (/(pan|skillet|pressure cooker|cookware|kitchen|chef knife|knife set)/.test(haystack)) return 'kitchen';
  if (/(chair|laptop|keyboard|mouse|monitor|office|desk|tech|headphone)/.test(haystack)) return 'tech';
  if (/(stroller|baby|parenting|high chair|infant|child)/.test(haystack)) return 'parenting';
  if (/(vacuum|lighter|mattress|fan|home|appliance)/.test(haystack)) return 'home';

  return null;
}

function normalizeCandidateCategory(raw) {
  const explicitCategory = firstText(raw.category, raw.type, raw.segment, raw.vertical, raw.department);
  if (explicitCategory) {
    try {
      return normalizeCategory(explicitCategory);
    } catch {
      const inferredFromExplicit = inferCategoryFromText(explicitCategory);
      if (inferredFromExplicit) return inferredFromExplicit;
    }
  }

  const inferred = inferCategoryFromText(
    [
      raw.name,
      raw.title,
      raw.product_name,
      raw.productName,
      raw.item_name,
      raw.model,
      raw.brand,
      raw.manufacturer,
      raw.research_notes,
      raw.source_notes,
      raw.notes,
      raw.reddit_context,
      raw.description
    ]
      .filter(Boolean)
      .join(' ')
  );

  return inferred || 'tech';
}

function normalizeCandidate(raw, index) {
  if (typeof raw === 'string') {
    return {
      name: raw.trim(),
      brand: 'Unknown',
      category: normalizeCandidateCategory({ name: raw }),
      price_inr: null,
      price_usd: null,
      affiliate_links: [],
      image_url: null,
      reddit_context: null,
      research_notes: null
    };
  }

  const candidate = unwrapCandidateObject(raw);

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error(`Candidate ${index + 1} is not an object`);
  }

  const name =
    firstText(
      candidate.name,
      candidate.title,
      candidate.product_name,
      candidate.productName,
      candidate.item_name,
      candidate.model
    ) || `Candidate ${index + 1}`;

  if (name === `Candidate ${index + 1}`) {
    console.warn(
      `[pipeline] Candidate ${index + 1} came back without a clear name. Using fallback name. Keys: ${Object.keys(candidate).join(', ')}`
    );
  }

  const affiliateLinks = [
    ...normalizeAffiliateLinks(candidate.affiliate_links),
    ...buildLegacyAffiliateLinks(candidate)
  ];

  return {
    name,
    brand: firstText(candidate.brand, candidate.manufacturer, candidate.maker) || 'Unknown',
    category: normalizeCandidateCategory(candidate),
    price_inr: parseNullableInt(candidate.price_inr ?? candidate.price ?? candidate.priceInr),
    price_usd: parseNullableInt(candidate.price_usd ?? candidate.priceUsd),
    affiliate_links: affiliateLinks,
    image_url: firstText(candidate.image_url, candidate.image, candidate.imageUrl, candidate.photo_url),
    reddit_context: firstText(candidate.reddit_context, candidate.community_sentiment, candidate.reddit_notes),
    research_notes:
      firstText(
        candidate.research_notes,
        candidate.source_notes,
        candidate.notes,
        candidate.description,
        candidate.summary,
        candidate.reddit_context
      )
  };
}

function normalizeProduct(raw, index) {
  const candidate = normalizeCandidate(raw, index);
  const status = normalizeStatus(raw.status, candidate.affiliate_links);

  return {
    ...candidate,
    scores: normalizeScores(raw),
    specs: normalizeSpecs(raw),
    award_type: normalizeAwardType(firstText(raw.award_type, raw.award, raw.badge)),
    summary: normalizeText(firstText(raw.summary, raw.editorial_summary, raw.verdict, raw.research_notes)),
    reddit_sentiment: normalizeText(firstText(raw.reddit_sentiment, raw.community_sentiment, raw.reddit_context)),
    estimated_lifespan_years: parseNullableInt(raw.estimated_lifespan_years ?? raw.lifespan_years),
    estimated_lifespan_multiplier: parseNullableNumber(raw.estimated_lifespan_multiplier ?? raw.lifespan_multiplier),
    week_of: normalizeText(raw.week_of) || weekOf,
    is_featured: normalizeBoolean(raw.is_featured, false),
    status,
    pipeline_status: normalizePipelineStatus(raw.pipeline_status, status),
    image_candidates: Array.isArray(raw.image_candidates) ? raw.image_candidates.filter(Boolean) : [],
    image_approved: normalizeBoolean(raw.image_approved, false),
    admin_notes: normalizeText(raw.admin_notes),
    description_draft: normalizeText(raw.description_draft),
    video_url: normalizeText(raw.video_url)
  };
}

function finalizeProducts(products) {
  const normalizedProducts = products.map((product, index) => normalizeProduct(product, index));
  if (!normalizedProducts.some((product) => product.is_featured) && normalizedProducts.length > 0) {
    normalizedProducts[0].is_featured = true;
  }
  return normalizedProducts;
}

async function callOllama(prompt) {
  const payload = JSON.stringify({
    model: runtime.ollamaModel,
    prompt,
    stream: false,
    format: 'json',
    options: { temperature: 0.4 }
  });

  return new Promise((resolvePromise, rejectPromise) => {
    const request = http.request(
      {
        hostname: runtime.ollamaHost,
        port: runtime.ollamaPort,
        path: '/api/generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (response) => {
        let responseData = '';
        response.on('data', (chunk) => {
          responseData += chunk;
        });
        response.on('end', () => {
          if (response.statusCode !== 200) {
            rejectPromise(new Error(`Ollama API error ${response.statusCode}`));
            return;
          }

          try {
            const parsed = JSON.parse(responseData);
            resolvePromise(String(parsed.response || ''));
          } catch (error) {
            rejectPromise(error);
          }
        });
      }
    );

    request.on('error', (error) => {
      if (error.code === 'ECONNREFUSED') {
        rejectPromise(
          new Error(`Unable to reach Ollama at http://${runtime.ollamaHost}:${runtime.ollamaPort}. Is Ollama running?`)
        );
        return;
      }

      rejectPromise(error);
    });

    request.write(payload);
    request.end();
  });
}

const GEMINI_RETRIES = 3;
const GEMINI_INITIAL_DELAY_MS = 30000;

function delay(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function callGemini(prompt, options = {}) {
  const { search = false, attempt = 1 } = options;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${runtime.geminiModel}:generateContent?key=${runtime.geminiApiKey}`,
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: search ? [{ googleSearch: {} }] : undefined,
        generationConfig: { temperature: 0.4 }
      }
    );

    return response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (error) {
    const status = error?.response?.status;
    if (status === 429 && attempt <= GEMINI_RETRIES) {
      const delayMs = GEMINI_INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(`[pipeline] Gemini rate limited, retrying in ${delayMs / 1000}s`);
      await delay(delayMs);
      return callGemini(prompt, { search, attempt: attempt + 1 });
    }

    if (error?.response?.data) {
      writeFileSync('error.json', JSON.stringify(error.response.data, null, 2));
      throw new Error(`Gemini API error ${status}`);
    }

    throw error;
  }
}

async function callClaude(prompt) {
  const client = new Anthropic({ apiKey: runtime.claudeApiKey });
  const message = await client.messages.create({
    model: runtime.claudeModel,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }]
  });
  return message.content[0]?.type === 'text' ? message.content[0].text : '';
}

const providers = {
  ollama: {
    async generateCandidates() {
      console.log(`[pipeline] Step 1: generating ${runtime.totalCandidates} candidates via Ollama (${runtime.ollamaModel})`);

      const prompt = `You are a Buy It For Life product researcher focused on Indian buyers.
Return ONLY a JSON array with exactly ${runtime.totalCandidates} durable product candidates across these categories: ${CATEGORY_NAMES}.

Each object must follow this shape:
{
  "name": "Product Name",
  "brand": "Brand",
  "category": "${categories[0]?.value || 'kitchen'}",
  "price_inr": 1234,
  "price_usd": 15,
  "affiliate_links": [
    { "store": "Amazon", "url": "https://www.amazon.in/s?k=Product+Name", "is_affiliate": false }
  ],
  "image_url": "https://example.com/product.jpg",
  "research_notes": "1-2 sentence research note about why this is durable and relevant."
}

Use only categories from this set: ${CATEGORY_NAMES}.`;

      const raw = await callOllama(prompt);
      const payload = parseJsonPayload(raw, 'Ollama candidate response');
      const candidateArray = extractArray(payload, ['candidates', 'products', 'items', 'results']);
      if (!candidateArray) {
        throw new Error('Ollama candidate response did not contain an array');
      }

      return candidateArray.map((candidate, index) => normalizeCandidate(candidate, index));
    },

    async scoreCandidates(candidates) {
      console.log(`[pipeline] Step 2: scoring ${candidates.length} candidate(s) via Ollama`);

      const products = [];
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        console.log(`[pipeline]   scoring ${index + 1}/${candidates.length}: ${candidate.name}`);

        const prompt = `You are the BIFL365 editorial scorer.
Score this product and return ONLY a single JSON object.

PRODUCT:
${JSON.stringify(candidate, null, 2)}

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
  "is_featured": ${index === 0 ? 'true' : 'false'}
}

Allowed award_type values: value_buy, forever_pick, hidden_gem, current_star, null.`;

        const raw = await callOllama(prompt);
        const payload = parseJsonPayload(raw, `Ollama scoring response for ${candidate.name}`);
        products.push({
          ...candidate,
          ...payload,
          week_of: weekOf
        });
      }

      return finalizeProducts(products);
    },

    async generateContent(products) {
      console.log(`[pipeline] Step 3: generating content via Ollama`);

      const featuredProducts = products.filter((product) => product.is_featured);
      const awardWinners = products.filter((product) => product.award_type);

      const prompt = `You are the BIFL365 content editor.
Return ONLY a JSON object with these exact keys:
{
  "youtube_script": "Text",
  "instagram_slide_1": "Text",
  "instagram_slide_2": "Text",
  "instagram_slide_3": "Text",
  "instagram_slide_4": "Text",
  "instagram_slide_5": "Text",
  "blog_post": "Markdown text"
}

FEATURED:
${JSON.stringify(featuredProducts, null, 2)}

AWARDS:
${JSON.stringify(awardWinners, null, 2)}`;

      const raw = await callOllama(prompt);
      return normalizeContent(parseJsonPayload(raw, 'Ollama content response'));
    }
  },

  gemini: {
    async generateCandidates() {
      console.log(`[pipeline] Step 1: generating ${runtime.totalCandidates} candidates via Gemini (${runtime.geminiModel})`);

      const prompt = `You are a Buy It For Life product expert targeting Indian buyers.
Surface exactly ${runtime.totalCandidates} durable product candidates across these categories: ${CATEGORY_NAMES}.
Prefer products that are available in India and have meaningful real-world reputation.

Return ONLY a JSON array of objects with:
{
  "name": "Product Name",
  "brand": "Brand",
  "category": "${categories[0]?.value || 'kitchen'}",
  "price_inr": 1234,
  "price_usd": 15,
  "affiliate_links": [
    { "store": "Amazon", "url": "https://www.amazon.in/s?k=Product+Name", "is_affiliate": false },
    { "store": "Flipkart", "url": "https://www.flipkart.com/search?q=Product+Name", "is_affiliate": false }
  ],
  "image_url": "Real direct product image URL",
  "research_notes": "Short summary of reputation, cultural context, or community trust"
}

Return pure JSON only.`;

      const raw = await callGemini(prompt, { search: true });
      const payload = parseJsonPayload(raw, 'Gemini candidate response');
      const candidateArray = extractArray(payload, ['candidates', 'products', 'items', 'results']);
      if (!candidateArray) {
        throw new Error('Gemini candidate response did not contain an array');
      }

      return candidateArray.map((candidate, index) => normalizeCandidate(candidate, index));
    },

    async scoreCandidates(candidates) {
      console.log(`[pipeline] Step 2: scoring ${candidates.length} candidate(s) via Gemini`);

      const prompt = `You are the BIFL365 editorial AI.
Score the following product candidates and return ONLY a JSON array. Do not wrap in markdown.

PRODUCTS:
${JSON.stringify(candidates, null, 2)}

For each product include all original fields plus:
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
  "award_type": "value_buy" | "forever_pick" | "hidden_gem" | "current_star" | null,
  "summary": "100-200 word editorial summary",
  "reddit_sentiment": "Short community sentiment summary",
  "estimated_lifespan_years": 25,
  "estimated_lifespan_multiplier": 5,
  "week_of": "${weekOf}",
  "is_featured": true | false
}

At least one product must have is_featured=true.`;

      const raw = await callGemini(prompt, { search: true });
      const payload = parseJsonPayload(raw, 'Gemini scoring response');
      const productArray = extractArray(payload, ['products', 'items', 'results']);
      if (!productArray) {
        throw new Error('Gemini scoring response did not contain an array');
      }

      if (productArray.length !== candidates.length) {
        console.warn(
          `[pipeline] Gemini returned ${productArray.length} scored product(s) but expected ${candidates.length}. Some candidates may have been dropped.`
        );
      }

      return finalizeProducts(productArray);
    },

    async generateContent(products) {
      console.log(`[pipeline] Step 3: generating content via Gemini`);

      const prompt = `You are the BIFL365 content team.
Generate weekly promo content for these products and return ONLY a JSON object with these exact keys:
{
  "youtube_script": "600-word script",
  "instagram_slide_1": "Text",
  "instagram_slide_2": "Text",
  "instagram_slide_3": "Text",
  "instagram_slide_4": "Text",
  "instagram_slide_5": "Text",
  "blog_post": "Markdown blog post"
}

PRODUCTS:
${JSON.stringify(products, null, 2)}`;

      const raw = await callGemini(prompt, { search: false });
      return normalizeContent(parseJsonPayload(raw, 'Gemini content response'));
    }
  },

  claude: {
    async generateCandidates() {
      console.log(`[pipeline] Step 1: generating ${runtime.totalCandidates} candidates via Claude (${runtime.claudeModel})`);

      const prompt = `You are a Buy It For Life product expert targeting Indian buyers.
Surface exactly ${runtime.totalCandidates} durable product candidates across these categories: ${CATEGORY_NAMES}.
Prefer products that are available in India and have meaningful real-world reputation.

Return ONLY a JSON array of objects with:
{
  "name": "Product Name",
  "brand": "Brand",
  "category": "${categories[0]?.value || 'kitchen'}",
  "price_inr": 1234,
  "price_usd": 15,
  "affiliate_links": [
    { "store": "Amazon", "url": "https://www.amazon.in/s?k=Product+Name", "is_affiliate": false },
    { "store": "Flipkart", "url": "https://www.flipkart.com/search?q=Product+Name", "is_affiliate": false }
  ],
  "image_url": null,
  "research_notes": "Short summary of reputation, cultural context, or community trust"
}

Return pure JSON only. No markdown, no explanation.`;

      const raw = await callClaude(prompt);
      const payload = parseJsonPayload(raw, 'Claude candidate response');
      const candidateArray = extractArray(payload, ['candidates', 'products', 'items', 'results']);
      if (!candidateArray) {
        throw new Error('Claude candidate response did not contain an array');
      }

      return candidateArray.map((candidate, index) => normalizeCandidate(candidate, index));
    },

    async scoreCandidates(candidates) {
      console.log(`[pipeline] Step 2: scoring ${candidates.length} candidate(s) via Claude`);

      const prompt = `You are the BIFL365 editorial AI.
Score the following product candidates and return ONLY a JSON array. Do not wrap in markdown.

PRODUCTS:
${JSON.stringify(candidates, null, 2)}

For each product include all original fields plus:
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
  "award_type": "value_buy" | "forever_pick" | "hidden_gem" | "current_star" | null,
  "summary": "100-200 word editorial summary",
  "reddit_sentiment": "Short community sentiment summary",
  "estimated_lifespan_years": 25,
  "estimated_lifespan_multiplier": 5,
  "week_of": "${weekOf}",
  "is_featured": true | false
}

At least one product must have is_featured=true. Return pure JSON only.`;

      const raw = await callClaude(prompt);
      const payload = parseJsonPayload(raw, 'Claude scoring response');
      const productArray = extractArray(payload, ['products', 'items', 'results']);
      if (!productArray) {
        throw new Error('Claude scoring response did not contain an array');
      }

      if (productArray.length !== candidates.length) {
        console.warn(
          `[pipeline] Claude returned ${productArray.length} scored product(s) but expected ${candidates.length}. Some candidates may have been dropped.`
        );
      }

      return finalizeProducts(productArray);
    },

    async generateContent(products) {
      console.log(`[pipeline] Step 3: generating content via Claude`);

      const prompt = `You are the BIFL365 content team.
Generate weekly promo content for these products and return ONLY a JSON object with these exact keys:
{
  "youtube_script": "600-word script",
  "instagram_slide_1": "Text",
  "instagram_slide_2": "Text",
  "instagram_slide_3": "Text",
  "instagram_slide_4": "Text",
  "instagram_slide_5": "Text",
  "blog_post": "Markdown blog post"
}

PRODUCTS:
${JSON.stringify(products, null, 2)}

Return pure JSON only. No markdown fences.`;

      const raw = await callClaude(prompt);
      return normalizeContent(parseJsonPayload(raw, 'Claude content response'));
    }
  }
};

function normalizeContent(raw) {
  return {
    youtube_script: normalizeText(raw?.youtube_script) || '',
    instagram_slide_1: normalizeText(raw?.instagram_slide_1) || '',
    instagram_slide_2: normalizeText(raw?.instagram_slide_2) || '',
    instagram_slide_3: normalizeText(raw?.instagram_slide_3) || '',
    instagram_slide_4: normalizeText(raw?.instagram_slide_4) || '',
    instagram_slide_5: normalizeText(raw?.instagram_slide_5) || '',
    blog_post: normalizeText(raw?.blog_post) || ''
  };
}

function isSingleImportedProduct(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  if (Array.isArray(raw.products) || Array.isArray(raw.candidates)) return false;

  return Boolean(
    firstText(raw.name, raw.title, raw.product_name, raw.productName, raw.item_name, raw.model) ||
      raw.scores ||
      raw.specs
  );
}

function loadImportedBundle(importPath) {
  if (!importPath) {
    throw new Error('No import file configured');
  }

  console.log(`[pipeline] Step 1: loading imported research from ${importPath}`);
  const raw = readFileSync(importPath, 'utf-8');
  const payload = parseJsonPayload(raw, `imported research bundle (${basename(importPath)})`);

  if (Array.isArray(payload)) {
    if (payload.some((item) => looksLikePublishReadyProduct(item))) {
      return { products: finalizeProducts(payload), content: null };
    }
    return { candidates: payload.map((candidate, index) => normalizeCandidate(candidate, index)), content: null };
  }

  const products = extractArray(payload, ['products', 'scored_products', 'final_products'], false);
  if (products) {
    return {
      products: finalizeProducts(products),
      content: payload.content ? normalizeContent(payload.content) : null
    };
  }

  const candidates = extractArray(payload, ['candidates', 'research', 'items', 'results'], false);
  if (candidates) {
    return {
      candidates: candidates.map((candidate, index) => normalizeCandidate(candidate, index)),
      content: payload.content ? normalizeContent(payload.content) : null
    };
  }

  if (isSingleImportedProduct(payload)) {
    const content = payload.content ? normalizeContent(payload.content) : null;
    const hasScoredFields = looksLikePublishReadyProduct(payload);

    if (hasScoredFields) {
      return {
        products: finalizeProducts([payload]),
        content
      };
    }

    return {
      candidates: [normalizeCandidate(payload, 0)],
      content
    };
  }

  throw new Error('Import bundle did not contain candidates or products');
}

function getPendingImportFiles() {
  if (!runtime.importDir) return [];

  const pendingFiles = readdirSync(runtime.importDir)
    .map((name) => join(runtime.importDir, name))
    .filter((path) => existsSync(path) && statSync(path).isFile() && extname(path).toLowerCase() === '.json')
    .map((path) => ({ path, mtimeMs: statSync(path).mtimeMs }))
    .sort((a, b) => a.mtimeMs - b.mtimeMs);

  if (runtime.importSelection === 'latest') {
    return pendingFiles.length > 0 ? [pendingFiles[pendingFiles.length - 1]] : [];
  }

  return pendingFiles;
}

function moveImportedFile(sourcePath, destinationDir) {
  if (!destinationDir) return null;

  ensureDirectory(destinationDir);

  const extension = extname(sourcePath);
  const base = basename(sourcePath, extension);
  let destinationPath = join(destinationDir, `${base}${extension}`);

  if (existsSync(destinationPath)) {
    destinationPath = join(destinationDir, `${base}-${Date.now()}${extension}`);
  }

  renameSync(sourcePath, destinationPath);
  return destinationPath;
}

async function getCandidates(importPath = null) {
  if (runtime.researchSource === 'import') {
    return loadImportedBundle(importPath || runtime.importFile);
  }

  const provider = providers[runtime.researchProvider];
  if (!provider?.generateCandidates) {
    throw new Error(`Research provider "${runtime.researchProvider}" is not supported`);
  }

  return {
    candidates: await provider.generateCandidates(),
    content: null
  };
}

async function getProducts(inputBundle) {
  if (inputBundle.products?.length) {
    console.log(`[pipeline] Using ${inputBundle.products.length} imported scored product(s)`);
    return inputBundle.products;
  }

  if (!inputBundle.candidates?.length) {
    throw new Error('No candidates were available to score');
  }

  if (runtime.scoringProvider === 'none') {
    throw new Error(
      'Imported candidates require a scoring provider. Set PIPELINE_SCORING_PROVIDER=ollama or =gemini. ' +
        'Alternatively, ensure your import file contains fully scored products (with scores/scorecard fields), ' +
        'or use the pipeline:dropbox:publish script which skips scoring entirely.'
    );
  }

  const provider = providers[runtime.scoringProvider];
  if (!provider?.scoreCandidates) {
    throw new Error(`Scoring provider "${runtime.scoringProvider}" is not supported`);
  }

  return provider.scoreCandidates(inputBundle.candidates);
}

async function upsertProducts(products) {
  if (runtime.skipUpsert) {
    console.log('[pipeline] Skipping upsert because PIPELINE_SKIP_UPSERT=true');
    return { succeeded: 0, failed: [], total: products.length, skipped: true };
  }

  if (runtime.upsertMode === 'api') {
    console.log('[pipeline] Step 4: upserting via API');
    const response = await axios.post(`${runtime.siteUrl}/api/products/upsert`, products, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${runtime.serviceRoleKey}`
      }
    });

    return response.data;
  }

  console.log('[pipeline] Step 4: upserting directly to Supabase');
  const results = await Promise.allSettled(
    products.map(async (product) => {
      const { data, error } = await supabase
        .from('products')
        .upsert(product, { onConflict: 'name,week_of', ignoreDuplicates: false })
        .select('id, name')
        .single();

      if (error) throw error;
      return data;
    })
  );

  const succeeded = results.filter((result) => result.status === 'fulfilled').length;
  const failed = results
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason?.message || String(result.reason));

  return { succeeded, failed, total: products.length };
}

async function generateContent(products, inputBundle) {
  if (inputBundle.content) {
    console.log('[pipeline] Step 5: writing imported content bundle');
    return writeContentFiles(inputBundle.content);
  }

  if (runtime.contentProvider === 'none') {
    console.log('[pipeline] Step 5: no content provider selected, skipping content generation');
    return null;
  }

  const provider = providers[runtime.contentProvider];
  if (!provider?.generateContent) {
    throw new Error(`Content provider "${runtime.contentProvider}" is not supported`);
  }

  const content = await provider.generateContent(products);
  return writeContentFiles(content);
}

function writeContentFiles(content) {
  const outDir = join(process.cwd(), 'output', `week-${weekOf}`);
  mkdirSync(outDir, { recursive: true });

  writeFileSync(join(outDir, 'youtube-script.txt'), content.youtube_script || '');
  writeFileSync(join(outDir, 'instagram-slide-1.txt'), content.instagram_slide_1 || '');
  writeFileSync(join(outDir, 'instagram-slide-2.txt'), content.instagram_slide_2 || '');
  writeFileSync(join(outDir, 'instagram-slide-3.txt'), content.instagram_slide_3 || '');
  writeFileSync(join(outDir, 'instagram-slide-4.txt'), content.instagram_slide_4 || '');
  writeFileSync(join(outDir, 'instagram-slide-5.txt'), content.instagram_slide_5 || '');
  writeFileSync(join(outDir, 'blog-post.md'), content.blog_post || '');

  return outDir;
}

async function updateLatestRun(status, details = {}) {
  if (!supabase) return;

  try {
    const { data: run } = await supabase
      .from('pipeline_runs')
      .select('id')
      .eq('status', 'running')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!run) return;

    await supabase
      .from('pipeline_runs')
      .update({
        status,
        products_found: details.products_found ?? undefined,
        products_approved: details.products_approved ?? undefined,
        completed_at: new Date().toISOString()
      })
      .eq('id', run.id);
  } catch (error) {
    console.warn(`[pipeline] Unable to update pipeline_runs status: ${error.message}`);
  }
}

async function runPipelineOnce(importPath = null) {
  const inputBundle = await getCandidates(importPath);
  const products = await getProducts(inputBundle);
  const upsertResult = await upsertProducts(products);
  const outputDir = await generateContent(products, inputBundle);

  await updateLatestRun('success', {
    products_found: inputBundle.candidates?.length ?? products.length,
    products_approved: products.length
  });

  console.log('[pipeline] Complete');
  console.log(`[pipeline] Products processed: ${products.length}`);
  if (!upsertResult.skipped) {
    console.log(`[pipeline] Upserted: ${upsertResult.succeeded}/${upsertResult.total}`);
  }
  if (outputDir) {
    console.log(`[pipeline] Content written to: ${outputDir}`);
  }
}

async function processImportDirectory() {
  const pendingFiles = getPendingImportFiles();

  if (pendingFiles.length === 0) {
    console.log(`[pipeline] No pending import JSON files found in ${runtime.importDir}`);
    return;
  }

  console.log(`[pipeline] Found ${pendingFiles.length} pending import file(s) in ${runtime.importDir}`);

  let failedCount = 0;
  for (const file of pendingFiles) {
    console.log(`[pipeline] Processing import bundle ${basename(file.path)}`);

    try {
      await runPipelineOnce(file.path);
      if (runtime.archiveImports) {
        const archivedPath = moveImportedFile(file.path, runtime.importProcessedDir);
        console.log(`[pipeline] Archived processed bundle to ${archivedPath}`);
      }
    } catch (error) {
      failedCount += 1;
      console.error(`[pipeline] Failed while processing ${basename(file.path)}`);
      console.error(error.stack || error.message || error);
      await updateLatestRun('failed');

      if (runtime.archiveImports) {
        const failedPath = moveImportedFile(file.path, runtime.importFailedDir);
        console.log(`[pipeline] Moved failed bundle to ${failedPath}`);
      }
    }
  }

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

async function main() {
  console.log('[pipeline] BIFL365 flexible pipeline');
  console.log(
    `[pipeline] mode=${runtime.researchSource} research=${runtime.researchProvider} score=${runtime.scoringProvider} content=${runtime.contentProvider}`
  );

  try {
    if (runtime.researchSource === 'import' && runtime.importDir && !runtime.importFile) {
      await processImportDirectory();
      return;
    }

    await runPipelineOnce(runtime.importFile || null);
  } catch (error) {
    console.error('[pipeline] Failed');
    console.error(error.stack || error.message || error);
    await updateLatestRun('failed');
    process.exitCode = 1;
  }
}

main();
