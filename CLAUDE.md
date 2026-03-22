# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

BIFL365 — "Buy It For Life" weekly AI-curated product awards platform. Surfaces durable products worth every rupee, scored across 5 dimensions by AI, with affiliate monetization.

**Live:** https://bifl365.com

## Commands

```bash
npm run dev          # Next.js dev server
npm run build        # Production build (also validates types)
npm run lint         # ESLint
npm run pipeline:flex   # Main pipeline (Gemini/Claude/Ollama, configurable)
npm run pipeline        # Local Ollama pipeline
npm run pipeline:online # Online Gemini pipeline
npm run pipeline:dropbox # Import from JSON files
```

No test framework is configured. Verify changes with `npx tsc --noEmit` and `npm run build`.

## Architecture

**Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS, Supabase (Postgres), Vercel, NextAuth 5 (Google OAuth)

### Data Flow

1. **Pipeline** (`pipeline.mjs`) generates product candidates via AI (Ollama/Gemini/Claude), scores them, and upserts to Supabase
2. **Admin** (`/admin/*`) reviews, enriches, approves/rejects products
3. **Public site** displays approved products with affiliate links
4. **Click tracking** (`/api/go`) redirects through affiliate URLs with rate limiting

### Key Files

| File | Purpose |
|---|---|
| `bifl365.config.json` | Affiliate tag, pipeline settings, categories, AI providers |
| `lib/types.ts` | `Product`, `AffiliateLink`, `ProductScores`, `ProductSpecs`, award/category types |
| `lib/constants.ts` | Exports from config: `CATEGORIES`, `AFFILIATE_TAG`, `CATEGORY_LABELS` |
| `lib/supabase.ts` | Browser client (anon key) and server client (service role key) |
| `auth.ts` + `middleware.ts` | NextAuth Google OAuth, protects `/admin/*` routes, email whitelist via `ADMIN_EMAIL` env |
| `pipeline.mjs` | Multi-provider pipeline: research → scoring → upsert → content generation |

### Routing

- **Public:** `/`, `/products`, `/products/[id]`, `/category/[slug]`, `/weekly-pick`
- **Admin:** `/admin/(dashboard)/board` (main), `/admin/(dashboard)/review`, `/admin/(dashboard)/pipeline`, `/admin/(dashboard)/analytics`
- **API (public):** `/api/products/featured`, `/api/go` (affiliate redirect)
- **API (auth required):** `/api/admin/products/*`, `/api/admin/enrich`, `/api/admin/suggestions/*`, `/api/admin/pipeline/*`, `/api/admin/config`

### Database (Supabase)

Tables: `products` (main), `product_suggestions`, `pipeline_runs`, `affiliate_clicks`

Scores are JSONB with 5 dimensions (each 1–20): `build_quality`, `longevity`, `value`, `repairability`, `india_availability`.

Affiliate links stored as JSONB array: `[{store, url, is_affiliate}]`. Legacy `affiliate_url_amazon`/`affiliate_url_flipkart` columns still exist for backward compat.

### Supabase Type Workaround

The generated Supabase types are incomplete. Query results often type as `never[]`. Cast to the correct type:
```typescript
const { data } = await supabase.from('products').select('*');
const products = (data ?? []) as Product[];
```

### Tailwind Theme

Custom design tokens: `charcoal` (dark), `orange` (#FF5733 accent), `paper` (off-white), `ghost` (light gray). Fonts: Playfair Display (serif headings), Inter (sans body).

## Conventions

- Server components by default; `'use client'` only when needed
- Product type always from `lib/types.ts`
- Award types: `value_buy` | `forever_pick` | `hidden_gem` | `current_star`
- Categories: `kitchen` | `edc` | `home` | `travel` | `tech` | `parenting` | `watches`
- Admin API routes: validate with Zod, check `auth()` session, return `NextResponse`
- Affiliate tag centralized in `bifl365.config.json` → read via `AFFILIATE_TAG` from `lib/constants.ts`
- Pipeline sanitizes affiliate links: drops search URLs (`/s?k=`, `/search?q=`), ensures Amazon `?tag=` param

## Critical Rules

- **Never change DB schema without showing migration SQL first.** Migrations cannot run locally (no Supabase container). All `supabase/migrations/*.sql` must be run manually in the Supabase Dashboard SQL Editor.
- **Never add npm packages without asking.**
- External AI research should be imported as JSON, not hard-coded into prompts.
- Admin `<img>` tags need `eslint-disable-next-line @next/next/no-img-element` (dynamic URLs from DB).
- `useSearchParams()` in client components requires `<Suspense>` wrapper in the parent server component (Next.js 15+ requirement).
