import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'product-images';
const MIN_IMAGE_SIZE = 1500; // 1.5KB — filter tracking pixels/placeholders
const MIN_DIMENSION = 200; // pixels
const FETCH_TIMEOUT = 15000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

export interface ImageValidationResult {
  valid: boolean;
  buffer?: Buffer;
  contentType?: string;
  width?: number;
  height?: number;
  size?: number;
  reason?: string;
}

/**
 * Parse image dimensions from buffer header bytes.
 * Supports PNG, JPEG, WebP without external dependencies.
 */
function parseImageDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 30) return null;

  // PNG: bytes 0-7 = signature, 16-19 = width, 20-23 = height (big-endian)
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    if (buf.length >= 24) {
      return {
        width: buf.readUInt32BE(16),
        height: buf.readUInt32BE(20),
      };
    }
  }

  // JPEG: scan for SOF markers (0xFF 0xC0 through 0xFF 0xCF, excluding 0xC4 and 0xCC)
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset < buf.length - 10) {
      if (buf[offset] !== 0xff) { offset++; continue; }
      const marker = buf[offset + 1];
      if (
        marker >= 0xc0 && marker <= 0xcf &&
        marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      ) {
        return {
          height: buf.readUInt16BE(offset + 5),
          width: buf.readUInt16BE(offset + 7),
        };
      }
      const segLen = buf.readUInt16BE(offset + 2);
      offset += 2 + segLen;
    }
  }

  // WebP
  if (buf.length >= 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8 ' && buf.length >= 30) {
      // Lossy WebP: dimensions at bytes 26-29 (little-endian, 14-bit values)
      return {
        width: buf.readUInt16LE(26) & 0x3fff,
        height: buf.readUInt16LE(28) & 0x3fff,
      };
    }
    if (chunk === 'VP8L' && buf.length >= 25) {
      // Lossless WebP: bit-packed at byte 21
      const bits = buf.readUInt32LE(21);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
  }

  return null;
}

/**
 * Download an image and validate it:
 * - Must be a real image (content-type check)
 * - Must be > 5KB (filter tracking pixels)
 * - Must be > 200×200 (filter tiny placeholders)
 */
export async function downloadAndValidateImage(url: string): Promise<ImageValidationResult> {
  try {
    let origin = '';
    try { origin = new URL(url).origin; } catch {}
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'image/avif,image/webp,image/png,image/jpeg,*/*',
        ...(origin ? { 'Referer': origin + '/' } : {}),
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      return { valid: false, reason: `HTTP ${res.status}` };
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      return { valid: false, reason: `Not an image: ${contentType}` };
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    if (buffer.length < MIN_IMAGE_SIZE) {
      return { valid: false, size: buffer.length, reason: `Too small: ${buffer.length} bytes` };
    }

    // SVGs don't have pixel dimensions — accept if size is sufficient
    if (contentType.includes('svg')) {
      return { valid: true, buffer, contentType, size: buffer.length };
    }

    const dims = parseImageDimensions(buffer);
    if (dims && (dims.width < MIN_DIMENSION || dims.height < MIN_DIMENSION)) {
      return {
        valid: false, size: buffer.length, width: dims.width, height: dims.height,
        reason: `Too small: ${dims.width}×${dims.height}`,
      };
    }

    return {
      valid: true, buffer, contentType, size: buffer.length,
      width: dims?.width, height: dims?.height,
    };
  } catch (err: any) {
    return { valid: false, reason: err.message ?? 'Download failed' };
  }
}

/**
 * Upload an image buffer to Supabase Storage and return the public URL.
 */
