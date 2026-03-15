#!/usr/bin/env node
// scripts/seed.mjs — Seeds 10 BIFL products (new 6-category schema with specs)
// Uses native fetch against Supabase REST API to avoid Windows WebSocket crash

import { config } from 'dotenv';

config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const weekOf = new Date().toISOString().split('T')[0];

const SEED_PRODUCTS = [
  // ── KITCHEN ──
  {
    name: 'Lodge Cast Iron Skillet 10 inch',
    brand: 'Lodge',
    category: 'kitchen',
    price_inr: 4500,
    price_usd: 35,
    scores: { build_quality: 20, longevity: 20, value: 18, repairability: 20, india_availability: 12 },
    specs: { material: 'Cast Iron', warranty: 'Lifetime', repairability_score: 10, made_in: 'USA' },
    award_type: 'best_buy',
    affiliate_url_amazon: 'https://www.amazon.in/dp/B00008GKDW',
    affiliate_url_flipkart: null,
    image_url: 'https://m.media-amazon.com/images/I/71zvoZtdb1L._AC_SX679_.jpg',
    summary: 'A cast iron skillet that can outlast civilizations. Lodge skillets improve with use, work on any heat source including induction, and can be fully restored even after rusting. Seasoning oils into the pores over decades creates a non-stick surface no Teflon can match.',
    reddit_sentiment: 'Legendary status on r/BuyItForLife. Cited as one of the top BIFL purchases ever. Some note newer Lodge pans have a rougher machine finish vs older smooth pans.',
    week_of: weekOf,
    is_featured: true,
  },
  {
    name: 'Kuhn Rikon Duromatic Pressure Cooker 5L',
    brand: 'Kuhn Rikon',
    category: 'kitchen',
    price_inr: 18000,
    price_usd: 200,
    scores: { build_quality: 19, longevity: 18, value: 14, repairability: 16, india_availability: 10 },
    specs: { material: '18/10 Stainless Steel', warranty: '10 years', repairability_score: 8, made_in: 'Switzerland' },
    award_type: 'forever_pick',
    affiliate_url_amazon: 'https://www.amazon.in/dp/B00009K2US',
    affiliate_url_flipkart: null,
    image_url: 'https://m.media-amazon.com/images/I/71DqV5NqL4L._AC_SX679_.jpg',
    summary: 'Swiss-engineered with the safest valve system in the industry. Replacement parts and gaskets remain available for decades. The pressure cooker you hand down to your grandchildren.',
    reddit_sentiment: 'High praise for safety, quiet operation, and decades of service. Price is the main concern, but owners say it pays for itself in energy savings alone.',
    week_of: weekOf,
    is_featured: false,
  },

  // ── EDC ──
  {
    name: 'Victorinox Swiss Army Tinker',
    brand: 'Victorinox',
    category: 'edc',
    price_inr: 2800,
    price_usd: 30,
    scores: { build_quality: 18, longevity: 19, value: 18, repairability: 15, india_availability: 14 },
    specs: { material: 'Stainless Steel + Celidor', warranty: 'Lifetime', repairability_score: 7, made_in: 'Switzerland', weight: '58g' },
    award_type: 'best_buy',
    affiliate_url_amazon: 'https://www.amazon.in/dp/B000A32A6W',
    affiliate_url_flipkart: 'https://www.flipkart.com/search?q=Victorinox+Swiss+Army+Tinker',
    image_url: 'https://m.media-amazon.com/images/I/71u7pI+Q4hL._AC_SX679_.jpg',
    summary: 'The 12-tool Tinker is the sweet spot of the Victorinox lineup. Swiss steel holds an edge unusually well and every tool clicks with precise Swiss-made tolerances. The lifetime guarantee covers manufacturing defects. Many owners report using the same knife for 20+ years.',
    reddit_sentiment: 'One of the most consistently recommended tools on r/BuyItForLife. Victorinox customer service praised for honouring the warranty without interrogation.',
    week_of: weekOf,
    is_featured: false,
  },
  {
    name: 'Zebra F-701 Ballpoint Pen',
    brand: 'Zebra',
    category: 'edc',
    price_inr: 1200,
    price_usd: 15,
    scores: { build_quality: 18, longevity: 19, value: 17, repairability: 16, india_availability: 13 },
    specs: { material: 'Stainless Steel (full body)', warranty: 'None declared', repairability_score: 9, made_in: 'Japan', weight: '26g' },
    award_type: 'hidden_gem',
    affiliate_url_amazon: 'https://www.amazon.in/dp/B002L6RB80',
    affiliate_url_flipkart: null,
    image_url: 'https://m.media-amazon.com/images/I/61mQYVJvHUL._AC_SY355_.jpg',
    summary: 'An all-stainless pen at a plastic pen price. The F-701 refills with standard Cross-type cartridges and will outlive any other pen you own. The grip knurling is aggressive enough to be functional without being uncomfortable.',
    reddit_sentiment: 'Beloved on r/BuyItForLife as "the pen that proves durability doesn\'t need to cost a lot." Common tip: replace the stock cartridge with a Fisher Space Pen refill immediately.',
    week_of: weekOf,
    is_featured: false,
  },

  // ── HOME INFRASTRUCTURE ──
  {
    name: 'Zippo Classic Brushed Chrome Lighter',
    brand: 'Zippo',
    category: 'home',
    price_inr: 3500,
    price_usd: 25,
    scores: { build_quality: 18, longevity: 20, value: 17, repairability: 20, india_availability: 15 },
    specs: { material: 'Chrome-plated Brass', warranty: 'Lifetime (unconditional)', repairability_score: 10, made_in: 'USA', weight: '60g' },
    award_type: 'best_buy',
    affiliate_url_amazon: 'https://www.amazon.in/dp/B000BNY64S',
    affiliate_url_flipkart: 'https://www.flipkart.com/search?q=Zippo+lighter',
    image_url: 'https://m.media-amazon.com/images/I/61cJ5u3x8gL._AC_SX679_.jpg',
    summary: 'Zippo has repaired every lighter they have ever made since 1932 — free of charge, no questions asked. The fully rebuildable insert mechanism means nothing inside is irreplaceable. The wind-resistant flame made it BIFL before BIFL was a concept.',
    reddit_sentiment: "The prototypical r/BuyItForLife product. Owners routinely send vintage Zippos back to the factory for free flint wheel replacements. 'Zippo is the BIFL gold standard' is a running refrain.",
    week_of: weekOf,
    is_featured: false,
  },
  {
    name: 'Miele C3 Canister Vacuum Cleaner',
    brand: 'Miele',
    category: 'home',
    price_inr: 48000,
    price_usd: 580,
    scores: { build_quality: 20, longevity: 19, value: 13, repairability: 15, india_availability: 11 },
    specs: { material: 'ABS + Stainless Steel', warranty: '5 years (extends to 10 with registration)', repairability_score: 8, made_in: 'Germany' },
    award_type: 'forever_pick',
    affiliate_url_amazon: 'https://www.amazon.in/dp/B00O39C0O2',
    affiliate_url_flipkart: null,
    image_url: 'https://m.media-amazon.com/images/I/81bQ7aUMkFL._AC_SX679_.jpg',
    summary: 'Miele tests their motors to 20 years of average use before production. The C3 is the result. German engineering at its most pragmatic — no HEPA-washing, no gimmicks. Parts cost fractions of a replacement unit and Miele service centers exist in major Indian cities.',
    reddit_sentiment: '"The Engineered in Germany tax is actually the Engineered to last a generation tax." Owners report 15-20 year lifespans with basic maintenance. Most negative reviews are about price, not performance.',
    week_of: weekOf,
    is_featured: false,
  },

  // ── TRAVEL ──
  {
    name: 'Osprey Atmos AG 65 Backpack',
    brand: 'Osprey',
    category: 'travel',
    price_inr: 22000,
    price_usd: 270,
    scores: { build_quality: 18, longevity: 17, value: 14, repairability: 13, india_availability: 11 },
    specs: { material: 'Nylon 100D (Bluesign)', warranty: 'Lifetime (All Mighty Guarantee)', repairability_score: 7, weight: '2.07 kg' },
    award_type: 'forever_pick',
    affiliate_url_amazon: 'https://www.amazon.in/dp/B00G6T9EI0',
    affiliate_url_flipkart: null,
    image_url: 'https://m.media-amazon.com/images/I/81kqkzAJNUL._AC_SX679_.jpg',
    summary: "Osprey's All Mighty Guarantee means they will repair or replace for any defect, for life. The AG (Anti-Gravity) suspension is the most field-tested large-pack system available — designed in collaboration with orthopedics.",
    reddit_sentiment: 'Highly recommended on r/ultralight and r/travel. The All Mighty Guarantee is cited constantly. Multiple users report sending packs back after years for free zipper replacements.',
    week_of: weekOf,
    is_featured: false,
  },
  {
    name: 'Rimowa Essential Cabin',
    brand: 'Rimowa',
    category: 'travel',
    price_inr: 62000,
    price_usd: 750,
    scores: { build_quality: 19, longevity: 17, value: 12, repairability: 14, india_availability: 12 },
    specs: { material: 'Polycarbonate', warranty: 'Lifetime', repairability_score: 8, made_in: 'Germany', weight: '3.9 kg' },
    award_type: 'hidden_gem',
    affiliate_url_amazon: 'https://www.rimowa.com/media/asset/pim/D/9/2/2/D92253004RSCABE/40-0-925-73-4/40_00_925_73_4_CORE_MHPD_HD_01_2000x2000.jpg',
    affiliate_url_flipkart: null,
    image_url: 'https://www.rimowa.com/media/asset/pim/D/9/2/2/D92253004RSCABE/40-0-925-73-4/40_00_925_73_4_CORE_MHPD_HD_01_2000x2000.jpg',
    summary: 'Rimowa\'s "250 flights later" narrative is earned. Polycarbonate flexes on impact without cracking — unlike aluminium competitors. Their integrated wheel system ships replacement parts globally. The lifetime guarantee actually gets honoured.',
    reddit_sentiment: '"250 flights later" is literal for several r/travel users. Reviewers note Rimowa\'s repair network is genuinely global. Price premium is steep but calculated against 20 years of use.',
    week_of: weekOf,
    is_featured: false,
  },

  // ── TECH ──
  {
    name: 'Herman Miller Aeron Chair (Size B)',
    brand: 'Herman Miller',
    category: 'tech',
    price_inr: 135000,
    price_usd: 1600,
    scores: { build_quality: 20, longevity: 18, value: 12, repairability: 16, india_availability: 13 },
    specs: { material: '8Z Pellicle Mesh + Zinc', warranty: '12 years', repairability_score: 8, made_in: 'USA' },
    award_type: 'forever_pick',
    affiliate_url_amazon: 'https://www.amazon.in/dp/B083XQ2H3C',
    affiliate_url_flipkart: null,
    image_url: 'https://m.media-amazon.com/images/I/71kz-EXQ90L._AC_SX679_.jpg',
    summary: '40,000 hours at a desk is the average career. The Aeron\'s 12-year warranty with 4 individual adjustment systems means your spine is actually in the right position. Replacement parts for every component are available and priced rationally.',
    reddit_sentiment: '"The ergonomic investment that actually paid off" is the dominant sentiment on r/pcmasterrace and r/mechanicalkeyboards. Refurbished units at 50-60% retail are considered the sweet spot.',
    week_of: weekOf,
    is_featured: false,
  },

  // ── PARENTING ──
  {
    name: 'Stokke Tripp Trapp High Chair',
    brand: 'Stokke',
    category: 'parenting',
    price_inr: 28000,
    price_usd: 330,
    scores: { build_quality: 19, longevity: 19, value: 15, repairability: 14, india_availability: 11 },
    specs: { material: 'PEFC-certified European Beechwood', warranty: '7 years', repairability_score: 9, made_in: 'Norway', weight: '6.5 kg' },
    award_type: 'best_buy',
    affiliate_url_amazon: 'https://www.amazon.in/dp/B000F9ZNKG',
    affiliate_url_flipkart: null,
    image_url: 'https://m.media-amazon.com/images/I/61bN0tLZ+PL._AC_SX679_.jpg',
    summary: 'The Tripp Trapp adjusts from newborn (with infant kit) to adult use. European beechwood construction means it can support 150kg — the same unit your child eats in at 6 months can be their study chair at 16. Multiple accessory kits extend its lifecycle.',
    reddit_sentiment: '"From newborn to teenager" is the actual user experience in r/BeyondTheBump and r/Parenting. Parents regularly report using the same chair across 2-3 children. The neutral aesthetics age well.',
    week_of: weekOf,
    is_featured: false,
  },
];

async function seed() {
  console.log(`\nSeeding ${SEED_PRODUCTS.length} products for week ${weekOf}...\n`);

  const response = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation,resolution=merge-duplicates',
    },
    body: JSON.stringify(SEED_PRODUCTS),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
    return;
  }

  const data = await response.json();
  console.log(`✅ Seeded ${data.length} products:\n`);
  data.forEach((p) => console.log(`  [${p.category.toUpperCase()}] ${p.name}`));
  console.log(`\nDone! Run "npm run dev" and visit http://localhost:3000`);
}

seed();
