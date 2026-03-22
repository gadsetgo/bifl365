import type { AffiliateLink } from './types';
import { validateAffiliateUrl } from './link-validator';

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
  const result = validateAffiliateUrl(link.url, link.store);
  if (result.status === 'broken' || result.status === 'suspicious') return 'search';
  return 'direct';
}

/**
 * Get display-ready links for a product.
 * - Valid direct links show "Buy on {store}"
 * - Broken/suspicious links show "Search {store}"
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

  for (const link of links) {
    const type = classifyLink(link);
    if (type === 'search') {
      result.push({ store: link.store, url: makeSearchUrl(link.store, productName), isSearch: true });
    } else {
      result.push({ store: link.store, url: link.url, isSearch: false });
    }
  }

  // If no links at all, provide search fallbacks
  if (result.length === 0) {
    result.push({ store: 'Amazon', url: makeSearchUrl('Amazon', productName), isSearch: true });
    result.push({ store: 'Flipkart', url: makeSearchUrl('Flipkart', productName), isSearch: true });
  }

  return result;
}
