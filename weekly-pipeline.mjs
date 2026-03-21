#!/usr/bin/env node
/**
 * weekly-pipeline.js
 *
 * Workflow:
 * 1. Gemini gemini-2.0-flash → surfaces 10 BIFL candidates from Reddit knowledge + product expertise
 * 2. Gemini gemini-2.0-flash → scores each on 5 dimensions + 200-word summary
 * 3. Gemini picks 3 award winners (best_buy, forever_pick, hidden_gem), marks 1 as featured
 * 4. POSTs to /api/products/upsert
 * 5. Writes output files to /output/week-YYYY-MM-DD/
 *    - youtube-script.txt
 *    - instagram-slide-1.txt … instagram-slide-5.txt
 *    - blog-post.md
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import axios from 'axios';
import { join } from 'path';

const configData = JSON.parse(readFileSync(join(process.cwd(), 'bifl365.config.json'), 'utf-8'));
const { pipeline, categories } = configData;
const CATEGORY_NAMES = categories.map(c => c.value).join('|');
const AUTO_APPROVE = pipeline.auto_approve_mode;
const PRODUCTS_PER_CATEGORY = pipeline.products_per_category || 2;
// Phase 2: Limiting to 3 total candidates per run to bypass API limits and do deep research
const TOTAL_CANDIDATES = 3;

config();

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!GEMINI_KEY || !SERVICE_ROLE_KEY) {
  console.error('Missing required env vars: GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;
  try {
    const response = await axios.post(url, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }],
      generationConfig: { temperature: 0.7 }
    });
    const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
  } catch (err) {
    if (err.response) {
      console.error("AXIOS ERROR DATA:", JSON.stringify(err.response.data, null, 2));
      writeFileSync('error.json', JSON.stringify(err.response.data, null, 2));
      throw new Error(`Gemini API Error: ${err.response.status}`);
    }
    throw err;
  }
}

const weekOf = new Date().toISOString().split('T')[0];

// ─── Step 1: Gemini surfaces candidates ───────────────────────────────────────

async function getCandidates() {
  console.log(`📡 Step 1: Asking Gemini to surface ${TOTAL_CANDIDATES} BIFL candidates…`);

  const prompt = `You are a BIFL (Buy It For Life) product expert targeting Indian buyers.

Surface exactly ${TOTAL_CANDIDATES} BIFL product candidates for this week. Focus on products that are:
- Genuinely built to last (not just "premium")
- Available or orderable in India (Amazon India / Flipkart preferred)
- Across these categories: ${categories.map(c => c.value).join(', ')} (Pick any category, but CRITICAL: for watches, try to include the Casio F91W or a Seiko 5 if not done recently).
- Mix of price ranges (at least 3 under ₹5000, at least 2 over ₹20000)
- Trending or discussed on Reddit (r/BuyItForLife, r/india, r/IndianGaming etc.)

Return ONLY a JSON array of ${TOTAL_CANDIDATES} objects with these fields:
{
  "name": "Product Name",
  "brand": "Brand",
  "category": "${CATEGORY_NAMES}",
  "price_inr": 1234,
  "price_usd": 15,
  "affiliate_links": [
    { "store": "Amazon", "url": "https://www.amazon.in/s?k=...", "is_affiliate": false },
    { "store": "Flipkart", "url": "https://www.flipkart.com/search?q=...", "is_affiliate": false }
  ],
  "image_url": "Real direct image URL (jpg/png) via Google Search. Find an actual working image link from the manufacturer or retailer",
  "reddit_context": "Brief note on Reddit discussions about this product"
}

Return pure JSON array only. No markdown, no explanation.`;

  const jsonText = await callGemini(prompt);
  const candidates = JSON.parse(jsonText);
  console.log(`  ✓ Got ${candidates.length} candidates from Gemini`);
  return candidates;
}

const delay = ms => new Promise(res => setTimeout(res, ms));

// ─── Step 2 & 3: Gemini scores + picks winners ────────────────────────────────

async function scoreAndPick(candidates) {
  console.log('🤖 Step 2–3: Gemini scoring and picking award winners… (Waiting 65s for API Quota)');
  await delay(65000);

  const prompt = `You are the BIFL365 editorial AI. You must score each of these ${TOTAL_CANDIDATES} product candidates and pick award winners.

PRODUCTS:
${JSON.stringify(candidates, null, 2)}

SCORING: Score each product on 5 dimensions, each /20:
- build_quality: Materials, construction, QC
- longevity: Expected lifespan with normal use
- value: Price-to-durability ratio for Indian buyers
- repairability: Parts availability, ability to service/repair
- india_availability: Amazon India / Flipkart / local availability

AWARDS (pick exactly 3, one per type):
- best_buy: Best price-to-durability ratio
- forever_pick: Absolute best BIFL quality regardless of price
- hidden_gem: Under-the-radar pick most people haven't heard of

Mark AT LEAST 1 product as is_featured: true (the most interesting / newsworthy this run).

CRITICAL WRITING RULES for summaries:
- Do NOT use AI-sounding phrases like "In conclusion", "It is worth noting", "Furthermore", or "Delving into".
- Do NOT use em dashes (—) or overuse adjectives. Write in a direct, punchy, human editorial tone.

For each product write:
- summary: 200-word editorial analysis. Research deep cultural context, famous nicknames, and Reddit lore (e.g., Casio F91W's "Obama to Osama" reputation).
- reddit_sentiment: 50-word summary of Reddit community sentiment (no em dashes).
- estimated_lifespan_years: A conservative estimate in years of how long the product will last (e.g. 25).
- estimated_lifespan_multiplier: A number representing how many times longer this product lasts compared to the industry average (e.g. 5).

Return ONLY a JSON array of all ${TOTAL_CANDIDATES} products with ALL original fields PLUS:
{
  "scores": { "build_quality": N, "longevity": N, "value": N, "repairability": N, "india_availability": N },
  "specs": { "material": "...", "warranty": "...", "repairability_score": N, "made_in": "...", "weight": "..." },
  "award_type": "best_buy"|"forever_pick"|"hidden_gem"|null,
  "summary": "200-word summary with deep cultural lore",
  "reddit_sentiment": "50-word reddit sentiment",
  "estimated_lifespan_years": 25,
  "estimated_lifespan_multiplier": 5,
  "week_of": "${weekOf}",
  "is_featured": true|false
}

Remove the "reddit_context" field. Return pure JSON array only.`;

  const jsonText = await callGemini(prompt);
  const productsRaw = JSON.parse(jsonText);
  
  // Enforce Indian affiliate link requirement before publishing
  const products = productsRaw.map(p => {
    const hasLinks = p.affiliate_links && p.affiliate_links.length > 0;
    p.status = AUTO_APPROVE && hasLinks ? 'published' : 'draft';
    return p;
  });

  console.log(`  ✓ Gemini scored ${products.length} products, selected awards (and applied safety checks)`);
  return products;
}

// ─── Step 4: POST to upsert API ───────────────────────────────────────────────

async function upsertProducts(products) {
  console.log('💾 Step 4: Upserting to Supabase via API…');

  try {
    const response = await axios.post(`${SITE_URL}/api/products/upsert`, products, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      }
    });
    
    const result = response.data;
    console.log(`  ✓ Upserted ${result.succeeded}/${result.total} products`);
    if (result.failed?.length > 0) {
      console.warn(`  ⚠ ${result.failed.length} failures:`, result.failed);
    }
    return result;
  } catch (err) {
      if (err.response) {
        throw new Error(`Upsert failed: ${JSON.stringify(err.response.data)}`);
      }
      throw err;
  }
}

// ─── Step 5: Generate content files ───────────────────────────────────────────

async function generateContent(products) {
  console.log('✍️  Step 5: Generating content files with Gemini… (Waiting 65s for API Quota)');
  await delay(65000);

  const featured = products.filter((p) => p.is_featured);
  if (featured.length === 0) featured.push(products[0]);
  const winners = products.filter((p) => p.award_type);

  const featuredDetails = featured.map(f => {
    const score = f.scores ? Object.values(f.scores).reduce((a, b) => a + b, 0) : 0;
    return `- ${f.name} by ${f.brand} (${f.category}): ₹${f.price_inr} ($${f.price_usd})\n  Score: ${score}/100\n  Summary: ${f.summary}\n  Reddit: ${f.reddit_sentiment}`;
  }).join('\n\n');

  const prompt = `You are the BIFL365 content team. Generate all content for this week.

FEATURED PRODUCTS (Focus primarily on these ${featured.length} products, especially Casio and Seiko):
${featuredDetails}

ALL AWARD WINNERS this week:
${winners.map((w) => `- ${w.award_type.toUpperCase()}: ${w.name} by ${w.brand} (${w.category})`).join('\n')}

CRITICAL WRITING RULES:
- Do NOT use AI-sounding transitions like "In conclusion", "It is worth noting", "Furthermore", or "Delving into".
- Do NOT use em dashes (—) or overuse exclamation marks.
- Write in a direct, punchy, human editorial tone as if written by a passionate product expert.

Generate ALL of the following. Return as a JSON object with these keys:
{
  "youtube_script": "600-word YouTube video script with hook, 3 main sections, call to action. Mention bifl365.com. Energetic but knowledgeable tone.",
  "instagram_slide_1": "Slide 1 text: Hook slide — title and key stat",
  "instagram_slide_2": "Slide 2 text: Product feature highlight",
  "instagram_slide_3": "Slide 3 text: Score breakdown — conversational",
  "instagram_slide_4": "Slide 4 text: Reddit says...",
  "instagram_slide_5": "Slide 5 text: Call to action + all 3 award winners",
  "blog_post": "800-word SEO blog post with title H1, meta description comment at top, 3-4 sections with H2s, India-specific angle, and explicitly including segments on Cultural Impact & Lore."
}

Return pure JSON only.`;

  const jsonText = await callGemini(prompt);
  const content = JSON.parse(jsonText);

  // Write files
  const outDir = join(process.cwd(), 'output', `week-${weekOf}`);
  mkdirSync(outDir, { recursive: true });

  writeFileSync(join(outDir, 'youtube-script.txt'), content.youtube_script);
  for (let i = 1; i <= 5; i++) {
    writeFileSync(join(outDir, `instagram-slide-${i}.txt`), content[`instagram_slide_${i}`]);
  }
  writeFileSync(join(outDir, 'blog-post.md'), content.blog_post);

  console.log(`  ✓ Content files written to output/week-${weekOf}/`);
  return outDir;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 BIFL365 Weekly Pipeline — ${weekOf}\n${'─'.repeat(50)}`);

  try {
    const candidates = await getCandidates();
    const products = await scoreAndPick(candidates);
    await upsertProducts(products);
    const outDir = await generateContent(products);

    console.log(`\n✅ Pipeline complete!`);
    console.log(`   Products in DB: ${products.length}`);
    console.log(`   Content files:  ${outDir}`);
  } catch (err) {
    console.error('\n❌ Pipeline failed:');
    console.error(err.stack || err);
    process.exit(1);
  }
}

main();
