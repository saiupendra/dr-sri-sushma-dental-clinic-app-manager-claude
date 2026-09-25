#!/usr/bin/env node
// Generates simple placeholder PWA icons (a teal rounded square with a white
// medical cross) using only Node's built-in zlib — no image library needed.
// Replace public/icons/*.png with the clinic's real logo before going live;
// re-run `node scripts/generate-placeholder-icons.mjs` any time meanwhile.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/icons");
const TEAL = [13, 115, 108]; // #0d736c
const WHITE = [255, 255, 255];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

/** Rounded-rect background with a centered white cross; alpha 0 outside the rounded corners. */
function pixelAt(x, y, size) {
  const radius = size * 0.22;
  const cx = Math.min(Math.max(x, radius), size - radius);
  const cy = Math.min(Math.max(y, radius), size - radius);
  const dist = Math.hypot(x - cx, y - cy);
  if ((x < radius || x > size - radius) && (y < radius || y > size - radius) && dist > radius) {
    return [0, 0, 0, 0];
  }

  const barW = size * 0.16;
  const barLen = size * 0.5;
  const midX = size / 2;
  const midY = size / 2;
  const inVerticalBar = Math.abs(x - midX) < barW / 2 && Math.abs(y - midY) < barLen / 2;
  const inHorizontalBar = Math.abs(y - midY) < barW / 2 && Math.abs(x - midX) < barLen / 2;
  const [r, g, b] = inVerticalBar || inHorizontalBar ? WHITE : TEAL;
  return [r, g, b, 255];
}

function buildPng(size) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [0]; // filter type: None
    for (let x = 0; x < size; x++) row.push(...pixelAt(x, y, size));
    rows.push(Buffer.from(row));
  }
  const raw = Buffer.concat(rows);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: truecolor + alpha
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [180, 192, 512]) {
  const fileName = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
  writeFileSync(path.join(OUT_DIR, fileName), buildPng(size));
  console.log(`Wrote ${fileName}`);
}
