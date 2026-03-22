import { supabase } from '@/lib/supabase';
import { readFileSync } from 'fs';
import { join } from 'path';
import PromptCard from '@/components/PromptCard';
import { ScheduleEditor } from './ScheduleEditor';
import { PipelineTriggerForm } from './PipelineTriggerForm';
import { AFFILIATE_TAG } from '@/lib/constants';

export const dynamic = 'force-dynamic';

type PipelineRun = {
  id: string;
  status: 'running' | 'success' | 'failed';
  started_at: string;
  completed_at: string | null;
  products_found: number | null;
  products_approved: number | null;
  error_message: string | null;
  error_log: string | null;
};


const modes = [
  {
    name: 'Online Gemini',
    badge: 'UI Trigger',
    description: 'Runs the GitHub Actions workflow. The only mode triggerable from this screen without terminal access.',
    command: 'npm run pipeline:online',
    source: 'Fresh online research via Gemini',
    scoring: 'Gemini',
    content: 'Gemini'
  },
  {
    name: 'Local Ollama',
    badge: 'Terminal',
    description: 'Fully offline. Best for rapid iteration on the same machine where Ollama is installed. Swap models with OLLAMA_MODEL=qwen2.5:3b for faster runs.',
    command: 'npm run pipeline',
    source: 'Local Ollama generation',
    scoring: 'Ollama',
    content: 'Ollama'
  },
  {
    name: 'Imported Research',
    badge: 'Terminal',
    description: 'Drop a JSON file from ChatGPT, Claude, Gemini, or your own notes into research-drop. Use pipeline:dropbox to score with Ollama, or pipeline:dropbox:publish when the JSON already has scoring.',
    command: 'npm run pipeline:dropbox',
    source: 'Imported JSON bundle',
    scoring: 'Ollama (default, overridable)',
    content: 'Ollama (default, overridable)'
  }
];

