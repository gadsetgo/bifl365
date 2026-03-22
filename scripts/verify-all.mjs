import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const AFFILIATE_TAG = 'bifl365-21';

const sb = createClient(supabaseUrl, serviceKey);

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callGemini(prompt, attempt = 1) {
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
  if (res.status === 429 && attempt <= 5) {
    const wait = 10 * attempt;
    console.log(`  Rate limited, waiting ${wait}s...`);
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

function sanitize(links) {
  if (!Array.isArray(links)) return [];
  return links
    .filter(l => l?.url && typeof l.url === 'string')
    .filter(l => !l.url.includes('/s?k=') && !l.url.includes('/search?q='))
    .map(l => {
      const r = { store: String(l.store || 'Unknown').trim(), url: l.url.trim(), is_affiliate: Boolean(l.is_affiliate) };
      try {
        const u = new URL(r.url);
        if (u.hostname.includes('amazon.in') || u.hostname.includes('amazon.com')) {
          u.searchParams.set('tag', AFFILIATE_TAG);
          r.url = u.toString();
          r.is_affiliate = true;
        }
      } catch {}
      return r;
    });
}

async function downloadImage(url) {
  try {
    const u = new URL(url);
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/png,image/jpeg,*/*',
        'Referer': u.origin + '/',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1500) return null;
    return { buf, ct };
  } catch { return null; }
}

async function upload(productId, buf, ct) {
  const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
  const ext = extMap[ct] || 'jpg';
  const path = `${productId}/${Date.now()}.${ext}`;
  const { data, error } = await sb.storage.from('product-images').upload(path, buf, { contentType: ct, upsert: false });
  if (error) {
    if (error.message?.includes('already exists')) return null;
    throw error;
  }
  const { data: u } = sb.storage.from('product-images').getPublicUrl(data.path);
  return u.publicUrl;
}

// Scrape Amazon product page for high-res image URLs
async function scrapeAmazonImages(url) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    if (!res.ok) return [];
    const html = await res.text();
    const imgs = new Set();

    // Method 1: og:image
    let m;
    const og1 = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi;
    while ((m = og1.exec(html))) if (m[1]) imgs.add(m[1]);
    const og2 = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi;
    while ((m = og2.exec(html))) if (m[1]) imgs.add(m[1]);

    // Method 2: data-old-hires on main image
    const hiRes = /data-old-hires=["']([^"']+)["']/gi;
    while ((m = hiRes.exec(html))) if (m[1]) imgs.add(m[1]);

    // Method 3: Amazon media CDN URLs (high-res only)
    const cdnPattern = /https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9._%-]+\.(?:jpg|png|webp)/g;
    const cdnMatches = html.match(cdnPattern) || [];
    for (const cu of cdnMatches) {
      // Only add large/main images, skip thumbnails
      if (cu.includes('_SL1') || cu.includes('_AC_SL') || cu.includes('_AC_UL') || (!cu.includes('_SS') && !cu.includes('_SR') && !cu.includes('_SX4') && !cu.includes('_SY4'))) {
        imgs.add(cu);
      }
    }

    // Method 4: colorImages/imageGalleryData JSON
    const jsonPattern = /'colorImages':\s*\{[^}]*'initial':\s*(\[[\s\S]*?\])/;
    const jsonMatch = html.match(jsonPattern);
    if (jsonMatch?.[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1].replace(/'/g, '"'));
        for (const img of parsed) {
          if (img.hiRes) imgs.add(img.hiRes);
          if (img.large) imgs.add(img.large);
        }
      } catch {}
    }

    return [...imgs].slice(0, 10);
  } catch { return []; }
}

async function verifyProduct(product) {
  const prompt = `Search for this product and return purchase links and product images.

Product: "${product.name}" by ${product.brand || 'unknown brand'}

Find:
1. Amazon India (amazon.in) product page URL with real ASIN (format: /dp/ASIN)
2. Flipkart product page URL (not search page)
3. Brand/manufacturer product page if exists
4. Direct image URLs: specifically Amazon CDN URLs like https://m.media-amazon.com/images/I/XXXXX._AC_SL1500_.jpg

Return JSON:
{
  "affiliate_links": [
    { "store": "Amazon", "url": "URL", "is_affiliate": true },
    { "store": "Flipkart", "url": "URL", "is_affiliate": false }
  ],
  "image_urls": ["direct_image_url_1", "direct_image_url_2"],
  "notes": "brief"
}

IMPORTANT: Only real URLs from search. Prefer m.media-amazon.com image URLs.`;

  const raw = await callGemini(prompt);
  const v = parseJson(raw);
  if (!v) throw new Error('JSON parse failed');

  const newLinks = sanitize(v.affiliate_links || []);

  // Collect image candidates from Gemini
  const candidates = [];
  if (Array.isArray(v.image_urls)) {
    candidates.push(...v.image_urls.filter(u => typeof u === 'string'));
  }
  if (v.image_url && typeof v.image_url === 'string') candidates.push(v.image_url);
  if (Array.isArray(v.image_candidates)) {
    candidates.push(...v.image_candidates.filter(u => typeof u === 'string'));
  }

  // Also extract any image URLs from raw text
  const imgPattern = /https?:\/\/[^\s"'<>)\]]+\.(?:jpg|jpeg|png|webp)/gi;
  const textImgs = raw.match(imgPattern) || [];
  candidates.push(...textImgs);

  // Scrape Amazon pages for images (most reliable source)
  const amazonLinks = newLinks.filter(l => l.url.includes('amazon'));
  for (const l of amazonLinks.slice(0, 2)) {
    console.log(`  Scraping Amazon: ${l.url.substring(0, 60)}...`);
    const amazonImgs = await scrapeAmazonImages(l.url);
    console.log(`  Found ${amazonImgs.length} Amazon images`);
    candidates.unshift(...amazonImgs); // prioritize Amazon images
  }

  // Deduplicate
  const unique = [...new Set(candidates)].filter(u => {
    try { new URL(u); return true; } catch { return false; }
  });

  console.log(`  Total unique candidates: ${unique.length}`);

  // Download and store
  const stored = [];
  for (const url of unique.slice(0, 15)) {
    if (stored.length >= 3) break; // 3 good images is enough
    const result = await downloadImage(url);
    if (!result) continue;
    try {
      const storedUrl = await upload(product.id, result.buf, result.ct);
      if (storedUrl) stored.push(storedUrl);
    } catch (e) {
      console.log(`  Upload error: ${e.message?.substring(0, 50)}`);
    }
  }

  return { links: newLinks, images: stored, notes: v.notes || '' };
}

// ─── Main ───────────────────────────────────────────────────────────────
const { data: allProducts } = await sb.from('products').select('id, name, brand, affiliate_links, image_url, status');
console.log(`Total products: ${allProducts.length}\n`);

const needsWork = [];
const alreadyGood = [];

for (const p of allProducts) {
  const hasStoredImage = p.image_url && p.image_url.includes('supabase');
  const hasLinks = Array.isArray(p.affiliate_links) && p.affiliate_links.length > 0;
  if (hasStoredImage && hasLinks) {
    alreadyGood.push(p.name);
  } else {
    needsWork.push(p);
  }
}

console.log(`Already good: ${alreadyGood.length}`);
alreadyGood.forEach(n => console.log(`  ✓ ${n}`));
console.log(`\nNeed work: ${needsWork.length}\n`);

let ok = 0, err = 0, imgOk = 0;

for (let i = 0; i < needsWork.length; i++) {
  const p = needsWork[i];
  const tag = `[${i + 1}/${needsWork.length}]`;
  try {
    const r = await verifyProduct(p);
    const updates = {};
    if (r.links.length > 0) updates.affiliate_links = r.links;
    if (r.images.length > 0) {
      updates.image_candidates = r.images;
      updates.image_url = r.images[0];
      updates.image_approved = false;
      imgOk++;
    }
    if (Object.keys(updates).length > 0) {
      await sb.from('products').update(updates).eq('id', p.id);
    }
    console.log(`${tag} ${p.name.substring(0, 42).padEnd(42)} | links:${r.links.length} imgs:${r.images.length}`);
    ok++;
    if (i < needsWork.length - 1) await delay(3000);
  } catch (e) {
    console.log(`${tag} ${p.name.substring(0, 42).padEnd(42)} | ERR: ${e.message?.substring(0, 60)}`);
    err++;
    await delay(4000);
  }
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`Done! OK: ${ok} | Errors: ${err} | Images stored: ${imgOk}/${needsWork.length}`);
console.log(`${'═'.repeat(60)}`);
