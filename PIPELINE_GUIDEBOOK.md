# Pipeline Guidebook

This project supports three pipeline options. Use the one that matches where your research is coming from.

## 1. Local Ollama

Use this when:

- Ollama is installed on your machine
- You want to work mostly offline
- You want local scoring and local content generation

Run:

```powershell
npm run pipeline
```

Requirements:

- Ollama must be running locally
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be set if you want DB upserts
- Set `PIPELINE_SKIP_UPSERT=true` if you only want to test generation

What it does:

- Research comes from Ollama
- Scoring comes from Ollama
- Content comes from Ollama

## 2. Online Gemini

Use this when:

- You want fresh online research
- Gemini quota is available
- You want the GitHub Action or online workflow

Run locally:

```powershell
npm run pipeline:online
```

Run from admin:

- Open `/admin/pipeline`
- Click `Trigger Online Pipeline`

Requirements:

- `GEMINI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

What it does:

- Research comes from Gemini
- Scoring comes from Gemini
- Content comes from Gemini

## 3. Imported Research

Use this when:

- You already have research output from ChatGPT, Gemini, Claude, or manual notes
- You want to separate research from scoring and publishing
- Online quota is unavailable but you still want to move forward

Drop-folder workflow:

```powershell
npm run pipeline:dropbox
```

Direct publish when the dropped JSON is already fully scored:

```powershell
npm run pipeline:dropbox:publish
```

Continuous watch mode:

```powershell
npm run pipeline:dropbox:watch
```

What it does:

- watches `.\research-drop` on each run
- processes every pending `.json` bundle in that folder
- moves successful files to `.\research-drop\processed`
- moves failed files to `.\research-drop\failed`
- in watch mode, automatically re-runs when a new `.json` file is dropped in

Example candidate import:

```powershell
$env:PIPELINE_RESEARCH_SOURCE='import'
$env:PIPELINE_IMPORT_FILE='.\pipeline-import.example.json'
node pipeline.mjs
```

Example single-object publish-ready import:

```powershell
$env:PIPELINE_RESEARCH_SOURCE='import'
$env:PIPELINE_IMPORT_FILE='.\pipeline-single-product.example.json'
$env:PIPELINE_CONTENT_PROVIDER='none'
node pipeline.mjs
```

Example fully scored import:

```powershell
$env:PIPELINE_RESEARCH_SOURCE='import'
$env:PIPELINE_IMPORT_FILE='.\pipeline-products.example.json'
$env:PIPELINE_CONTENT_PROVIDER='none'
node pipeline.mjs
```

Optional combinations:

- Import research + Ollama scoring:
  `$env:PIPELINE_SCORING_PROVIDER='ollama'`
- Import research + Gemini scoring:
  `$env:PIPELINE_SCORING_PROVIDER='gemini'`
- Import fully scored Gemini/ChatGPT/Claude output and publish it as-is:
  `npm run pipeline:dropbox:publish`
- Import research + skip content:
  `$env:PIPELINE_CONTENT_PROVIDER='none'`
- Folder mode, but only process the newest file:
  `$env:PIPELINE_IMPORT_SELECTION='latest'`
- Faster Ollama runs with a lighter model you already have installed:
  `$env:OLLAMA_MODEL='qwen2.5:3b'`
  then run `npm run pipeline` or `npm run pipeline:dropbox`

Accepted file shapes:

- a single research object:
  `{"name":"Casio F91W","brand":"Casio","category":"watches","research_notes":"..."}`
- a single publish-ready product object:
  `{"name":"Casio F91W","category":"watches","scores":{"build_quality":18,"longevity":19,"value":20,"repairability":14,"india_availability":19},"summary":"..."}`
- `candidates`: raw product candidates to be scored later
- `products`: fully scored products ready for publish or content generation

Accepted publish-ready scoring field names:

- `scores`
- `scoring`
- `scorecard`
- top-level score keys such as `build_quality`, `longevity`, `value`, `repairability`, `india_availability`

> **Note on `repairability_score` vs `repairability`:** `repairability_score` is a **spec** field (a numeric 1–10 detail that lives inside `specs`). `repairability` is the **scoring** field (0–20 BIFL score). Use `repairability` in your scoring block and `repairability_score` inside `specs`.

Accepted publish-ready summary and award aliases:

- summary: `summary`, `editorial_summary`, or `verdict`
- award: `award_type`, `award`, or `badge`

Recommended import rules:

- Use `npm run pipeline:dropbox` when the JSON has research only and still needs scoring
- Use `npm run pipeline:dropbox:publish` when the JSON already has scoring plus summary and should be treated as final
- Prefer a single-object file when you are researching one product at a time

## Recommended Choice

- Use `Local Ollama` for offline iteration
- Use `Online Gemini` when fresh research matters most
- Use `Imported Research` when ChatGPT, Gemini, or Claude already produced better source material
- Use `pipeline:dropbox:publish` when Gemini already returned publish-ready `products` JSON and you do not want another LLM pass

## Safe Test Mode

To test any mode without writing to Supabase:

```powershell
$env:PIPELINE_SKIP_UPSERT='true'
```

Then run your chosen pipeline command.