// Enhanced prompt library — supports Casio F91W as the example product.
// Replace "Casio F91W" and "watches" with your target product/category before copying.
const promptExamples = [
  {
    name: 'GPT-4o / ChatGPT — Full Publish-Ready',
    provider: 'ChatGPT',
    badge: 'bg-green-100 text-green-800 border-green-300',
    description: 'Use with GPT-4o (Browse mode enabled). Gets live Amazon India pricing, real affiliate + image URLs, and Reddit sentiment in one pass. Drop the output directly into research-drop.',
    prompt: `You are a product research analyst for BIFL365, a Buy It For Life publication for Indian buyers.

Research the watch "Casio F91W" using live web search. Return a publish-ready JSON object for our import pipeline.

Instructions:
1. Search Amazon India for this product. Find the real product ASIN and construct the affiliate URL: https://www.amazon.in/dp/REAL_ASIN?tag=${AFFILIATE_TAG}
2. Find a real direct product image URL. Prefer Amazon India product page images (look for images starting with https://m.media-amazon.com/images/). The URL must end in .jpg, .png, or .webp and be a direct image — not a redirect.
3. Check r/BuyItForLife, r/frugalmalefashion, or r/watches on Reddit for community sentiment.
4. Verify the current INR price and Amazon India availability.

Score each dimension out of 20 for BIFL use:
- build_quality: physical materials, construction durability
- longevity: realistic lifespan with normal use
- value: price-to-durability ratio for Indian buyers
- repairability: self-repair or professional repair accessibility
- india_availability: ease of buying in India (0 = not available, 20 = everywhere)

Choose one: award_type = "value_buy" | "forever_pick" | "hidden_gem" | "current_star" (or null)

Return ONLY valid JSON, no markdown, no explanation:
{
  "name": "Casio F91W",
  "brand": "Casio",
  "category": "watches",
  "price_inr": 1499,
  "price_usd": 18,
  "affiliate_links": [
    { "store": "Amazon", "url": "https://www.amazon.in/dp/B000GAWSDG?tag=${AFFILIATE_TAG}", "is_affiliate": true },
    { "store": "Flipkart", "url": "https://www.flipkart.com/search?q=Casio+F91W", "is_affiliate": false }
  ],
  "image_url": "REAL_DIRECT_IMAGE_URL_FROM_AMAZON_OR_MANUFACTURER",
  "research_notes": "8-12 sentence BIFL-focused research summary covering durability, real-world use, and India context",
  "scores": {
    "build_quality": 18,
    "longevity": 19,
    "value": 20,
    "repairability": 14,
    "india_availability": 19
  },
  "specs": {
    "material": "Resin case",
    "warranty": "2 years",
    "repairability_score": 6,
    "made_in": "Japan",
    "weight": "21 g"
  },
  "award_type": "value_buy",
  "summary": "100-150 word editorial summary for the product card. Direct tone, no hype.",
  "reddit_sentiment": "Short Reddit community sentiment summary.",
  "estimated_lifespan_years": 10,
  "estimated_lifespan_multiplier": 4
}`
  },
  {
    name: 'Claude 3.5 — Full Publish-Ready',
    provider: 'Claude',
    badge: 'bg-purple-100 text-purple-800 border-purple-300',
    description: 'Use with Claude 3.5 Sonnet or Opus with web search enabled. Excellent for nuanced editorial writing and careful JSON output. Drop the result into research-drop.',
    prompt: `You are a product research analyst for BIFL365, a Buy It For Life publication for Indian buyers.

Research the watch "Casio F91W" using your web search tool. Return a publish-ready editorial JSON object.

Research priorities:
- Search Amazon India for the product. Find the real ASIN and build the affiliate URL: https://www.amazon.in/dp/ASIN?tag=${AFFILIATE_TAG}
- Find a real direct product image URL that ends in .jpg, .png, or .webp (not a redirect). Prefer https://m.media-amazon.com/images/ URLs from the Amazon India listing, or the official manufacturer product page.
- Search Flipkart and include the Flipkart search URL.
- Check Reddit (r/BuyItForLife or category-specific subreddits) for authentic community sentiment.
- Verify the current India selling price in INR.

Scoring guide (each out of 20):
- build_quality: physical robustness and materials quality
- longevity: expected useful life with typical use patterns
- value: INR price-to-durability ratio
- repairability: can a non-expert maintain or repair it in India?
- india_availability: 20 = sold everywhere in India, 0 = not available at all

specs.repairability_score is separate: rate 1–10 for DIY repair ease.

award_type options: "value_buy" | "forever_pick" | "hidden_gem" | "current_star" | null

Return ONLY valid JSON, no explanation, no markdown fences:
{
  "name": "Casio F91W",
  "brand": "Casio",
  "category": "watches",
  "price_inr": 1499,
  "price_usd": 18,
  "affiliate_links": [
    { "store": "Amazon", "url": "https://www.amazon.in/dp/B000GAWSDG?tag=${AFFILIATE_TAG}", "is_affiliate": true },
    { "store": "Flipkart", "url": "https://www.flipkart.com/search?q=Casio+F91W", "is_affiliate": false }
  ],
  "image_url": "REAL_DIRECT_IMAGE_URL",
  "research_notes": "8-12 sentence research summary. Factual, India-focused, BIFL oriented.",
  "scores": {
    "build_quality": 18,
    "longevity": 19,
    "value": 20,
    "repairability": 14,
    "india_availability": 19
  },
  "specs": {
    "material": "Resin case",
    "warranty": "2 years",
    "repairability_score": 6,
    "made_in": "Japan",
    "weight": "21 g"
  },
  "award_type": "value_buy",
  "summary": "100-150 word editorial summary. Direct tone, no hype, BIFL lens.",
  "reddit_sentiment": "Short authentic community sentiment.",
  "estimated_lifespan_years": 10,
  "estimated_lifespan_multiplier": 4
}`
  },
  {
    name: 'Gemini — Full Publish-Ready (Grounded)',
    provider: 'Gemini',
    badge: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'Use in Google AI Studio or Gemini API with googleSearch grounding enabled. Gets live Amazon India prices, real affiliate URLs, and image links. Drop the JSON into research-drop.',
    prompt: `You are a product research analyst for BIFL365, a Buy It For Life publication for Indian buyers.

Use Google Search to research the watch "Casio F91W". Return a publish-ready JSON object for our pipeline.

Steps:
1. Search "Casio F91W amazon.in" — find the real ASIN and build: https://www.amazon.in/dp/REAL_ASIN?tag=${AFFILIATE_TAG}
2. Find a real direct product image URL ending in .jpg/.png/.webp (e.g. from the Amazon India listing: https://m.media-amazon.com/images/...)
3. Search Flipkart for the product and include the search URL.
4. Check Reddit (r/BuyItForLife or r/watches) for community sentiment.
5. Note current India price in INR.

Score each out of 20: build_quality, longevity, value, repairability, india_availability.
award_type: "value_buy" | "forever_pick" | "hidden_gem" | "current_star" | null

Return pure JSON only:
{
  "name": "Casio F91W",
  "brand": "Casio",
  "category": "watches",
  "price_inr": 1499,
  "price_usd": 18,
  "affiliate_links": [
    { "store": "Amazon", "url": "https://www.amazon.in/dp/B000GAWSDG?tag=${AFFILIATE_TAG}", "is_affiliate": true },
    { "store": "Flipkart", "url": "https://www.flipkart.com/search?q=Casio+F91W", "is_affiliate": false }
  ],
  "image_url": "REAL_DIRECT_IMAGE_URL",
  "research_notes": "8-12 sentence BIFL research note",
  "scores": {
    "build_quality": 18,
    "longevity": 19,
    "value": 20,
    "repairability": 14,
    "india_availability": 19
  },
  "specs": {
    "material": "Resin case",
    "warranty": "2 years",
    "repairability_score": 6,
    "made_in": "Japan",
    "weight": "21 g"
  },
  "award_type": "value_buy",
  "summary": "100-150 word editorial summary",
  "reddit_sentiment": "Short community sentiment note",
  "estimated_lifespan_years": 10,
  "estimated_lifespan_multiplier": 4
}`
  },
  {
    name: 'Gemini — Research Only (for scoring later)',
    provider: 'Gemini',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Use when you want to run Ollama or Gemini for scoring in a separate pass. Include affiliate links and a real image URL in the research output.',
    prompt: `You are a product research analyst for BIFL365, a Buy It For Life publication for Indian buyers.

Research the Casio F91W watch and prepare usage-focused editorial research using Google Search.

Include:
- Real Amazon India search link with affiliate tag: https://www.amazon.in/s?k=Casio+F91W&tag=${AFFILIATE_TAG}
- Real direct product image URL from the Amazon India product page (e.g. https://m.media-amazon.com/images/...) — must end in .jpg, .png, or .webp
- Flipkart search link: https://www.flipkart.com/search?q=Casio+F91W
- Current INR price and India availability assessment
- Reddit or enthusiast community sentiment
- Real-world durability and longevity evidence
- Common failure modes or maintenance tips

Avoid hype. Focus on practical Indian buyer context.

Return ONLY JSON:
{
  "name": "Casio F91W",
  "brand": "Casio",
  "category": "watches",
  "price_inr": 1499,
  "price_usd": 18,
  "affiliate_links": [
    { "store": "Amazon", "url": "https://www.amazon.in/s?k=Casio+F91W&tag=${AFFILIATE_TAG}", "is_affiliate": true },
    { "store": "Flipkart", "url": "https://www.flipkart.com/search?q=Casio+F91W", "is_affiliate": false }
  ],
  "image_url": "REAL_DIRECT_IMAGE_URL",
  "research_notes": "8-12 sentence structured research note",
  "usage_scenarios": ["...", "...", "..."],
  "durability_takeaways": ["...", "...", "..."],
  "risks_or_limits": ["...", "..."],
  "india_availability_notes": "Short note",
  "community_sentiment": "Short Reddit/forum sentiment note"
}`
  },
  {
    name: 'Ollama / Local — Research Only',
    provider: 'Ollama',
    badge: 'bg-charcoal text-paper border-charcoal',
    description: 'For the local offline pipeline only. Ollama cannot browse the web, so affiliate links will be search-pattern URLs. Use Gemini or ChatGPT prompts above when you need real links and images.',
    prompt: `You are a Buy It For Life product researcher focused on Indian buyers.

Research the watch "Casio F91W" for possible inclusion on BIFL365.

Focus on:
- real-world durability and everyday use cases
- why owners keep it for years and common failure points
- repairability and replaceable parts
- India availability and realistic price range in INR
- Reddit or enthusiast community reputation
- battery life and practical maintenance

Return ONLY JSON:
{
  "name": "Casio F91W",
  "brand": "Casio",
  "category": "watches",
  "price_inr": 1499,
  "price_usd": 18,
  "affiliate_links": [
    { "store": "Amazon", "url": "https://www.amazon.in/s?k=Casio+F91W&tag=${AFFILIATE_TAG}", "is_affiliate": true },
    { "store": "Flipkart", "url": "https://www.flipkart.com/search?q=Casio+F91W", "is_affiliate": false }
  ],
  "image_url": "https://m.media-amazon.com/images/I/71JoFHxgVDL._AC_UY1000_.jpg",
  "research_notes": "6-10 sentence usage research summary",
  "pros": ["...", "..."],
  "cons": ["...", "..."],
  "india_availability_notes": "Short note",
  "reddit_context": "Short community sentiment"
}`
  }
];

