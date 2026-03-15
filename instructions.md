Project: bifl365.com — Buy It For Life weekly AI product awards
Stack: Next.js 14 App Router, TypeScript, Tailwind, Supabase, Vercel
Pipeline: weekly-pipeline.js (Node.js, Gemini → Claude Sonnet → Supabase)
Conventions:
- Server components by default, client only when needed
- Product type from lib/types.ts always
- Award types: best_buy | forever_pick | hidden_gem
- Categories: desk | kitchen | tools | carry | home
- Never change DB schema without showing migration SQL first
- Never add npm packages without asking
- **CRITICAL**: DB Migrations via `npx supabase migration up` or `pg` fail in this environment due to no local container/blocked ports. All schema changes (`supabase/migrations/*.sql`) MUST be given to the Admin to run manually in the Supabase Dashboard SQL Editor. Do not attempt automation.
.