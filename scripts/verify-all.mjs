#!/usr/bin/env node

/**
 * Interactive link fixer for all products.
 *
 * Usage:
 *   node scripts/verify-all.mjs --flipkart            # fix only Flipkart links
 *   node scripts/verify-all.mjs --amazon               # fix only Amazon links
 *   node scripts/verify-all.mjs --brand                # fix only brand/official links
 *   node scripts/verify-all.mjs --all                  # fix all link types (default)
 *   node scripts/verify-all.mjs --flipkart --amazon    # fix Flipkart + Amazon
 *   node scripts/verify-all.mjs --all --auto           # skip per-product confirm, ask once at end
 *
 * Flow:
 *   1. Scan all products for broken/missing links of selected types
 *   2. Use Gemini Search to find correct URLs
 *   3. Show old → new comparison with clickable hyperlinks
 *   4. Confirm before writing to database
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'readline';

// ─── Config ──────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const AFFILIATE_TAG = 'bifl365-21';

if (!supabaseUrl || !serviceKey) { console.error('Missing SUPABASE env vars'); process.exit(1); }
if (!apiKey) { console.error('Missing GEMINI_API_KEY'); process.exit(1); }

const sb = createClient(supabaseUrl, serviceKey);

// ─── CLI flags ───────────────────────────────────────────────────────────

const args = new Set(process.argv.slice(2).map(a => a.toLowerCase()));
const AUTO_MODE = args.has('--auto');

// If none specified or --all, enable everything
const explicit = args.has('--amazon') || args.has('--flipkart') || args.has('--brand');
const FIX_AMAZON   = !explicit || args.has('--all') || args.has('--amazon');
const FIX_FLIPKART = !explicit || args.has('--all') || args.has('--flipkart');
const FIX_BRAND    = !explicit || args.has('--all') || args.has('--brand');

// ─── Terminal helpers ────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', white: '\x1b[37m',
  bgRed: '\x1b[41m', bgGreen: '\x1b[42m', bgYellow: '\x1b[43m',
};

/** OSC 8 clickable hyperlink in terminal */
function link(url, label) {
  if (!url) return label || '(none)';
  const display = label || url;
  return `\x1b]8;;${url}\x07${C.cyan}${display}${C.reset}\x1b]8;;\x07`;
}

function hr(ch = '─', len = 70) { return C.dim + ch.repeat(len) + C.reset; }

const rl = createInterface({ input: process.stdin, output: process.stdout });
function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Store validation rules ─────────────────────────────────────────────

const STORE_VALIDATORS = {
  amazon: {
    label: 'Amazon',
    match: (url) => {
      try { const h = new URL(url).hostname; return h.includes('amazon.in') || h.includes('amazon.com'); }
      catch { return false; }
    },
    isValid: (url) => {
      try { return new URL(url).pathname.match(/\/(dp|gp\/product)\/[A-Z0-9]{10}/i) !== null; }
      catch { return false; }
    },
    fix: (url) => {
      try {
        const u = new URL(url);
        u.searchParams.set('tag', AFFILIATE_TAG);
        return u.toString();
      } catch { return url; }
    },
  },
  flipkart: {
    label: 'Flipkart',
    match: (url) => {
      try { return new URL(url).hostname.includes('flipkart.com'); }
      catch { return false; }
    },
    isValid: (url) => {
      try {
        const p = new URL(url).pathname;
        return p.includes('/p/') && !p.includes('/search') && !p.includes('/product-reviews/');
      } catch { return false; }
    },
    fix: (url) => url,
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
    fix: (url) => url,
  },
};

// Which stores are we fixing?
const activeStores = [];
if (FIX_AMAZON) activeStores.push('amazon');
if (FIX_FLIPKART) activeStores.push('flipkart');
if (FIX_BRAND) activeStores.push('brand');

// ─── Gemini helpers ──────────────────────────────────────────────────────

async function callGemini(prompt, attempt = 1) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
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
  if (res.status === 429 && attempt <= 5) {
    const wait = 10 * attempt;
    console.log(`  ${C.yellow}Rate limited, waiting ${wait}s...${C.reset}`);
    await delay(wait * 1000);
    return callGemini(prompt, attempt + 1);
  }
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text().catch(() => '')}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function parseJson(raw) {
  const v = raw.trim();
  const m = v.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (m?.[1]) try { return JSON.parse(m[1].trim()); } catch {}
  const f = v.indexOf('{'), l = v.lastIndexOf('}');
  if (f !== -1 && l > f) try { return JSON.parse(v.slice(f, l + 1)); } catch {}
  return null;
}