function InfoCard({
  name, badge, description, command, source, scoring, content
}: {
  name: string; badge: string; description: string;
  command: string; source: string; scoring: string; content: string;
}) {
  return (
    <div className="bg-white border border-charcoal p-5 shadow-card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif font-black text-xl text-ink">{name}</h2>
          <p className="text-sm font-sans text-charcoal-400 mt-2">{description}</p>
        </div>
        <span className="px-2 py-1 text-[10px] uppercase tracking-widest font-bold border bg-paper-dark text-charcoal border-charcoal shrink-0">
          {badge}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm font-sans">
        <div className="border border-ghost p-3 bg-paper-dark">
          <div className="text-[10px] uppercase tracking-widest text-charcoal-400 mb-1">Research</div>
          <div className="text-ink">{source}</div>
        </div>
        <div className="border border-ghost p-3 bg-paper-dark">
          <div className="text-[10px] uppercase tracking-widest text-charcoal-400 mb-1">Scoring</div>
          <div className="text-ink">{scoring}</div>
        </div>
        <div className="border border-ghost p-3 bg-paper-dark">
          <div className="text-[10px] uppercase tracking-widest text-charcoal-400 mb-1">Content</div>
          <div className="text-ink">{content}</div>
        </div>
      </div>

      <div className="border border-ghost bg-charcoal text-paper p-3 overflow-x-auto">
        <div className="text-[10px] uppercase tracking-widest text-charcoal-200 mb-2">Run Command</div>
        <code className="text-xs font-mono whitespace-pre-wrap break-all">{command}</code>
      </div>
    </div>
  );
}

