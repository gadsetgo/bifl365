# bifl365.com

> **Buy It For Life** — Weekly AI-curated product awards for products engineered to last decades.

**Live at:** https://bifl365.com

---

## What is bifl365?

bifl365.com is an automated product intelligence platform that surfaces the best long-lasting products worth every rupee. Inspired by the r/BuyItForLife community (1.5M+ members), it scores and awards products every week — powered by AI with human review.

---

## Award Types

| Award | Code | Description |
|---|---|---|
| Value Buy | `value_buy` | Best quality-to-price ratio for Indian buyers |
| Forever Pick | `forever_pick` | The one to get if money is no object |
| Hidden Gem | `hidden_gem` | Underrated and overlooked by most |
| Current Star | `current_star` | A good buy in recently trending products |

---

## Product Categories

| Category | Label |
|---|---|
| `kitchen` | Kitchen Hardware |
| `edc` | Everyday Carry |
| `home` | Home Infrastructure |
| `travel` | Travel & Luggage |
| `tech` | Premium Tech / Office |
| `parenting` | Parenting & Baby |
| `watches` | Watches |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS 3 |
| Database | Supabase (Postgres) |
| Auth | NextAuth 5 (Google OAuth) |
| Hosting | Vercel |
| AI Providers | Google Gemini, Anthropic Claude, Ollama (local) |
| Automation | GitHub Actions (cron) |
| Analytics | Vercel Analytics |

---

## Project Structure

```
bifl365/
├── app/
│   ├── page.tsx                        # Homepage
│   ├── products/page.tsx               # All products with category filter
│   ├── products/[id]/page.tsx          # Product detail page
│   ├── weekly-pick/page.tsx            # Featured product deep dive
│   ├── category/[slug]/page.tsx        # Per-category pages
│   ├── admin/
│   │   ├── login/page.tsx              # Google OAuth login
│   │   └── (dashboard)/
│   │       ├── board/                  # Main product management board
│   │       ├── review/                 # Review queue with keyboard shortcuts
│   │       ├── pipeline/               # Pipeline trigger + prompt library
│   │       └── analytics/              # Dashboard metrics
│   └── api/
│       ├── products/                   # Public: featured, upsert
│       ├── go/route.ts                 # Affiliate click-tracking redirect
│       └── admin/                      # Auth-protected: products, enrich,
│                                       #   suggestions, pipeline, config
├── components/                         # Shared React components
├── lib/
│   ├── types.ts                        # Product, AffiliateLink, score types
│   ├── constants.ts                    # Categories, labels, affiliate tag
│   ├── supabase.ts                     # Supabase browser + server clients
│   └── pipeline-scoring.ts             # Score calculation utilities
├── pipeline.mjs                        # Multi-provider AI pipeline
├── bifl365.config.json                 # Categories, affiliate tag, pipeline settings
├── auth.ts                             # NextAuth config
├── middleware.ts                        # Admin route protection
└── supabase/migrations/                # 001–010 SQL migrations
```

---

## Scoring System

Products are scored across 5 dimensions (each 1–20, total out of 100):

```json
{
  "build_quality": 20,
  "longevity": 18,
  "value": 16,
  "repairability": 14,
  "india_availability": 15
}
```

---

## Database Schema

### Core Tables

- **`products`** — Main product data, scores (JSONB), specs (JSONB), affiliate_links (JSONB array), image candidates, pipeline status, review state
- **`product_suggestions`** — Admin queue for products to research next
- **`pipeline_runs`** — Automation run history and status
- **`affiliate_clicks`** — Click tracking for affiliate links (no IP stored)

### Key Columns on `products`

| Column | Type | Notes |
|---|---|---|
| `scores` | JSONB | `{build_quality, longevity, value, repairability, india_availability}` |
| `specs` | JSONB | `{material, warranty, repairability_score, made_in, weight}` |
| `affiliate_links` | JSONB | `[{store, url, is_affiliate}]` |
| `award_type` | TEXT | `value_buy \| forever_pick \| hidden_gem \| current_star` |
| `category` | TEXT | `kitchen \| edc \| home \| travel \| tech \| parenting \| watches` |
| `pipeline_status` | TEXT | `pending_review \| live \| rejected` |
| `status` | TEXT | `draft \| published` |
| `image_candidates` | JSONB | Array of candidate image URLs from pipeline |
| `image_approved` | BOOLEAN | Set true when admin picks final image |

---

## Pipeline

The pipeline generates product candidates, scores them, and upserts to Supabase. Configurable via env vars and `bifl365.config.json`.

### Modes

| Command | Source | Use Case |
|---|---|---|
| `npm run pipeline` | Local Ollama | Offline development |
| `npm run pipeline:flex` | Config-driven (Gemini/Claude/Ollama) | Primary pipeline |
| `npm run pipeline:online` | Online Gemini | Cloud-only environments |
| `npm run pipeline:dropbox` | JSON import files | External research import |

### Pipeline Steps

1. **Research** — AI generates product candidates with affiliate links, prices, specs
2. **Scoring** — AI scores each product across 5 BIFL dimensions
3. **Upsert** — Products written to Supabase (direct or via API)
4. **Content** — Blog posts, YouTube scripts, Instagram slides generated

### Affiliate Link Sanitization

The pipeline automatically:
- Drops Amazon search URLs (`/s?k=...`)
- Ensures `?tag=bifl365-21` on all Amazon product URLs
- Sets `is_affiliate: true` for tagged Amazon links

---

## Environment Variables

### Required

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Auth (for admin panel)

```env
AUTH_SECRET=random-secret
AUTH_GOOGLE_ID=your-google-oauth-client-id
AUTH_GOOGLE_SECRET=your-google-oauth-client-secret
ADMIN_EMAIL=your-email@gmail.com
```

### Pipeline (optional)

```env
PIPELINE_RESEARCH_PROVIDER=gemini      # ollama | gemini | claude
PIPELINE_SCORING_PROVIDER=gemini       # ollama | gemini | claude | none
PIPELINE_CONTENT_PROVIDER=gemini       # ollama | gemini | claude | none
PIPELINE_TOTAL_CANDIDATES=3
PIPELINE_SKIP_UPSERT=false
GEMINI_MODEL=gemini-2.5-flash
```

See `.env.example` for the full list.

---

## Local Development

```bash
git clone https://github.com/gadsetgo/bifl365.git
cd bifl365
npm install
cp .env.example .env.local    # fill in your keys
npm run dev                   # http://localhost:3000
```

### Admin Panel

Visit `/admin/login` and sign in with the Google account matching `ADMIN_EMAIL`. The admin board at `/admin/board` lets you review, enrich, approve/reject products and manage affiliate links.

---

## Deployment

Every push to `main` auto-deploys to Vercel.

### GitHub Actions

The pipeline runs on a cron schedule (configurable in `.github/workflows/weekly.yml`) and can be triggered manually via GitHub UI with provider and category selection.

---

## Monetisation

| Stream | Platform |
|---|---|
| Affiliate commissions | Amazon Associates India (`tag=bifl365-21`) |
| Display ads | Google AdSense |
| YouTube ad revenue | YouTube Partner Program |

---

## Links

- **Live site:** https://bifl365.com
- **GitHub:** https://github.com/gadsetgo/bifl365

---

*Built with Claude Code · Powered by Gemini + Anthropic · Hosted on Vercel*
