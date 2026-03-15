# bifl365.com — Implementation Plan

Full-stack Next.js 14 product awards site for "Buy It For Life" products targeting Indian buyers. Editorial magazine feel with amber/white palette. Content powered by Gemini + Claude pipeline.

## Proposed Changes

---

### Project Scaffold

#### [NEW] bifl365/ (root directory inside workspace)
- `npx create-next-app@14` with TypeScript + Tailwind
- Add Google Fonts (Playfair Display, Inter) via `next/font`
- Install: `@supabase/supabase-js`, `@anthropic-ai/sdk`, `@google/generative-ai`

---

### Configuration

#### [NEW] tailwind.config.ts
Custom theme: amber `#C17F24`, near-black `#1a1a1a`, Playfair Display + Inter font families.

#### [NEW] lib/supabase.ts
Browser + server Supabase clients using env vars.

#### [NEW] types/database.ts
TypeScript types for Product row and score shape.

#### [NEW] supabase/migrations/001_products.sql
```sql
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null,
  category text not null check (category in ('desk','kitchen','tools','carry','home')),
  price_inr integer,
  price_usd integer,
  scores jsonb,          -- {build_quality,longevity,value,repairability,india_availability}
  award_type text check (award_type in ('best_buy','forever_pick','hidden_gem')),
  affiliate_url_amazon text,
  affiliate_url_flipkart text,
  image_url text,
  summary text,
  reddit_sentiment text,
  week_of date,
  is_featured boolean default false,
  created_at timestamptz default now()
);
create index on products(category);
create index on products(week_of);
create index on products(is_featured) where is_featured = true;
```

---

### API Routes

#### [NEW] app/api/products/upsert/route.ts
`POST` — accepts JSON array of products, upserts by `name + week_of`. Requires `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` header.

#### [NEW] app/api/products/featured/route.ts
`GET` — returns current week's `is_featured = true` product as JSON.

---

### Components

#### [NEW] components/AwardBadge.tsx
Stamp-style badge in gold/silver/bronze tones for three award types.

#### [NEW] components/ScoreBar.tsx
Mini horizontal bar chart for 5 sub-scores (each /20).

#### [NEW] components/ProductCard.tsx
Card with image, name, brand, price (INR + USD), BIFL score, score bars, award badge, Amazon + Flipkart buttons.

#### [NEW] components/CategoryStrip.tsx
Horizontal scrollable category chips: Desk & Work / Kitchen / Tools / Carry / Home.

#### [NEW] components/Header.tsx
Site nav with logo, category links.

#### [NEW] components/Footer.tsx
Simple footer with disclaimer text.

---

### Pages

#### [NEW] app/page.tsx — Homepage
- Hero with tagline "Products Built to Last a Lifetime"
- 3 award badge showcases
- This week's featured product (large card)
- Category strip

#### [NEW] app/products/page.tsx
- Client-side category filter
- Grid of ProductCards fetched from Supabase

#### [NEW] app/weekly-pick/page.tsx
- Featured product deep dive
- Full score breakdown
- 200-word AI summary
- Reddit sentiment block

#### [NEW] app/category/[slug]/page.tsx
- Dynamic route for each category
- Filtered product grid

---

### Scripts

#### [NEW] weekly-pipeline.js (project root)
Standalone Node.js script:
1. Calls Gemini `gemini-2.0-flash` to surface top 10 BIFL candidates from Reddit + product knowledge
2. For each, calls Claude `claude-sonnet-4-20250514` to score 5 dimensions + 200-word summary
3. Claude selects 3 award winners, marks one as `is_featured`
4. POSTs to `/api/products/upsert`
5. Writes to `/output/week-[date]/`:
   - `youtube-script.txt` (600 words)
   - `instagram-slide-1.txt` through `instagram-slide-5.txt`
   - `blog-post.md` (400 words, SEO)

#### [NEW] scripts/seed.js
Seeds 10 real BIFL products across all 5 categories with realistic scores and Amazon India search URLs. Uses Supabase service role key.

