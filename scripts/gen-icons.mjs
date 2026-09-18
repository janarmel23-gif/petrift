import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'public', 'icons');

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function drawIcon(size, padding) {
  const buf = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const inner = c * (1 - padding);
  const deep = [8, 14, 30];
  const mid = [24, 52, 104];
  const glow = [86, 214, 255];
  const gold = [246, 198, 92];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x - c;
      const dy = y - c;
      const d = Math.hypot(dx, dy) / inner;
      let col = mix(mid, deep, Math.min(1, d * 1.05));
      const ring = Math.abs(d - 0.86);
      if (ring < 0.05) col = mix(col, gold, 1 - ring / 0.05);
      const pawBody = Math.hypot(dx, (dy - inner * 0.14) * 1.18) / (inner * 0.42);
      if (pawBody < 1) col = mix(col, glow, Math.pow(1 - pawBody, 0.45));
      const toes = [
        [-0.44, -0.46, 0.2],
        [-0.16, -0.62, 0.21],
        [0.16, -0.62, 0.21],
        [0.44, -0.46, 0.2]
      ];
      for (const [tx, ty, tr] of toes) {
        const td = Math.hypot(dx - tx * inner, dy - ty * inner) / (inner * tr);
        if (td < 1) col = mix(col, glow, Math.pow(1 - td, 0.45));
      }
      const alpha = d > 1 ? 0 : d > 0.96 ? (1 - d) / 0.04 : 1;
      buf[i] = Math.round(Math.max(0, Math.min(255, col[0])));
      buf[i + 1] = Math.round(Math.max(0, Math.min(255, col[1])));
      buf[i + 2] = Math.round(Math.max(0, Math.min(255, col[2])));
      buf[i + 3] = Math.round(alpha * 255);
    }
  }
  return encodePng(size, size, buf);
}

function drawMaskable(size) {
  const buf = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const inner = c * 0.62;
  const glow = [120, 226, 255];
  const gold = [246, 198, 92];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x - c;
      const dy = y - c;
      const v = Math.min(1, Math.hypot(dx, dy) / c);
      let col = mix([22, 46, 92], [6, 11, 24], v);
      const pawBody = Math.hypot(dx, (dy - inner * 0.14) * 1.18) / (inner * 0.42);
      if (pawBody < 1) col = mix(col, glow, Math.pow(1 - pawBody, 0.45));
      const toes = [
        [-0.44, -0.46, 0.2],
        [-0.16, -0.62, 0.21],
        [0.16, -0.62, 0.21],
        [0.44, -0.46, 0.2]
      ];
      for (const [tx, ty, tr] of toes) {
        const td = Math.hypot(dx - tx * inner, dy - ty * inner) / (inner * tr);
        if (td < 1) col = mix(col, gold, Math.pow(1 - td, 0.5));
      }
      buf[i] = Math.round(col[0]);
      buf[i + 1] = Math.round(col[1]);
      buf[i + 2] = Math.round(col[2]);
      buf[i + 3] = 255;
    }
  }
  return encodePng(size, size, buf);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'icon-192.png'), drawIcon(192, 0.04));
writeFileSync(resolve(outDir, 'icon-512.png'), drawIcon(512, 0.04));
writeFileSync(resolve(outDir, 'apple-touch-icon.png'), drawMaskable(180));
writeFileSync(resolve(outDir, 'maskable-512.png'), drawMaskable(512));
process.stdout.write('icons generated in public/icons\n');