export default async function PipelinePage() {
  const { data } = await supabase.from('pipeline_runs').select('*').order('started_at', { ascending: false }).limit(20);
  const runs = (data ?? []) as unknown as PipelineRun[];
  const isRunning = runs.length > 0 && runs[0].status === 'running';

  const config = JSON.parse(readFileSync(join(process.cwd(), 'bifl365.config.json'), 'utf-8'));

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="font-serif font-black text-3xl text-ink">Pipeline Runner</h1>
        <p className="text-sm font-sans text-charcoal-400 mt-2 max-w-2xl">
          Three supported modes: online AI (UI trigger), local Ollama (terminal), and imported research bundles (drop JSON files into{' '}
          <code className="bg-white border border-ghost px-1 py-0.5 text-xs">research-drop/</code>).
          See <code className="bg-white border border-ghost px-1 py-0.5 text-xs">PIPELINE_GUIDEBOOK.md</code> for full details.
        </p>
      </div>

      {/* Trigger form — provider + category subset selection */}
      <PipelineTriggerForm disabled={isRunning} categories={config.categories} />

      {/* Mode Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {modes.map((mode) => (
          <InfoCard key={mode.name} {...mode} />
        ))}
      </div>

      {/* Research Prompt Library — collapsible */}
      <details className="group bg-white border border-charcoal shadow-card">
        <summary className="flex items-center justify-between p-5 cursor-pointer select-none list-none">
          <div>
            <h2 className="font-serif font-black text-2xl text-ink">Research Prompt Library</h2>
            <p className="text-sm font-sans text-charcoal-400 mt-1">
              Copy a prompt into ChatGPT, Claude, Gemini, or Ollama. Includes affiliate links and image URL instructions.
            </p>
          </div>
          <span className="ml-4 shrink-0 text-charcoal-400 group-open:rotate-180 transition-transform duration-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </summary>

        <div className="px-5 pb-5 space-y-6 border-t border-ghost pt-5">
          <div className="bg-orange-pale border border-orange p-4 text-sm font-sans">
            <strong className="text-orange uppercase tracking-widest text-xs">Before copying:</strong>
            <ul className="mt-2 space-y-1 text-charcoal list-disc list-inside">
              <li>Replace <code className="bg-white px-1 border border-ghost text-xs">Casio F91W</code> with your product name</li>
              <li>Replace <code className="bg-white px-1 border border-ghost text-xs">watches</code> with the correct category</li>
              <li>The affiliate tag <code className="bg-white px-1 border border-ghost text-xs">{AFFILIATE_TAG}</code> is already included in all prompts</li>
              <li>Drop the output JSON into <code className="bg-white px-1 border border-ghost text-xs">research-drop/</code> and run <code className="bg-white px-1 border border-ghost text-xs">npm run pipeline:dropbox:publish</code></li>
            </ul>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {promptExamples.map((example) => (
              <PromptCard key={example.name} {...example} />
            ))}
          </div>
        </div>
      </details>

      {/* Schedule & Config Editor */}
      <ScheduleEditor initialConfig={config.pipeline} />

      {/* Pipeline Run History */}
      <div className="bg-white border border-charcoal shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-ghost">
          <h2 className="font-serif font-bold text-xl text-ink">Run History</h2>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-charcoal text-paper text-[10px] font-sans uppercase tracking-widest">
              <th className="p-4 font-normal">Status</th>
              <th className="p-4 font-normal">Started</th>
              <th className="p-4 font-normal">Completed</th>
              <th className="p-4 font-normal text-right">Found</th>
              <th className="p-4 font-normal text-right">Approved</th>
            </tr>
          </thead>
          <tbody className="text-sm font-sans">
            {runs?.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-charcoal-400">No pipeline runs recorded.</td>
              </tr>
            ) : (
              runs?.map((run) => (
                <tr key={run.id} className="border-b border-ghost last:border-0 hover:bg-paper-dark transition-colors">
                  <td className="p-4">
                    {run.status === 'failed' && (run.error_message || run.error_log) ? (
                      <details className="group">
                        <summary className="cursor-pointer list-none inline-flex items-center gap-2">
                          <span className="px-2 py-0.5 text-[10px] uppercase tracking-widest font-bold border bg-error-light text-error border-error">
                            failed
                          </span>
                          {run.error_message && (
                            <span className="text-xs text-error truncate max-w-[200px]">{run.error_message}</span>
                          )}
                        </summary>
                        {run.error_log && (
                          <pre className="mt-2 p-3 bg-charcoal text-paper font-mono text-xs overflow-x-auto max-h-48 whitespace-pre-wrap">
                            {run.error_log}
                          </pre>
                        )}
                      </details>
                    ) : (
                      <span className={`px-2 py-0.5 text-[10px] uppercase tracking-widest font-bold border ${
                        run.status === 'success'
                          ? 'bg-orange-pale text-orange border-orange'
                          : run.status === 'failed'
                            ? 'bg-error-light text-error border-error'
                            : 'bg-charcoal-200 text-charcoal border-charcoal'
                      }`}>
                        {run.status}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-charcoal-400">{new Date(run.started_at).toLocaleString()}</td>
                  <td className="p-4 text-charcoal-400">
                    {run.completed_at ? new Date(run.completed_at).toLocaleString() : '—'}
                  </td>
                  <td className="p-4 text-right font-bold text-ink">{run.products_found ?? '—'}</td>
                  <td className="p-4 text-right font-bold text-ink">{run.products_approved ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