**Seed products (10):**
| Category | Product | Brand |
|----------|---------|-------|
| desk | Zebra F-701 Ballpoint | Zebra |
| desk | ThinkPad X1 Carbon | Lenovo |
| kitchen | Lodge Cast Iron Skillet 10" | Lodge |
| kitchen | Kuhn Rikon Duromatic Pressure Cooker | Kuhn Rikon |
| tools | Victorinox Swiss Army Tinker | Victorinox |
| tools | Knipex Pliers Wrench 250mm | Knipex |
| carry | Osprey Atmos AG 65 Backpack | Osprey |
| carry | Bellroy Note Sleeve Wallet | Bellroy |
| home | Zippo Classic Brushed Chrome Lighter | Zippo |
| home | Darn Tough Merino Wool Socks | Darn Tough |

---

### CI/CD

#### [NEW] .github/workflows/weekly.yml
GitHub Actions cron: `30 22 * * 0` (Sunday 22:30 UTC = Monday 4am IST). Also has `workflow_dispatch`. Runs `node weekly-pipeline.js` with secrets injected.

---

## Verification Plan

### Automated Tests
None (no existing test suite). Pipeline runs will be verified via local execution.

### Manual Verification

1. **Dev server**: Run `npm run dev` inside `bifl365/`, open `http://localhost:3000` — confirm homepage renders with hero, badge section, and category strip.
2. **Products page**: Go to `http://localhost:3000/products` — confirm product grid loads (after seeding).
3. **Seed script**: Run `node scripts/seed.js` from `bifl365/` — confirm Supabase shows 10 products.
4. **API routes**:
   - `GET http://localhost:3000/api/products/featured` → should return JSON of featured product
   - `POST http://localhost:3000/api/products/upsert` with sample JSON body → should return success
5. **Category pages**: Navigate to `/category/kitchen` — confirm filtered grid.
6. **Weekly pick**: Navigate to `/weekly-pick` — confirm featured product deep dive renders.

---

## Planned Enhancements (Phase 2)

### 1. Deep Research Pipeline (Cultural Context & Nicknames)
- **Prompt Adjustments**: Modify `weekly-pipeline.mjs` to specifically request deep research into product legends, asking Gemini to surface cultural history and famous quotes/nicknames (e.g., "Obama to Osama" watch for Casio F91W).
- **Format Upgrades**: The blog post component will be lengthened (e.g., to ~800 words), with a dedicated section per product specifically labeled for "Cultural Impact & Lore". Also a section for key "Product Specifications" displayed well formatted and suited for Product and Product category. Along with BIFL score give estimated lifespan of the product compared to average product, display this prominently in the product card.

### 2. Expanded Affiliate Earnings & Aesthetic UI Links
- **Database Schema**: Update `001_products.sql`, `002_draft_status.sql` and `lib/types.ts` to fully transition to a generic `affiliate_links` JSONB array (e.g., `[{"store": "Amazon", "url": "..."}]`). This makes it infinitely flexible to support direct brand links, Myntra, Tata Cliq, and others. The old fixed `amazon/flipkart` columns will be migrated or deprecated.
- **UI Tweaks (`ProductCard.tsx`)**: Re-style the Call-to-Action buttons into a unified "Where to Buy" group or prominent individual brand buttons for any platform present in the `affiliate_links` array. The estimated lifespan relative to average products will also be displayed prominently here.

### 3. Automated Cloud Execution & API Quota Limits
- **Issue**: Triggering 18+ candidate generations and deep scoring at once rapidly exhausts the free Gemini quotas.
- **Solution (Queue-Driven Architecture)**: 
  - Switch the `.github/workflows/weekly.yml` schedule from `30 22 * * 0` (Weekly) to a staggered schedule like `0 */6 * * *` (Every 6 hours) or similar.
  - Break down `weekly-pipeline.mjs` to only process **1 category** or **1-2 products** per run, caching results sequentially or updating the DB directly incrementally. By running less products, but more often (e.g. 3 per 6 hours), the free tier token per minute/day limits will comfortably clear allowing fully automated additions.