function buildPrompt(product, stores) {
  const storeInstructions = [];

  if (stores.includes('amazon')) {
    storeInstructions.push(
      `1. Amazon India (amazon.in): Find the REAL product page with ASIN. URL format: https://www.amazon.in/dp/REAL_ASIN\n   - MUST contain /dp/ followed by a 10-character ASIN code\n   - Do NOT return search pages (/s?k=...)`
    );
  }
  if (stores.includes('flipkart')) {
    storeInstructions.push(
      `2. Flipkart: Find the REAL product page URL. Format: https://www.flipkart.com/product-slug/p/PRODUCT_ID\n   - MUST contain /p/ followed by product identifier\n   - Do NOT return search pages (/search?q=...), category pages, deal pages, or review pages`
    );
  }
  if (stores.includes('brand')) {
    storeInstructions.push(
      `3. Brand/Official: Find the manufacturer's official product page URL if it exists.\n   - Must be the brand's own domain (not a marketplace)`
    );
  }

  return `Search for this product and find REAL, VERIFIED purchase links.

Product: "${product.name}" by ${product.brand || 'unknown brand'}
${product.category ? `Category: ${product.category}` : ''}

Find these links:
${storeInstructions.join('\n\n')}

Return ONLY a JSON object:
{
  "affiliate_links": [
    ${stores.includes('amazon') ? '{ "store": "Amazon", "url": "https://www.amazon.in/dp/REAL_ASIN", "is_affiliate": true },' : ''}
    ${stores.includes('flipkart') ? '{ "store": "Flipkart", "url": "https://www.flipkart.com/product-slug/p/REAL_PID", "is_affiliate": false },' : ''}
    ${stores.includes('brand') ? '{ "store": "Brand Store", "url": "https://brand.com/product-page", "is_affiliate": false }' : ''}
  ]
}

CRITICAL: Only include URLs you actually found via search. Do NOT guess or hallucinate URLs.
If a store link cannot be found, OMIT that entry entirely — do not include null or placeholder URLs.`;
}

// ─── Product analysis ────────────────────────────────────────────────────

function analyzeProduct(product) {
  const links = Array.isArray(product.affiliate_links) ? product.affiliate_links : [];
  const issues = {}; // storeKey → { current, status }

  for (const storeKey of activeStores) {
    const validator = STORE_VALIDATORS[storeKey];
    const existing = links.find(l => validator.match(l.url));

    if (!existing) {
      issues[storeKey] = { current: null, status: 'missing' };
    } else if (!validator.isValid(existing.url)) {
      issues[storeKey] = { current: existing, status: 'broken' };
    }
    // else: valid — no issue
  }

  return issues;
}

// ─── Main ────────────────────────────────────────────────────────────────

console.log(`\n${C.bold}${'═'.repeat(70)}${C.reset}`);
console.log(`${C.bold}  BIFL365 Link Fixer${C.reset}`);
console.log(`  Stores: ${activeStores.map(s => STORE_VALIDATORS[s].label).join(', ')}`);
console.log(`  Mode: ${AUTO_MODE ? 'Auto (confirm once at end)' : 'Interactive (confirm per product)'}`);
console.log(`${C.bold}${'═'.repeat(70)}${C.reset}\n`);

// Fetch all products
const { data: allProducts, error } = await sb
  .from('products')
  .select('id, name, brand, category, affiliate_links, status')
  .order('name');

if (error) { console.error('DB error:', error.message); process.exit(1); }
console.log(`Total products: ${C.bold}${allProducts.length}${C.reset}\n`);

// Phase 1: Scan for issues
console.log(`${C.bold}Phase 1: Scanning for broken/missing links...${C.reset}\n`);

const productsWithIssues = [];

for (const p of allProducts) {
  const issues = analyzeProduct(p);
  if (Object.keys(issues).length > 0) {
    productsWithIssues.push({ product: p, issues });
  }
}

if (productsWithIssues.length === 0) {
  console.log(`${C.green}All products have valid links for selected stores. Nothing to fix!${C.reset}\n`);
  rl.close();
  process.exit(0);
}

// Show summary
console.log(`${C.yellow}Found ${productsWithIssues.length} product(s) with issues:${C.reset}\n`);

for (const { product, issues } of productsWithIssues) {
  const tags = Object.entries(issues).map(([store, info]) => {
    const label = STORE_VALIDATORS[store].label;
    const color = info.status === 'missing' ? C.red : C.yellow;
    return `${color}${label}: ${info.status}${C.reset}`;
  });
  console.log(`  ${product.name.substring(0, 50).padEnd(50)} ${tags.join('  ')}`);
}

