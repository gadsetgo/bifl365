import type { AffiliateLink } from './types';

/** Check if a URL is a search/listing page rather than a direct product page */
export function isSearchUrl(url: string): boolean {
  return url.includes('/s?k=') || url.includes('/search?q=') || url.includes('/s?') || url.includes('google.com/search');
}

/** Check if a URL points to an error/dead page pattern */
export function isLikelyDeadUrl(url: string): boolean {
  try {
    const u = new URL(url);
    // Amazon "does not exist" patterns
    if (u.pathname === '/' || u.pathname === '') return true;
    // Very short paths are usually not product pages
    if (u.hostname.includes('amazon') && u.pathname.length < 5 && !u.search) return true;
    return false;
  } catch {
    return true;
  }
}

/** Generate a search URL for a given store and product query */
export function makeSearchUrl(store: string, productName: string): string {
  const q = encodeURIComponent(productName);
  const s = store.toLowerCase();
  if (s.includes('amazon')) return `https://www.amazon.in/s?k=${q}&tag=bifl365-21`;
  if (s.includes('flipkart')) return `https://www.flipkart.com/search?q=${q}`;
  return `https://www.google.com/search?q=${q}&tbm=shop`;
}

/** Classify a link as direct product page or search fallback */
export function classifyLink(link: AffiliateLink): 'direct' | 'search' {
  if (isSearchUrl(link.url) || isLikelyDeadUrl(link.url)) return 'search';
  return 'direct';
}

/**
 * Get display-ready links for a product.
 * - Direct links show "Buy on {store}"
 * - Search links show "Search {store}" / "Search Google Shopping"
 * - If no links at all, generate search fallbacks for Amazon + Flipkart
 */
export function getDisplayLinks(
  affiliateLinks: AffiliateLink[] | null,
  legacyAmazon: string | null | undefined,
  legacyFlipkart: string | null | undefined,
  productName: string,
): { store: string; url: string; isSearch: boolean }[] {
  const links = [...(affiliateLinks ?? [])];
  if (links.length === 0) {
    if (legacyAmazon) links.push({ store: 'Amazon', url: legacyAmazon, is_affiliate: false });
    if (legacyFlipkart) links.push({ store: 'Flipkart', url: legacyFlipkart, is_affiliate: false });
  }

  const result: { store: string; url: string; isSearch: boolean }[] = [];
  const seenStores = new Set<string>();

  for (const link of links) {
    const type = classifyLink(link);
    if (type === 'search') {
      // Replace broken/search URLs with proper search URLs
      result.push({ store: link.store, url: makeSearchUrl(link.store, productName), isSearch: true });
    } else {
      result.push({ store: link.store, url: link.url, isSearch: false });
    }
    seenStores.add(link.store.toLowerCase());
  }

  // If no links at all, provide search fallbacks
  if (result.length === 0) {
    result.push({ store: 'Amazon', url: makeSearchUrl('Amazon', productName), isSearch: true });
    result.push({ store: 'Flipkart', url: makeSearchUrl('Flipkart', productName), isSearch: true });
  }

  return result;
}
