/**
 * Generates PWA icon PNGs from SVG sources and placeholder screenshots.
 * Run once: node scripts/generate-pwa-assets.mjs
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// ── Icons from SVG ────────────────────────────────────────────────────────────

const iconSvg = readFileSync(join(publicDir, 'icon.svg'));
const maskableSvg = readFileSync(join(publicDir, 'icon-maskable.svg'));

await sharp(iconSvg).resize(192, 192).png().toFile(join(publicDir, 'icon-192.png'));
console.log('✓ icon-192.png');

await sharp(iconSvg).resize(512, 512).png().toFile(join(publicDir, 'icon-512.png'));
console.log('✓ icon-512.png');

await sharp(maskableSvg).resize(512, 512).png().toFile(join(publicDir, 'icon-maskable-512.png'));
console.log('✓ icon-maskable-512.png');

// ── Screenshots ───────────────────────────────────────────────────────────────
// Branded placeholder screenshots (fulfils manifest requirement for richer install UI)

const PAPER   = { r: 250, g: 249, b: 246, alpha: 1 };
const CHARCOAL = { r: 18, g: 18, b: 18, alpha: 1 };
const ORANGE  = { r: 255, g: 87, b: 51, alpha: 1 };

// Shared header bar SVG overlay
function headerSvg(width) {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="56">
      <rect width="${width}" height="56" fill="#121212"/>
      <text x="20" y="36" font-family="Georgia,serif" font-size="24" font-weight="900" fill="#FAF9F6">BIFL<tspan fill="#FF5733">365</tspan></text>
    </svg>`);
}

// Product card strip SVG (simplified)
function cardsSvg(width, cardW, cols) {
  const gap = 16;
  const cards = [];
  const titles = ['Victorinox SwissChamp', 'Patagonia Better Sweater', 'Leatherman Wave+', 'Stanley Quencher'];
  const prices = ['₹4,299', '₹12,500', '₹7,800', '₹3,600'];
  const scores = [88, 91, 86, 83];

  for (let i = 0; i < cols; i++) {
    const x = gap + i * (cardW + gap);
    const y = 16;
    cards.push(`
      <rect x="${x}" y="${y}" width="${cardW}" height="${cardW * 1.4}" rx="8" fill="white" stroke="#E5E5E0" stroke-width="1"/>
      <rect x="${x}" y="${y}" width="${cardW}" height="${cardW * 0.55}" rx="8" fill="#F0EFE9"/>
      <text x="${x + cardW/2}" y="${y + cardW * 0.3}" font-family="Georgia,serif" font-size="${cardW * 0.13}" fill="#FF5733" text-anchor="middle" font-weight="900">${scores[i]}</text>
      <text x="${x + cardW/2}" y="${y + cardW * 0.38}" font-family="Arial,sans-serif" font-size="${cardW * 0.065}" fill="#555" text-anchor="middle">/100</text>
      <text x="${x + 12}" y="${y + cardW * 0.65}" font-family="Georgia,serif" font-size="${cardW * 0.09}" fill="#121212" font-weight="700">${titles[i] ?? 'BIFL Product'}</text>
      <text x="${x + 12}" y="${y + cardW * 0.78}" font-family="Arial,sans-serif" font-size="${cardW * 0.09}" fill="#FF5733" font-weight="700">${prices[i] ?? '₹0'}</text>
    `);
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${cardW * 1.4 + 32}">${cards.join('')}</svg>`);
}

// Mobile screenshot — 390×844
{
  const W = 390, H = 844;
  const cardW = Math.floor((W - 48) / 2);
  const base = await sharp({ create: { width: W, height: H, channels: 4, background: PAPER } })
    .composite([
      { input: headerSvg(W), top: 0, left: 0 },
      { input: cardsSvg(W, cardW, 2), top: 72, left: 0 },
      { input: cardsSvg(W, cardW, 2), top: 72 + Math.floor(cardW * 1.4) + 48, left: 0 },
    ])
    .png()
    .toFile(join(publicDir, 'screenshot-mobile.png'));
  console.log('✓ screenshot-mobile.png');
}

// Desktop screenshot — 1280×800
{
  const W = 1280, H = 800;
  const cardW = Math.floor((W - 80) / 4);
  const base = await sharp({ create: { width: W, height: H, channels: 4, background: PAPER } })
    .composite([
      { input: headerSvg(W), top: 0, left: 0 },
      { input: cardsSvg(W, cardW, 4), top: 72, left: 0 },
    ])
    .png()
    .toFile(join(publicDir, 'screenshot-desktop.png'));
  console.log('✓ screenshot-desktop.png');
}

// ── favicon.ico (ICO wrapper around embedded 32x32 PNG) ───────────────────────
{
  const png32 = await sharp(iconSvg).resize(32, 32).png().toBuffer();
  // ICO format: 6-byte ICONDIR + 16-byte ICONDIRENTRY + PNG data
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);  // reserved
  header.writeUInt16LE(1, 2);  // type: ICO
  header.writeUInt16LE(1, 4);  // image count

  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0);     // width
  entry.writeUInt8(32, 1);     // height
  entry.writeUInt8(0, 2);      // color count
  entry.writeUInt8(0, 3);      // reserved
  entry.writeUInt16LE(1, 4);   // planes
  entry.writeUInt16LE(32, 6);  // bit count
  entry.writeUInt32LE(png32.length, 8);   // bytes in image
  entry.writeUInt32LE(22, 12); // offset to image data (6 + 16)

  writeFileSync(join(publicDir, 'favicon.ico'), Buffer.concat([header, entry, png32]));
  console.log('✓ favicon.ico');
}

console.log('\nAll PWA assets generated in /public');
