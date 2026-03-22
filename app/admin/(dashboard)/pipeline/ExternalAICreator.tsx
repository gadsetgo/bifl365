'use client';

import { useState, useMemo } from 'react';

interface CategoryOption {
  value: string;
  label: string;
}

interface ExternalAICreatorProps {
  affiliateTag: string;
  categories: CategoryOption[];
}

const PROVIDERS = [
  { id: 'chatgpt', label: 'ChatGPT', badge: 'bg-green-100 text-green-800 border-green-300' },
  { id: 'claude', label: 'Claude', badge: 'bg-purple-100 text-purple-800 border-purple-300' },
  { id: 'gemini', label: 'Gemini', badge: 'bg-blue-100 text-blue-800 border-blue-300' },
  { id: 'gemini-research', label: 'Gemini Research', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'ollama', label: 'Ollama', badge: 'bg-charcoal text-paper border-charcoal' },
] as const;

type ProviderId = typeof PROVIDERS[number]['id'];

function buildPrompt(provider: ProviderId, productName: string, category: string, affiliateTag: string): string {
  const jsonShape = `{
  "name": "${productName}",
  "brand": "",
  "category": "${category}",
  "price_inr": 0,
  "price_usd": 0,
  "affiliate_links": [
    { "store": "Amazon", "url": "https://www.amazon.in/dp/REAL_ASIN?tag=${affiliateTag}", "is_affiliate": true },
    { "store": "Amazon Variant", "url": "https://www.amazon.in/dp/VARIANT_ASIN?tag=${affiliateTag}", "is_affiliate": true },
    { "store": "Flipkart", "url": "https://www.flipkart.com/product-name/p/REAL_PID", "is_affiliate": false },
    { "store": "Brand Store", "url": "https://brand-website.com/product", "is_affiliate": false }
  ],
  "image_url": "PRIMARY_IMAGE_URL",
  "image_candidates": [
    "https://manufacturer-site.com/product-image.jpg",
    "https://m.media-amazon.com/images/I/REAL_IMAGE_ID.jpg",
    "https://brand-cdn.com/product-photo.png"
  ],
  "scores": {
    "build_quality": 18,
    "longevity": 19,
    "value": 16,
    "repairability": 15,
    "india_availability": 18
  },
  "specs": {
    "material": "",
    "warranty": "",
    "repairability_score": 8,
    "made_in": "",
    "weight": ""
  },
  "award_type": "value_buy",
  "summary": "100-150 word editorial summary",
  "reddit_sentiment": "Short community sentiment note",
  "estimated_lifespan_years": 25,
  "estimated_lifespan_multiplier": 5
}`;

  const scoringGuide = `Score each dimension out of 20 for BIFL use:
- build_quality: physical materials, construction durability
- longevity: realistic lifespan with normal use
- value: price-to-durability ratio for Indian buyers
- repairability: self-repair or professional repair accessibility in India
- india_availability: ease of buying in India (0 = not available, 20 = everywhere)

award_type: "value_buy" | "forever_pick" | "hidden_gem" | "current_star" | null`;

  const linkInstructions = `AFFILIATE LINKS — provide ALL that apply:
- Amazon India: find the real ASIN, build URL as https://www.amazon.in/dp/ASIN?tag=${affiliateTag}
- If the product has variants (sizes, colours, models), include each variant as a separate affiliate_links entry with a descriptive store name like "Amazon (Large)" or "Amazon (Black)"
- Flipkart: find the real product page URL (not a search URL)
- Brand/manufacturer store: include the official product page if available
- Other stores: include any other Indian e-commerce links (Croma, Tata CLiQ, etc.)
- NEVER use search URLs like /s?k=... or /search?q=...`;

  const imageInstructions = `IMAGES — provide up to 5 image URLs in image_candidates array:
- Prefer manufacturer/brand website images (most stable)
- Include Amazon India product images (https://m.media-amazon.com/images/I/...)
- Include Flipkart or other e-commerce images
- All URLs must be direct image links ending in .jpg, .png, or .webp
- Set image_url to your best/primary image
- More images = better, since broken ones get filtered during verification`;

  switch (provider) {
    case 'chatgpt':
      return `You are a product research analyst for BIFL365, a Buy It For Life publication for Indian buyers.

Research "${productName}" (category: ${category}) using live web search. Return a publish-ready JSON object for our import pipeline.

Instructions:
1. Search Amazon India for this product. Find the real product ASIN and construct the affiliate URL: https://www.amazon.in/dp/REAL_ASIN?tag=${affiliateTag}
2. Find up to 5 real direct product image URLs from different sources (manufacturer site preferred, then Amazon, Flipkart, etc.)
3. Check r/BuyItForLife or category-specific subreddits for community sentiment.
4. Verify the current INR price and Amazon India availability.
5. If the product has variants on Amazon (different sizes, colours, bundles), include each variant link.
6. Find non-Amazon buying links (Flipkart product page, brand store, etc.)

${linkInstructions}

${imageInstructions}

${scoringGuide}

Return ONLY valid JSON, no markdown, no explanation:
${jsonShape}`;

    case 'claude':
      return `You are a product research analyst for BIFL365, a Buy It For Life publication for Indian buyers.

Research "${productName}" (category: ${category}) using your web search tool. Return a publish-ready editorial JSON object.

Research priorities:
- Search Amazon India for the product. Find the real ASIN and build the affiliate URL: https://www.amazon.in/dp/ASIN?tag=${affiliateTag}
- If variants exist (sizes, colours), include each as a separate affiliate_links entry
- Find the Flipkart product page (not search URL) and any brand store links
- Find up to 5 direct product image URLs from different sources — prefer manufacturer/brand site images over Amazon
- Check Reddit (r/BuyItForLife or category-specific subreddits) for authentic community sentiment
- Verify the current India selling price in INR

${linkInstructions}

${imageInstructions}

${scoringGuide}

specs.repairability_score is separate: rate 1-10 for DIY repair ease.

Return ONLY valid JSON, no explanation, no markdown fences:
${jsonShape}`;

    case 'gemini':
      return `You are a product research analyst for BIFL365, a Buy It For Life publication for Indian buyers.

Use Google Search to research "${productName}" (category: ${category}). Return a publish-ready JSON object for our pipeline.

Steps:
1. Search "${productName} amazon.in" — find the real ASIN and build: https://www.amazon.in/dp/REAL_ASIN?tag=${affiliateTag}
2. If variants exist on Amazon (sizes, colours, models), include each variant ASIN as a separate affiliate_links entry
3. Search Flipkart for the real product page URL
4. Find the manufacturer/brand product page
5. Find up to 5 real direct product image URLs from different sources (manufacturer site preferred, then Amazon, Flipkart)
6. Check Reddit for community sentiment
7. Note current India price in INR

${linkInstructions}

${imageInstructions}

${scoringGuide}

Return pure JSON only:
${jsonShape}`;

    case 'gemini-research':
      return `You are a product research analyst for BIFL365, a Buy It For Life publication for Indian buyers.

Research "${productName}" (category: ${category}) and prepare usage-focused editorial research using Google Search.

Include:
- Real Amazon India product link with affiliate tag: https://www.amazon.in/dp/REAL_ASIN?tag=${affiliateTag}
- If variants exist, include each variant ASIN
- Real Flipkart product page link and brand store link
- Up to 5 real direct product image URLs from different sources (prefer manufacturer/brand site images)
- Current INR price and India availability assessment
- Reddit or enthusiast community sentiment
- Real-world durability and longevity evidence
- Common failure modes or maintenance tips

${linkInstructions}

${imageInstructions}

Return ONLY JSON:
{
  "name": "${productName}",
  "brand": "",
  "category": "${category}",
  "price_inr": 0,
  "price_usd": 0,
  "affiliate_links": [
    { "store": "Amazon", "url": "https://www.amazon.in/dp/REAL_ASIN?tag=${affiliateTag}", "is_affiliate": true },
    { "store": "Flipkart", "url": "https://www.flipkart.com/product/p/PID", "is_affiliate": false }
  ],
  "image_url": "PRIMARY_IMAGE_URL",
  "image_candidates": ["url1", "url2", "url3"],
  "research_notes": "8-12 sentence structured research note",
  "usage_scenarios": ["...", "..."],
  "durability_takeaways": ["...", "..."],
  "risks_or_limits": ["...", "..."],
  "india_availability_notes": "Short note",
  "community_sentiment": "Short Reddit/forum sentiment note"
}`;

    case 'ollama':
      return `You are a Buy It For Life product researcher focused on Indian buyers.

Research "${productName}" (category: ${category}) for possible inclusion on BIFL365.

Focus on:
- real-world durability and everyday use cases
- why owners keep it for years and common failure points
- repairability and replaceable parts
- India availability and realistic price range in INR
- Reddit or enthusiast community reputation

Return ONLY JSON:
{
  "name": "${productName}",
  "brand": "",
  "category": "${category}",
  "price_inr": 0,
  "price_usd": 0,
  "affiliate_links": [
    { "store": "Amazon", "url": "https://www.amazon.in/s?k=${encodeURIComponent(productName)}&tag=${affiliateTag}", "is_affiliate": true },
    { "store": "Flipkart", "url": "https://www.flipkart.com/search?q=${encodeURIComponent(productName)}", "is_affiliate": false }
  ],
  "image_url": "",
  "image_candidates": [],
  "research_notes": "6-10 sentence usage research summary",
  "pros": ["...", "..."],
  "cons": ["...", "..."],
  "india_availability_notes": "Short note",
  "reddit_context": "Short community sentiment"
}`;
  }
}

