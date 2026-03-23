import { AFFILIATE_TAG } from './constants';

export type LinkStatus = 'valid' | 'suspicious' | 'broken';

export interface LinkValidationResult {
  url: string;
  store: string;
  status: LinkStatus;
  reason?: string;
}

interface AffLink {
  store: string;
  url: string;
  is_affiliate: boolean;
  link_type?: 'affiliate' | 'brand';
}

const AFFILIATE_HOSTNAMES = new Set([
  'amazon.in',
  'amazon.com',
  'www.amazon.in',
  'www.amazon.com',
  'flipkart.com',
  'www.flipkart.com',
  'meesho.com',
  'www.meesho.com',
]);

/**
 * Detect whether a URL is an affiliate store link or a brand/official link.
 * Affiliate: Amazon, Flipkart, Meesho (tracked via /api/go)
 * Brand: everything else (rendered as direct <a href>)
 */
export function detectLinkType(url: string): 'affiliate' | 'brand' {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (AFFILIATE_HOSTNAMES.has(host)) return 'affiliate';
    // Check without www prefix too
    const bare = host.replace(/^www\./, '');
    if (AFFILIATE_HOSTNAMES.has(bare)) return 'affiliate';
    return 'brand';
  } catch {
    return 'brand';
  }
}

/**
 * Validate an affiliate URL based on known URL patterns.
 * Amazon product pages must have /dp/ASIN or /gp/product/ASIN.
 * Flipkart product pages must have /p/ in the path.
 */
export function validateAffiliateUrl(url: string, store: string): LinkValidationResult {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    // Amazon validation
    if (host.includes('amazon.in') || host.includes('amazon.com')) {
      if (parsed.pathname.match(/\/(dp|gp\/product)\/[A-Z0-9]{10}/i)) {
        return { url, store, status: 'valid' };
      }
      if (parsed.pathname.includes('/s') && (parsed.searchParams.has('k') || parsed.searchParams.has('keywords'))) {
        return { url, store, status: 'broken', reason: 'Search URL, not a product page' };
      }
      if (parsed.pathname === '/' || parsed.pathname === '') {
        return { url, store, status: 'broken', reason: 'Homepage, not a product page' };
      }
      return { url, store, status: 'suspicious', reason: 'No /dp/ or /gp/product/ ASIN pattern found' };
    }

    // Flipkart validation
    if (host.includes('flipkart.com')) {
      if (parsed.pathname.includes('/p/')) {
        return { url, store, status: 'valid' };
      }
      if (parsed.pathname.includes('/product-reviews/')) {
        return { url, store, status: 'broken', reason: 'Review page, not a product page' };
      }
      if (parsed.pathname.includes('/search')) {
        return { url, store, status: 'broken', reason: 'Search URL, not a product page' };
      }
      if (parsed.pathname === '/' || parsed.pathname === '') {
        return { url, store, status: 'broken', reason: 'Homepage, not a product page' };
      }
      return { url, store, status: 'suspicious', reason: 'No /p/ product identifier found' };
    }

    // Meesho validation
    if (host.includes('meesho.com')) {
      if (parsed.pathname.length > 5) return { url, store, status: 'valid' };
      return { url, store, status: 'suspicious', reason: 'Short path, may not be a product page' };
    }

    // Generic: must have a meaningful path
    if (parsed.pathname.length > 1) {
      return { url, store, status: 'valid' };
    }
    return { url, store, status: 'suspicious', reason: 'No product path found' };
  } catch {
    return { url, store, status: 'broken', reason: 'Invalid URL' };
  }
}

/**
 * Check if a URL matches a valid product page pattern (not search/homepage).
 */
export function isValidProductUrl(url: string): boolean {
  const result = validateAffiliateUrl(url, '');
  return result.status === 'valid';
}

/**
 * Sanitize and validate affiliate links.
 * - Removes broken links (search URLs, invalid URLs, non-product pages)
 * - Adds affiliate tag to Amazon URLs
 * - Auto-sets link_type based on hostname
 * - Returns only valid/suspicious links (suspicious kept for manual review)
 */
export function sanitizeAndValidateLinks(links: AffLink[]): { sanitized: AffLink[]; removed: number } {
  let removed = 0;

  const sanitized = links
    .filter((link) => {
      const result = validateAffiliateUrl(link.url, link.store);
      if (result.status === 'broken') {
        removed++;
        return false;
      }
      return true;
    })
    .map((link) => {
      const linkType = link.link_type ?? detectLinkType(link.url);
      try {
        const parsed = new URL(link.url);
        const host = parsed.hostname.toLowerCase();
        if (host.includes('amazon.in') || host.includes('amazon.com')) {
          parsed.searchParams.set('tag', AFFILIATE_TAG);
          return { ...link, url: parsed.toString(), is_affiliate: true, link_type: linkType as 'affiliate' | 'brand' };
        }
      } catch {
        // keep as-is
      }
      return { ...link, link_type: linkType as 'affiliate' | 'brand' };
    });

  return { sanitized, removed };
}
