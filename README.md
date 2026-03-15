# bifl365.com

> **Buy It For Life** — Weekly AI-curated product awards for products engineered to last decades.

---

## What is bifl365?

bifl365.com is an automated product intelligence platform that surfaces the best long-lasting products worth every rupee. Inspired by the r/BuyItForLife community (1.5M+ members), it awards products across three categories every week — fully powered by AI with minimal human effort.

**Live at:** https://bifl365.com

---

## Award Categories

| Award | Description |
|---|---|
| 🥇 BIFL Best Buy | Best quality-to-price ratio for Indian buyers |
| 💎 BIFL Forever Pick | The one to get if money is no object |
| 🔍 BIFL Hidden Gem | Underrated and overlooked by most |

---

## Product Categories

- Desk & Work
- Kitchen
- Tools
- Carry
- Home

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Database | Supabase (Postgres) |
| Hosting | Vercel (Hobby) |
| AI — Data collection | Google Gemini 2.0 Flash |
| AI — Scoring & writing | Anthropic Claude Sonnet |
| Automation | GitHub Actions (cron) |
| Video voiceover | ElevenLabs |
| Video assembly | Invideo AI |
| Social scheduling | Buffer |
| Analytics | Vercel Analytics + Google Analytics 4 |

---

## Project Structure

```
bifl365/
├── app/
│   ├── page.tsx                  # Homepage — hero + awards + featured
│   ├── products/
│   │   └── page.tsx              # All products with category filter
│   ├── weekly-pick/
│   │   └── page.tsx              # Featured product deep dive
│   ├── category/
│   │   └── [slug]/
│   │       └── page.tsx          # Per-category pages
│   └── api/
│       ├── products/
│       │   ├── upsert/
│       │   │   └── route.ts      # POST — pipeline writes products
│       │   └── featured/
│       │       └── route.ts      # GET — returns this week's featured
├── components/
│   ├── ProductCard.tsx
│   ├── AwardBadge.tsx
│   ├── ScoreBar.tsx
│   └── CategoryStrip.tsx
├── lib/
│   ├── supabase.ts               # Supabase client
│   └── types.ts                  # Product type definitions
├── scripts/
│   └── seed.js                   # One-time DB seed with 10 products
├── weekly-pipeline.js            # Automated Monday pipeline
├── output/                       # Pipeline output (gitignored)
│   └── week-[date]/
│       ├── youtube-script.txt
│       ├── instagram-slide-1.txt
│       ├── instagram-slide-2.txt
│       ├── instagram-slide-3.txt
│       ├── instagram-slide-4.txt
│       ├── instagram-slide-5.txt
│       └── blog-post.md
├── .github/
│   └── workflows/
│       └── weekly.yml            # GitHub Actions cron job
├── .env.local                    # Local env vars (never commit)
└── README.md
```

---

## Database Schema

### Table: `products`

```sql
CREATE TABLE products (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name                  TEXT NOT NULL,
  brand                 TEXT NOT NULL,
  category              TEXT CHECK (category IN ('desk','kitchen','tools','carry','home')),
  price_inr             INTEGER,
  price_usd             INTEGER,
  scores                JSONB,
  award_type            TEXT CHECK (award_type IN ('best_buy','forever_pick','hidden_gem')),
  affiliate_url_amazon  TEXT,
  affiliate_url_flipkart TEXT,
  image_url             TEXT,
  summary               TEXT,
  reddit_sentiment      TEXT,
  week_of               DATE,
  is_featured           BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT now()
);
```

### Scores JSONB structure

```json
{
  "build_quality":       20,
  "longevity":           18,
  "value":               16,
  "repairability":       14,
  "india_availability":  15
}
```

Each dimension is scored 1–20. Total = **BIFL Score out of 100.**

### RLS Policies

```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read products"
ON products FOR SELECT USING (true);

CREATE POLICY "Service role can write"
ON products FOR ALL USING (auth.role() = 'service_role');
```

---

## Environment Variables

### Vercel (all environments)

```env
SUPABASE_URL=https://[your-ref].supabase.co
SUPABASE_ANON_KEY=your_publishable_key
ANTHROPIC_API_KEY=your_anthropic_key
GEMINI_API_KEY=your_gemini_key
```

### Vercel (production only)

```env
SUPABASE_SERVICE_ROLE_KEY=your_secret_key
NEXT_PUBLIC_SITE_URL=https://bifl365.com
```

### Local `.env.local`

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### GitHub Actions Secrets