interface ParsedResult {
  valid: boolean;
  product: Record<string, any>;
  warnings: string[];
  errors: string[];
}

export function ExternalAICreator({ affiliateTag, categories }: ExternalAICreatorProps) {
  // Step 1 state
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState(categories[0]?.value ?? 'kitchen');
  const [provider, setProvider] = useState<ProviderId>('chatgpt');
  const [copied, setCopied] = useState(false);

  // Step 2 state
  const [pastedJson, setPastedJson] = useState('');
  const [parsed, setParsed] = useState<ParsedResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const prompt = useMemo(() => {
    if (!productName.trim()) return '';
    return buildPrompt(provider, productName.trim(), category, affiliateTag);
  }, [productName, category, provider, affiliateTag]);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Copy failed', e);
    }
  };

  const parseJson = async () => {
    setParsed(null);
    setCreateResult(null);

    try {
      // Dynamic import to keep this client-side friendly
      const { normalizeExternalProductJson } = await import('@/lib/product-json-normalizer');
      const result = normalizeExternalProductJson(pastedJson, affiliateTag);
      setParsed(result);
    } catch (e: any) {
      setParsed({ valid: false, product: {}, warnings: [], errors: [e.message] });
    }
  };

  const createProduct = async () => {
    if (!parsed?.valid || !parsed.product.name) return;
    setCreating(true);
    setCreateResult(null);
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.product),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? body?.errors?.[0]?.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setCreateResult({ type: 'success', text: `Product "${data.name}" created (ID: ${data.id}). Check the Board to review.` });
      setPastedJson('');
      setParsed(null);
    } catch (e: any) {
      setCreateResult({ type: 'error', text: e.message });
    } finally {
      setCreating(false);
    }
  };

  const selectedProvider = PROVIDERS.find(p => p.id === provider)!;

  return (
    <div className="bg-white border border-charcoal shadow-card">
      <div className="px-5 py-4 border-b border-ghost">
        <h2 className="font-serif font-black text-2xl text-ink">External AI Product Creator</h2>
        <p className="text-sm font-sans text-charcoal-400 mt-1">
          Generate a research prompt, copy it to any LLM, paste the JSON response back to create a product.
        </p>
      </div>

      <div className="p-5 space-y-6">
        {/* Step 1: Prompt Generator */}
        <div className="space-y-4">
          <div className="text-[10px] font-sans uppercase tracking-widest text-charcoal-400 font-bold">
            Step 1 — Generate Prompt
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-sans uppercase tracking-widest text-charcoal-400 mb-1">
                Product Name
              </label>
              <input
                type="text"
                value={productName}
                onChange={e => setProductName(e.target.value)}
                placeholder="e.g. Casio F91W"
                className="w-full border border-charcoal px-3 py-2 text-sm font-sans focus:outline-none focus:border-orange"
              />
            </div>
            <div>
              <label className="block text-[10px] font-sans uppercase tracking-widest text-charcoal-400 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full border border-charcoal px-3 py-2 text-sm font-sans focus:outline-none focus:border-orange bg-white"
              >
                {categories.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Provider tabs */}
          <div className="flex flex-wrap gap-1">
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                className={`px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold border transition-colors ${
                  provider === p.id
                    ? 'bg-orange text-paper border-orange'
                    : 'border-charcoal text-charcoal-400 hover:text-ink hover:border-ink'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Generated prompt */}
          {prompt ? (
            <div className="border border-ghost bg-charcoal text-paper p-3 overflow-x-auto max-h-64 overflow-y-auto relative">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-widest text-charcoal-200">
                  Prompt for <span className={`px-1.5 py-0.5 text-[9px] border ${selectedProvider.badge}`}>{selectedProvider.label}</span>
                </div>
                <button
                  onClick={copyPrompt}
                  className="bg-paper border border-charcoal text-charcoal px-2 py-1 text-xs font-sans hover:bg-paper-dark transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <code className="text-xs font-mono whitespace-pre-wrap break-all">{prompt}</code>
            </div>
          ) : (
            <div className="border border-ghost bg-paper-dark p-8 text-center text-sm font-sans text-charcoal-400">
              Enter a product name to generate the prompt
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-ghost" />

        {/* Step 2: Paste Response */}
        <div className="space-y-4">
          <div className="text-[10px] font-sans uppercase tracking-widest text-charcoal-400 font-bold">
            Step 2 — Paste LLM Response
          </div>

          <textarea
            value={pastedJson}
            onChange={e => { setPastedJson(e.target.value); setParsed(null); setCreateResult(null); }}
            placeholder="Paste the JSON response from the LLM here..."
            rows={8}
            className="w-full border border-charcoal px-3 py-2 text-xs font-mono focus:outline-none focus:border-orange resize-y"
          />

          <button
            onClick={parseJson}
            disabled={!pastedJson.trim()}
            className="h-9 px-5 bg-charcoal text-paper text-xs font-bold uppercase tracking-widest hover:bg-charcoal-700 disabled:opacity-50 transition-colors"
          >
            Parse &amp; Preview
          </button>

          {/* Parse errors */}
          {parsed && !parsed.valid && (
            <div className="p-3 bg-red-50 border border-red-300 text-sm font-sans text-red-800 space-y-1">
              {parsed.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}

          {/* Parse success — preview */}
          {parsed?.valid && parsed.product && (
            <div className="border border-ghost p-4 space-y-4">
              <div className="text-[10px] font-sans uppercase tracking-widest text-charcoal-400 font-bold">Preview</div>

              {/* Basic info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm font-sans">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-charcoal-400 block">Name</span>
                  <span className="text-ink font-bold">{parsed.product.name}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-charcoal-400 block">Brand</span>
                  <span className="text-ink">{parsed.product.brand || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-charcoal-400 block">Category</span>
                  <span className="text-ink">{parsed.product.category}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-charcoal-400 block">Award</span>
                  <span className="text-ink">{parsed.product.award_type || '—'}</span>
                </div>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm font-sans">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-charcoal-400 block">Price INR</span>
                  <span className="text-ink">{parsed.product.price_inr ? `₹${parsed.product.price_inr}` : '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-charcoal-400 block">Price USD</span>
                  <span className="text-ink">{parsed.product.price_usd ? `$${parsed.product.price_usd}` : '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-charcoal-400 block">Lifespan</span>
                  <span className="text-ink">{parsed.product.estimated_lifespan_years ? `${parsed.product.estimated_lifespan_years} years` : '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-charcoal-400 block">Multiplier</span>
                  <span className="text-ink">{parsed.product.estimated_lifespan_multiplier ? `${parsed.product.estimated_lifespan_multiplier}x` : '—'}</span>
                </div>
              </div>

              {/* Scores */}
              {parsed.product.scores && (
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-charcoal-400 block mb-2">Scores</span>
                  <div className="grid grid-cols-5 gap-2">
                    {Object.entries(parsed.product.scores as Record<string, number>).map(([key, val]) => (
                      <div key={key} className="text-center">
                        <div className="text-xs font-bold text-ink">{val}/20</div>
                        <div className="text-[9px] text-charcoal-400 uppercase">{key.replace(/_/g, ' ')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Affiliate links */}
              {parsed.product.affiliate_links && parsed.product.affiliate_links.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-charcoal-400 block mb-1">
                    Links ({parsed.product.affiliate_links.length})
                  </span>
                  <div className="space-y-1">
                    {parsed.product.affiliate_links.map((link: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs font-sans">
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase border ${
                          link.is_affiliate ? 'bg-orange-pale text-orange border-orange' : 'bg-paper-dark text-charcoal-400 border-ghost'
                        }`}>
                          {link.store}
                        </span>
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-md">
                          {link.url}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Image candidates */}
              {parsed.product.image_candidates && parsed.product.image_candidates.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-charcoal-400 block mb-1">
                    Images ({parsed.product.image_candidates.length})
                  </span>
                  <div className="flex gap-2 flex-wrap">
                    {parsed.product.image_candidates.map((url: string, i: number) => (
                      <div key={i} className="w-16 h-16 border border-ghost bg-paper-dark flex items-center justify-center overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`candidate ${i + 1}`}
                          className="max-w-full max-h-full object-contain"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              {parsed.product.summary && (
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-charcoal-400 block mb-1">Summary</span>
                  <p className="text-xs font-sans text-charcoal leading-relaxed">{parsed.product.summary}</p>
                </div>
              )}

              {/* Warnings */}
              {parsed.warnings.length > 0 && (
                <div className="p-3 bg-orange-pale border border-orange text-sm font-sans text-charcoal space-y-1">
                  <strong className="text-orange uppercase tracking-widest text-xs">Warnings:</strong>
                  {parsed.warnings.map((w, i) => <div key={i} className="text-xs">{w}</div>)}
                </div>
              )}

              {/* Validation checks */}
              <div className="flex flex-wrap gap-2 text-xs font-sans">
                <Check ok={!!parsed.product.name} label="Name" />
                <Check ok={!!parsed.product.scores} label="Scores" />
                <Check ok={(parsed.product.affiliate_links?.length ?? 0) > 0} label="Links" />
                <Check ok={(parsed.product.image_candidates?.length ?? 0) > 0} label="Images" />
                <Check ok={!!parsed.product.summary} label="Summary" />
                <Check ok={!!parsed.product.award_type} label="Award" />
              </div>

              {/* Create button */}
              <div className="flex items-center gap-4">
                <button
                  onClick={createProduct}
                  disabled={creating}
                  className="h-10 px-6 bg-orange border border-charcoal text-paper font-sans uppercase text-xs tracking-widest font-bold hover:bg-orange/90 disabled:opacity-50 transition-colors"
                >
                  {creating ? 'Creating...' : 'Create Product'}
                </button>
                {createResult && (
                  <span className={`text-sm font-sans ${createResult.type === 'success' ? 'text-green-700' : 'text-error'}`}>
                    {createResult.text}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`px-2 py-0.5 border text-[10px] uppercase tracking-widest font-bold ${
      ok ? 'bg-green-50 text-green-700 border-green-300' : 'bg-paper-dark text-charcoal-400 border-ghost'
    }`}>
      {ok ? '\u2713' : '\u2717'} {label}
    </span>
  );
}