export async function uploadImageToStorage(
  supabase: SupabaseClient,
  productId: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const ext = EXT_MAP[contentType] ?? 'jpg';
  const fileName = `${productId}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, buffer, { contentType, upsert: false });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Scrape og:image from a URL's HTML.
 */
export async function scrapeOgImage(url: string): Promise<string[]> {
  try {
    let origin = '';
    try { origin = new URL(url).origin; } catch {}
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
        ...(origin ? { 'Referer': origin + '/' } : {}),
      },
      redirect: 'follow',
    });
    if (!res.ok) return [];

    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('text/html')) return [];

    const html = await res.text();
    const images: string[] = [];

    // og:image and og:image:secure_url
    const ogPattern = /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/gi;
    let match;
    while ((match = ogPattern.exec(html)) !== null) {
      if (match[1]) images.push(match[1]);
    }

    // Also try reverse attribute order: content before property
    const ogReverse = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/gi;
    while ((match = ogReverse.exec(html)) !== null) {
      if (match[1]) images.push(match[1]);
    }

    // data-old-hires (Amazon high-res images)
    const hiRes = /data-old-hires=["']([^"']+)["']/gi;
    while ((match = hiRes.exec(html)) !== null) {
      if (match[1]) images.push(match[1]);
    }

    // Amazon media CDN URLs from page — skip tiny thumbnails
    const cdnMatches = html.match(
      /https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9._%-]+\.(?:jpg|png|webp)/g
    ) ?? [];
    for (const cu of cdnMatches) {
      if (!cu.includes('_SS40') && !cu.includes('_SS50') && !cu.includes('_SY36') && !cu.includes('_SX38')) {
        images.push(cu);
      }
    }

    return [...new Set(images)];
  } catch {
    return [];
  }
}

/**
 * Extract high-res images from an Amazon product page.
 * Uses ASIN from URL to fetch the page, then parses image URLs from:
 * - og:image
 * - data-old-hires attributes
 * - colorImages JSON blob
 */
export async function extractAmazonImages(amazonUrl: string): Promise<string[]> {
  try {
    // Extract ASIN from URL
    const asinMatch = amazonUrl.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    if (!asinMatch) return [];
    const asin = asinMatch[1];

    // Try both .in and .com — one may return CAPTCHA while other works
    const urlsToTry = [
      `https://www.amazon.in/dp/${asin}`,
      `https://www.amazon.com/dp/${asin}`,
    ];

    for (const url of urlsToTry) {
      try {
        const origin = new URL(url).origin;
        const res = await fetch(url, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': origin + '/',
          },
          redirect: 'follow',
        });
        if (!res.ok) continue;

        const html = await res.text();
        if (html.length < 5000) continue; // CAPTCHA page
        const images: string[] = [];

        // og:image
        const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
          ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        if (ogMatch?.[1]) images.push(ogMatch[1]);

        // data-old-hires attributes (high-res product images)
        const hiresPattern = /data-old-hires=["']([^"']+)["']/gi;
        let m;
        while ((m = hiresPattern.exec(html)) !== null) {
          if (m[1] && m[1].startsWith('http')) images.push(m[1]);
        }

        // Amazon media CDN URLs — skip tiny thumbnails
        const cdnMatches = html.match(
          /https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9._%-]+\.(?:jpg|png|webp)/g
        ) ?? [];
        for (const cu of cdnMatches) {
          if (!cu.includes('_SS40') && !cu.includes('_SS50') && !cu.includes('_SY36') && !cu.includes('_SX38')) {
            images.push(cu);
          }
        }

        // colorImages JSON — Amazon embeds all variant images here
        const colorImgMatch = html.match(/'colorImages'\s*:\s*\{[^}]*'initial'\s*:\s*(\[[\s\S]*?\])\s*\}/);
        if (colorImgMatch?.[1]) {
          try {
            const parsed = JSON.parse(colorImgMatch[1].replace(/'/g, '"'));
            for (const item of parsed) {
              if (item.hiRes) images.push(item.hiRes);
              else if (item.large) images.push(item.large);
            }
          } catch { /* ignore parse errors */ }
        }

        const unique = [...new Set(images.filter(u => u.startsWith('http')))];
        if (unique.length > 0) return unique;
      } catch { continue; }
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * Check if a URL points to Supabase Storage (already stored).
 */
export function isStoredUrl(url: string, supabaseUrl?: string): boolean {
  if (!url) return false;
  if (supabaseUrl && url.startsWith(supabaseUrl)) return true;
  return url.includes('/storage/v1/object/public/product-images/');
}
