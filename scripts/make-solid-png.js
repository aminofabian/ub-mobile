#!/usr/bin/env node
/**
 * Writes a solid-colour PNG. Used for native splash fields that must match a
 * hex from the JS theme exactly, so the OS splash and the in-app splash cannot
 * disagree by a shade.
 *
 * Usage: node scripts/make-solid-png.js <out.png> <#rrggbb> [size]
 */
const fs = require('fs');
const zlib = require('zlib');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function solidPng(width, height, [r, g, b]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) {
    row[1 + x * 3] = r;
    row[2 + x * 3] = g;
    row[3 + x * 3] = b;
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const [out, hex, size] = process.argv.slice(2);
if (!out || !/^#[0-9a-f]{6}$/i.test(hex || '')) {
  console.error('Usage: node scripts/make-solid-png.js <out.png> <#rrggbb> [size]');
  process.exit(1);
}

const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const dim = Number(size) || 1242;
fs.writeFileSync(out, solidPng(dim, dim, rgb));
console.log(`Wrote ${out} — ${dim}x${dim} ${hex}`);
