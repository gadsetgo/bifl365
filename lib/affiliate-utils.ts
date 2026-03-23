import type { AffiliateLink } from './types';
import { validateAffiliateUrl, detectLinkType } from './link-validator';

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

export interface DisplayLink {
  store: string;
  url: string;
  isSearch: boolean;
  linkType: 'affiliate' | 'brand' | 'search';
}

/**
 * Get display-ready links for a product.
 * - Valid affiliate links (Amazon/Flipkart/Meesho) → tracked via /api/go
 * - Valid brand links (official sites) → direct <a href>
 * - Broken/suspicious links → search fallback
 * - No links at all → default Amazon + Flipkart search fallbacks
 */
export function getDisplayLinks(
  affiliateLinks: AffiliateLink[] | null,
  legacyAmazon: string | null | undefined,
  legacyFlipkart: string | null | undefined,
  productName: string,
): DisplayLink[] {
  const links = [...(affiliateLinks ?? [])];
  if (links.length === 0) {
    if (legacyAmazon) links.push({ store: 'Amazon', url: legacyAmazon, is_affiliate: false });
    if (legacyFlipkart) links.push({ store: 'Flipkart', url: legacyFlipkart, is_affiliate: false });
  }

  const result: DisplayLink[] = [];

  for (const link of links) {
    const type = classifyLink(link);
    if (type === 'search') {
      result.push({ store: link.store, url: makeSearchUrl(link.store, productName), isSearch: true, linkType: 'search' });
    } else {
      const lt = link.link_type ?? detectLinkType(link.url);
      result.push({ store: link.store, url: link.url, isSearch: false, linkType: lt });
    }
  }

  // If no links at all, provide search fallbacks
  if (result.length === 0) {
    result.push({ store: 'Amazon', url: makeSearchUrl('Amazon', productName), isSearch: true, linkType: 'search' });
    result.push({ store: 'Flipkart', url: makeSearchUrl('Flipkart', productName), isSearch: true, linkType: 'search' });
  }

  return result;
}