```
ANTHROPIC_API_KEY
GEMINI_API_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

---

## Weekly Automation Pipeline

The pipeline runs every **Monday at 4:00am IST** via GitHub Actions.

### What it does

```
1. Gemini 2.0 Flash
   → Searches Reddit r/BuyItForLife + Amazon India + general product knowledge
   → Returns 10 BIFL product candidates with raw data

2. Claude Sonnet (per product)
   → Scores each product across 5 dimensions (1–20 each)
   → Writes 200-word BIFL case for each product
   → Picks 3 award winners for the week

3. Supabase
   → Upserts all 10 products via POST /api/products/upsert
   → Sets is_featured = true on the Best Buy winner

4. Output files written to /output/week-[YYYY-MM-DD]/
   → youtube-script.txt    (600 words, voiceover-ready)
   → instagram-slide-1 to 5.txt
   → blog-post.md          (400 words, SEO optimised)
```

### GitHub Actions workflow

```yaml
# .github/workflows/weekly.yml
name: Weekly AI Pipeline
on:
  schedule:
    - cron: "30 22 * * 0"  # Sunday 10:30pm UTC = Monday 4am IST
  workflow_dispatch:        # Manual trigger via GitHub UI
jobs:
  run-pipeline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: node weekly-pipeline.js
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

---

## Local Development

```bash
# Clone the repo
git clone https://github.com/gadsetgo/bifl365.git
cd bifl365

# Install dependencies
npm install

# Fill in your env vars
cp .env.local.example .env.local
# edit .env.local with your keys

# Run locally
npm run dev
# → http://localhost:3000

# Seed the database (run once)
node scripts/seed.js

# Test the pipeline manually
node weekly-pipeline.js
```

---

## Deployment

Every push to `main` auto-deploys to Vercel.

```bash
git add .
git commit -m "your message"
git push origin main
# → bifl365.com live in ~2 min
```

---

## Monetisation

| Stream | Platform | When it pays |
|---|---|---|
| Affiliate commissions | Amazon Associates India + Flipkart Affiliate | Day 1 |
| Display ads | Google AdSense | Month 2–3 (post-approval) |
| YouTube ad revenue | YouTube Partner Program | ~1,000 subscribers |
| Brand partnerships | Direct outreach | Month 4+ |
| Newsletter sponsors | Beehiiv / Substack | Month 3+ |

---

## Monthly Operating Cost

| Item | Cost |
|---|---|
| Domain (bifl365.com) | ₹900/yr → ₹75/mo |
| Vercel hosting | ₹0 (free tier) |
| Supabase database | ₹0 (free tier) |
| GitHub Actions | ₹0 (public repo) |
| Claude API (~4 pipeline runs) | ~₹250/mo |
| Gemini API (Jio free) | ₹0 |
| ElevenLabs voiceover | ₹0 (free tier) |
| Invideo AI (video assembly) | ₹1,670/mo |
| Buffer (social scheduling) | ₹0 (free tier) |
| **Total** | **~₹2,000/mo** |

---

## Roadmap

### Month 1 — Launch
- [x] Domain + hosting live
- [x] Supabase DB configured
- [x] GitHub Actions pipeline
- [ ] Site built and deployed
- [ ] 10 seed products live
- [ ] Amazon + Flipkart affiliate links active
- [ ] First automated pipeline run

### Month 2 — Content & SEO
- [ ] Google Search Console verified
- [ ] Google AdSense applied
- [ ] First YouTube video published
- [ ] Instagram Reels started
- [ ] Newsletter signup added

### Month 3 — Growth
- [ ] 50+ products in DB across all categories
- [ ] Category pages ranking on Google
- [ ] YouTube at 100+ subscribers
- [ ] First affiliate commission received

### Month 6 — Scale
- [ ] AdSense approved and earning
- [ ] YouTube monetisation eligible (1K subs)
- [ ] Brand partnership outreach
- [ ] ₹25,000+/mo revenue target

---

## Links

- **Live site:** https://bifl365.com
- **GitHub:** https://github.com/gadsetgo/bifl365
- **Vercel dashboard:** https://vercel.com/gadsetgos-projects/bifl365
- **Supabase dashboard:** https://supabase.com/dashboard/project/[your-ref]
- **Amazon Associates:** https://affiliate-program.amazon.in
- **Flipkart Affiliate:** https://affiliate.flipkart.com
- **Google Search Console:** https://search.google.com/search-console

---

*Built with Claude Code · Powered by Gemini + Anthropic · Hosted on Vercel*