console.log('');

const proceed = await ask(`${C.bold}Proceed to search for correct links? (y/n): ${C.reset}`);
if (proceed.toLowerCase() !== 'y') {
  console.log('Aborted.');
  rl.close();
  process.exit(0);
}

// Phase 2: Search for correct links via Gemini
console.log(`\n${C.bold}Phase 2: Searching for correct links via Gemini...${C.reset}\n`);

/** @type {{ product: any, oldLinks: any[], newLinks: any[], changes: { store: string, old: string|null, new: string|null, storeKey: string }[] }[]} */
const proposals = [];

for (let i = 0; i < productsWithIssues.length; i++) {
  const { product, issues } = productsWithIssues[i];
  const tag = `[${i + 1}/${productsWithIssues.length}]`;
  const storesToFix = Object.keys(issues);

  process.stdout.write(`${C.dim}${tag}${C.reset} ${product.name.substring(0, 50).padEnd(50)} `);

  try {
    const prompt = buildPrompt(product, storesToFix);
    const raw = await callGemini(prompt);
    const parsed = parseJson(raw);

    if (!parsed || !Array.isArray(parsed.affiliate_links)) {
      console.log(`${C.red}✗ parse failed${C.reset}`);
      if (i < productsWithIssues.length - 1) await delay(2000);
      continue;
    }

    const existingLinks = Array.isArray(product.affiliate_links) ? [...product.affiliate_links] : [];
    const changes = [];

    for (const storeKey of storesToFix) {
      const validator = STORE_VALIDATORS[storeKey];
      const issue = issues[storeKey];

      // Find the Gemini suggestion for this store
      const suggestion = parsed.affiliate_links.find(l => {
        if (!l?.url || typeof l.url !== 'string') return false;
        return validator.match(l.url.trim());
      });

      if (!suggestion || !validator.isValid(suggestion.url.trim())) {
        // Gemini couldn't find a valid link for this store
        changes.push({
          store: validator.label,
          storeKey,
          old: issue.current?.url || null,
          new: null,
        });
        continue;
      }

      let newUrl = suggestion.url.trim();
      newUrl = validator.fix(newUrl); // apply store-specific fixes (e.g., affiliate tag)

      changes.push({
        store: validator.label,
        storeKey,
        old: issue.current?.url || null,
        new: newUrl,
      });
    }

    const foundCount = changes.filter(c => c.new).length;
    if (foundCount > 0) {
      console.log(`${C.green}✓ found ${foundCount}/${storesToFix.length}${C.reset}`);
      proposals.push({ product, oldLinks: existingLinks, changes });
    } else {
      console.log(`${C.yellow}~ no valid links found${C.reset}`);
    }

    if (i < productsWithIssues.length - 1) await delay(2500);
  } catch (e) {
    console.log(`${C.red}✗ ${e.message?.substring(0, 50)}${C.reset}`);
    await delay(4000);
  }
}

if (proposals.length === 0) {
  console.log(`\n${C.yellow}No valid replacement links found. Nothing to update.${C.reset}\n`);
  rl.close();
  process.exit(0);
}

// Phase 3: Review & Confirm
console.log(`\n${C.bold}${'═'.repeat(70)}${C.reset}`);
console.log(`${C.bold}  Phase 3: Review Proposed Changes (${proposals.length} products)${C.reset}`);
console.log(`${C.bold}${'═'.repeat(70)}${C.reset}\n`);

const approved = [];

