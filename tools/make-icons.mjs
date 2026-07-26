#!/usr/bin/env node
/* Generates the PWA icons from the game's crab sprite bitmap.
 * Zero dependencies — encodes PNGs with Node's built-in zlib.
 *
 * Usage: node tools/make-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'icons');

/* Classic crab invader bitmap (same as game.js), 11x8. */
const CRAB = [
  '..X.....X..',
  '...X...X...',
  '..XXXXXXX..',
  '.XX.XXX.XX.',
  'XXXXXXXXXXX',
  'X.XXXXXXX.X',
  'X.X.....X.X',
  '...XX.XX...'
];
const FG = [0x7c, 0xff, 0x6b]; // #7cff6b (crab green)
const BG = [0x00, 0x00, 0x00]; // black

/* ---------- minimal PNG encoder ---------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePNG(pixels, width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  // compression 0, filter 0, interlace 0 (bytes 10-12 already zero)

  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 4);
    raw[row] = 0; // filter: none
    pixels.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- sprite renderer ---------- */

function renderIcon(size, scale) {
  const sw = CRAB[0].length, sh = CRAB.length;
  const cell = Math.max(1, Math.floor((size * scale) / sw));
  const ox = Math.floor((size - sw * cell) / 2);
  const oy = Math.floor((size - sh * cell) / 2);

  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x - ox) / cell);
      const sy = Math.floor((y - oy) / cell);
      const on =
        sx >= 0 && sx < sw && sy >= 0 && sy < sh && CRAB[sy][sx] === 'X';
      const c = on ? FG : BG;
      const i = (y * size + x) * 4;
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 0xff;
    }
  }
  return encodePNG(px, size, size);
}

/* ---------- generate ---------- */

mkdirSync(OUT, { recursive: true });

const icons = [
  // Regular icons: sprite fills ~72% of the canvas.
  ['icon-192.png', 192, 0.72],
  ['icon-512.png', 512, 0.72],
  // Maskable icons: sprite stays inside the central safe zone (~55%).
  ['icon-maskable-192.png', 192, 0.55],
  ['icon-maskable-512.png', 512, 0.55],
  // iOS home-screen icon (180x180).
  ['apple-touch-icon.png', 180, 0.72]
];

for (const [name, size, scale] of icons) {
  const png = renderIcon(size, scale);
  writeFileSync(join(OUT, name), png);
  console.log(`icons/${name}  ${size}x${size}  ${png.length} bytes`);
}
