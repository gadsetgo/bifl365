import { config } from 'dotenv';
import axios from 'axios';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

config({ path: '.env.local' });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const weekOf = new Date().toISOString().split('T')[0];

const mockProducts = [
  {
    name: "Casio F91W",
    brand: "Casio",
    category: "watches",
    price_inr: 1095,
    price_usd: 15,
    affiliate_links: [
      { store: "Amazon", url: "https://www.amazon.in/dp/B000GAWSDG", is_affiliate: false },
      { store: "Flipkart", url: "https://www.flipkart.com/search?q=casio+f91w", is_affiliate: false }
    ],
    image_url: "https://m.media-amazon.com/images/I/61k1KUMXm3L._AC_UY1000_.jpg",
    scores: { build_quality: 19, longevity: 20, value: 20, repairability: 15, india_availability: 20 },
    specs: { material: "Resin", warranty: "1 Year", repairability_score: 7, made_in: "China/Thailand", weight: "21g" },
    award_type: "value_buy",
    summary: "The Casio F91W isn't just a watch; it's a horological legend. Often dubbed the \"Obama to Osama\" watch due to its ubiquitous presence on the wrists of world leaders and infamous figures alike, this resin-built masterpiece offers unmatched durability. For less than the cost of a good dinner, you get a daily driver that survives swims, falls, and the roughest commutes. It runs for nearly 7 years out of the box. Absolutely essential everyday carry.",
    reddit_sentiment: "Unanimously praised. Replaced the strap after 5 years, the actual module still runs perfectly. A true BIFL item for peanuts.",
    estimated_lifespan_multiplier: 5,
    week_of: weekOf,
    is_featured: true,
    status: 'draft'
  },
  {
    name: "Seiko 5 Sports (SNK809)",
    brand: "Seiko",
    category: "watches",
    price_inr: 18000,
    price_usd: 200,
    affiliate_links: [
      { store: "Ethos Watches", url: "https://www.ethoswatches.com/seiko-5-sports.html", is_affiliate: true },
      { store: "Amazon", url: "https://www.amazon.in/dp/B08PVDXFXM", is_affiliate: false }
    ],
    image_url: "https://m.media-amazon.com/images/I/61tA43DqZ3L._AC_UY1000_.jpg",
    scores: { build_quality: 18, longevity: 18, value: 16, repairability: 19, india_availability: 17 },
    specs: { material: "Stainless Steel", warranty: "2 Years", repairability_score: 9, made_in: "Japan/Malaysia", weight: "140g" },
    award_type: "forever_pick",
    summary: "The Seiko 5 series represents the pinnacle of accessible mechanical watchmaking. The SNK809 specifically is revered for its robust 7S26 automatic movement. It needs no batteries—ever. Known in watch collecting circles as the 'Gateway Drug,' its sheer longevity means these watches are frequently handed down between generations. Perfect for Indian buyers looking for a serious, maintenance-friendly mechanical watch.",
    reddit_sentiment: "Indestructible movement. I've had mine daily driven for 10 years without a single service and it keeps time beautifully.",
    estimated_lifespan_multiplier: 3,
    week_of: weekOf,
    is_featured: false,
    status: 'draft'
  }
];

async function main() {
  console.log(`🚀 Mock BIFL365 Weekly Pipeline — ${weekOf}`);
  console.log('Inserting mock products into Supabase via API...');

  try {
    const response = await axios.post(`${SITE_URL}/api/products/upsert`, mockProducts, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      }
    });

    console.log(`✓ Upserted ${response.data.succeeded}/${response.data.total}`);
    if (response.data.failed?.length > 0) {
      console.warn('⚠ Failures:', response.data.failed);
    }
    console.log('\n✅ Mock pipeline complete. You can now test the UI!');
  } catch (err) {
    if (err.response) {
      console.error('Upsert API Error:', JSON.stringify(err.response.data));
    } else {
      console.error('Error:', err.message);
    }
  }
}

main();