for (let i = 0; i < proposals.length; i++) {
  const { product, oldLinks, changes } = proposals[i];
  const hasNewLinks = changes.some(c => c.new);
  if (!hasNewLinks) continue;

  console.log(`${C.bold}${C.white}[${i + 1}/${proposals.length}] ${product.name}${C.reset}`);
  console.log(`${C.dim}  Brand: ${product.brand || 'N/A'}  |  Category: ${product.category || 'N/A'}  |  Status: ${product.status || 'N/A'}${C.reset}`);
  console.log(hr());

  for (const change of changes) {
    if (!change.new && !change.old) continue;

    const storeLabel = `  ${change.store.padEnd(16)}`;

    if (change.old && change.new) {
      // Replacement
      console.log(`${storeLabel}${C.red}OLD:${C.reset} ${link(change.old, change.old.length > 80 ? change.old.substring(0, 77) + '...' : change.old)}`);
      console.log(`${' '.repeat(18)}${C.green}NEW:${C.reset} ${link(change.new, change.new.length > 80 ? change.new.substring(0, 77) + '...' : change.new)}`);
    } else if (!change.old && change.new) {
      // New link (was missing)
      console.log(`${storeLabel}${C.dim}OLD:${C.reset} ${C.dim}(missing)${C.reset}`);
      console.log(`${' '.repeat(18)}${C.green}NEW:${C.reset} ${link(change.new, change.new.length > 80 ? change.new.substring(0, 77) + '...' : change.new)}`);
    } else if (change.old && !change.new) {
      // Could not find replacement
      console.log(`${storeLabel}${C.yellow}OLD:${C.reset} ${link(change.old, change.old.length > 80 ? change.old.substring(0, 77) + '...' : change.old)}`);
      console.log(`${' '.repeat(18)}${C.dim}NEW: (not found — will keep old)${C.reset}`);
    }
  }

  console.log(hr());

  if (!AUTO_MODE) {
    const answer = await ask(`  ${C.bold}Apply these changes? (y)es / (n)o / (a)ll remaining / (q)uit: ${C.reset}`);
    const a = answer.toLowerCase().trim();

    if (a === 'q') {
      console.log('\nAborted. No further changes will be made.\n');
      break;
    } else if (a === 'a') {
      // Approve this and all remaining
      approved.push({ product, oldLinks, changes });
      for (let j = i + 1; j < proposals.length; j++) {
        if (proposals[j].changes.some(c => c.new)) {
          approved.push(proposals[j]);
        }
      }
      console.log(`\n${C.green}Approved all remaining ${approved.length - (approved.length - (proposals.length - i))} products.${C.reset}\n`);
      break;
    } else if (a === 'y') {
      approved.push({ product, oldLinks, changes });
      console.log(`  ${C.green}✓ Approved${C.reset}\n`);
    } else {
      console.log(`  ${C.yellow}✗ Skipped${C.reset}\n`);
    }
  } else {
    approved.push({ product, oldLinks, changes });
    console.log('');
  }
}

if (AUTO_MODE && approved.length > 0) {
  const answer = await ask(`\n${C.bold}Apply all ${approved.length} changes above? (y/n): ${C.reset}`);
  if (answer.toLowerCase().trim() !== 'y') {
    console.log('Aborted. No changes made.\n');
    rl.close();
    process.exit(0);
  }
}

if (approved.length === 0) {
  console.log(`\n${C.yellow}No changes approved. Database unchanged.${C.reset}\n`);
  rl.close();
  process.exit(0);
}

// Phase 4: Apply changes
console.log(`\n${C.bold}Phase 4: Writing ${approved.length} product(s) to database...${C.reset}\n`);

let written = 0, writeErrors = 0;

for (const { product, oldLinks, changes } of approved) {
  try {
    // Start with existing links
    let updatedLinks = [...oldLinks];

    for (const change of changes) {
      if (!change.new) continue; // no replacement found — keep old

      const validator = STORE_VALIDATORS[change.storeKey];

      // Remove old links for this store
      updatedLinks = updatedLinks.filter(l => !validator.match(l.url));

      // Add the new link
      const isAffiliate = change.storeKey === 'amazon';
      updatedLinks.push({
        store: change.store,
        url: change.new,
        is_affiliate: isAffiliate,
        link_type: change.storeKey === 'brand' ? 'brand' : 'affiliate',
      });
    }

    const { error: updateError } = await sb
      .from('products')
      .update({ affiliate_links: updatedLinks })
      .eq('id', product.id);

    if (updateError) throw updateError;

    console.log(`  ${C.green}✓${C.reset} ${product.name.substring(0, 55)}`);
    written++;
  } catch (e) {
    console.log(`  ${C.red}✗${C.reset} ${product.name.substring(0, 55)} — ${e.message?.substring(0, 40)}`);
    writeErrors++;
  }
}

// Summary
console.log(`\n${C.bold}${'═'.repeat(70)}${C.reset}`);
console.log(`${C.bold}  Summary${C.reset}`);
console.log(`${C.bold}${'═'.repeat(70)}${C.reset}`);
console.log(`  Products scanned:   ${allProducts.length}`);
console.log(`  Issues found:       ${productsWithIssues.length}`);
console.log(`  Proposals:          ${proposals.length}`);
console.log(`  Approved:           ${approved.length}`);
console.log(`  ${C.green}Written to DB:     ${written}${C.reset}`);
if (writeErrors > 0) console.log(`  ${C.red}Write errors:       ${writeErrors}${C.reset}`);
console.log(`${C.bold}${'═'.repeat(70)}${C.reset}\n`);

rl.close();
