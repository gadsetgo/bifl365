/**
 * Product deduplication utilities.
 * Extracts canonical keys from product names for fuzzy matching.
 */

const FILLER_WORDS = new Set([
  'watch', 'digital', 'analog', 'analogue', 'classic', 'premium', 'edition',
  'pro', 'plus', 'ultra', 'lite', 'mini', 'max', 'new', 'latest', 'original',
  'genuine', 'authentic', 'official', 'with', 'for', 'and', 'the', 'a', 'an',
  'in', 'on', 'of', 'by', 'from', 'to', 'set', 'kit', 'pack', 'piece',
  'series', 'collection', 'range', 'line', 'model', 'type', 'style', 'version',
  'men', 'women', 'unisex', 'adult', 'kids', 'boy', 'girl',
  'black', 'white', 'silver', 'gold', 'blue', 'red', 'green', 'grey', 'gray',
  'stainless', 'steel', 'leather', 'rubber', 'silicone', 'nylon', 'canvas',
  'water', 'resistant', 'proof', 'waterproof',
  'indian', 'india', 'imported',
]);

// Model number patterns: alphanumeric with dashes/dots (e.g., DW-5600E-1V, F-91W, MX3000)
const MODEL_PATTERN = /\b([A-Z]{1,5}[\-.]?[0-9]{1,6}[A-Z0-9\-.]*)\b/gi;

/**
 * Extract a canonical key from a product name + brand.
 * Strips filler words, extracts model numbers, normalizes.
 *
 * "Casio G-Shock DW-5600E-1V Classic Digital Watch" → "casio g-shock dw-5600e-1v"
 * "Prestige Svachh 5L Pressure Cooker" → "prestige svachh 5l pressure cooker"
 */
export function extractCanonicalKey(name: string, brand: string): string {
  const combined = `${brand} ${name}`.toLowerCase();

  // Extract model numbers first (they're the most identifying part)
  const models = combined.match(MODEL_PATTERN) ?? [];
  const modelSet = new Set(models.map(m => m.toLowerCase()));

  // Split into words, remove fillers, keep substantive words
  const words = combined
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0)
    .filter(w => !FILLER_WORDS.has(w));

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const w of words) {
    if (!seen.has(w)) {
      seen.add(w);
      unique.push(w);
    }
  }

  const key = unique.join(' ').trim();

  // If we found model numbers, prioritize brand + models as the key
  if (modelSet.size > 0) {
    const brandLower = brand.toLowerCase().trim();
    // Also include sub-brand words (e.g., "g-shock" from the name)
    const nameParts = name.toLowerCase().replace(/[^\w\s-]/g, ' ').split(/\s+/);
    const subBrands = nameParts.filter(w => !FILLER_WORDS.has(w) && !modelSet.has(w) && w.includes('-'));
    const modelKey = [brandLower, ...subBrands, ...[...modelSet]].filter(Boolean).join(' ');
    return modelKey || key;
  }

  return key;
}

/**
 * Determine if two products are likely duplicates based on their names and brands.
 * Returns a confidence score from 0 to 1.
 */
export function areLikelyDuplicates(
  nameA: string, brandA: string,
  nameB: string, brandB: string,
): number {
  const keyA = extractCanonicalKey(nameA, brandA);
  const keyB = extractCanonicalKey(nameB, brandB);

  // Exact canonical key match
  if (keyA === keyB) return 0.95;

  // Check if brands differ entirely
  const brandMatch = brandA.toLowerCase().trim() === brandB.toLowerCase().trim();

  // One key contains the other (partial match)
  if (keyA.includes(keyB) || keyB.includes(keyA)) {
    return brandMatch ? 0.85 : 0.4;
  }

  // Word overlap ratio
  const wordsA = new Set(keyA.split(' '));
  const wordsB = new Set(keyB.split(' '));
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  const jaccard = union > 0 ? intersection / union : 0;

  // Brand mismatch penalty
  const score = brandMatch ? jaccard : jaccard * 0.5;

  return Math.min(score, 1);
}
