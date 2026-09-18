import { BLUE_BASE, GRID, LANES, RED_BASE, RIVER_PATH, TERRAIN_BRUSH, TERRAIN_WALL, TILE, WORLD_SIZE, terrain, type Vec } from '../data/map';

const FR = 50;
const FN = WORLD_SIZE / FR;
const TAU = Math.PI * 2;

export interface TerrainFields {
  wall: Float32Array;
  brush: Float32Array;
  lane: Float32Array;
  river: Float32Array;
  broad: Float32Array;
}

let fields: TerrainFields | null = null;

function boxBlur(src: Float32Array, n: number, r: number): Float32Array {
  const tmp = new Float32Array(n * n);
  const out = new Float32Array(n * n);
  const win = r * 2 + 1;
  for (let y = 0; y < n; y++) {
    const row = y * n;
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[row + Math.min(n - 1, Math.max(0, k))];
    for (let x = 0; x < n; x++) {
      tmp[row + x] = acc / win;
      acc += src[row + Math.min(n - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < n; x++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += tmp[Math.min(n - 1, Math.max(0, k)) * n + x];
    for (let y = 0; y < n; y++) {
      out[y * n + x] = acc / win;
      acc += tmp[Math.min(n - 1, y + r + 1) * n + x] - tmp[Math.max(0, y - r) * n + x];
    }
  }
  return out;
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  let t = len === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = ax + dx * t - px;
  const ey = ay + dy * t - py;
  return Math.sqrt(ex * ex + ey * ey);
}

function polyDist(px: number, py: number, pts: Vec[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = segDist(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    if (d < best) best = d;
  }
  return best;
}

export function terrainFields(): TerrainFields {
  if (fields) return fields;
  const grid = terrain();
  const wallRaw = new Float32Array(FN * FN);
  const brushRaw = new Float32Array(FN * FN);
  const lane = new Float32Array(FN * FN);
  const river = new Float32Array(FN * FN);
  const broad = new Float32Array(FN * FN);
  const lanes = [LANES.top, LANES.mid, LANES.bot];

  for (let y = 0; y < FN; y++) {
    const wy = (y + 0.5) * FR;
    const gy = Math.min(GRID - 1, Math.floor(wy / TILE));
    for (let x = 0; x < FN; x++) {
      const wx = (x + 0.5) * FR;
      const gx = Math.min(GRID - 1, Math.floor(wx / TILE));
      const t = grid[gy * GRID + gx];
      const i = y * FN + x;
      wallRaw[i] = t === TERRAIN_WALL ? 1 : 0;
      brushRaw[i] = t === TERRAIN_BRUSH ? 1 : 0;
      let ld = Infinity;
      for (const l of lanes) {
        const d = polyDist(wx, wy, l);
        if (d < ld) ld = d;
      }
      lane[i] = ld;
      river[i] = polyDist(wx, wy, RIVER_PATH);
      broad[i] = fbm(wx * 0.0024, wy * 0.0024);
    }
  }

  fields = {
    wall: boxBlur(boxBlur(wallRaw, FN, 2), FN, 2),
    brush: boxBlur(boxBlur(brushRaw, FN, 1), FN, 1),
    lane,
    river,
    broad
  };
  return fields;
}

export function sampleField(f: Float32Array, x: number, y: number): number {
  const fx = x / FR - 0.5;
  const fy = y / FR - 0.5;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const x0 = ix < 0 ? 0 : ix > FN - 1 ? FN - 1 : ix;
  const x1 = ix + 1 < 0 ? 0 : ix + 1 > FN - 1 ? FN - 1 : ix + 1;
  const y0 = iy < 0 ? 0 : iy > FN - 1 ? FN - 1 : iy;
  const y1 = iy + 1 < 0 ? 0 : iy + 1 > FN - 1 ? FN - 1 : iy + 1;
  const a = f[y0 * FN + x0];
  const b = f[y0 * FN + x1];
  const c = f[y1 * FN + x0];
  const d = f[y1 * FN + x1];
  const top = a + (b - a) * tx;
  return top + (c + (d - c) * tx - top) * ty;
}

export function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number): number {
  return vnoise(x, y) * 0.57 + vnoise(x * 2.07 + 11.1, y * 2.07 + 3.7) * 0.29 + vnoise(x * 4.13 + 5.3, y * 4.13 + 9.9) * 0.14;
}

function smooth(e0: number, e1: number, x: number): number {
  let t = (x - e0) / (e1 - e0);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
}

let F1 = 0;
let F2 = 0;
let CX = 0;
let CY = 0;

function worley(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  F1 = 9;
  F2 = 9;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx;
      const cy = iy + dy;
      const px = cx + 0.15 + hash2(cx, cy) * 0.7 - x;
      const py = cy + 0.15 + hash2(cx + 57, cy + 113) * 0.7 - y;
      const d = Math.sqrt(px * px + py * py);
      if (d < F1) {
        F2 = F1;
        F1 = d;
        CX = cx;
        CY = cy;
      } else if (d < F2) {
        F2 = d;
      }
    }
  }
}

let R = 0;
let G = 0;
let B = 0;

function mix(r: number, g: number, b: number, t: number) {
  if (t <= 0) return;
  if (t > 1) t = 1;
  R += (r - R) * t;
  G += (g - G) * t;
  B += (b - B) * t;
}

function shade(wx: number, wy: number, f: TerrainFields) {
  const w = sampleField(f.wall, wx, wy);
  const n1 = sampleField(f.broad, wx, wy);
  const n2 = vnoise(wx * 0.011 + 17.3, wy * 0.011 + 5.1) * 0.68 + vnoise(wx * 0.023 + 3.1, wy * 0.023 + 8.4) * 0.32;
  const n3 = vnoise(wx * 0.05, wy * 0.05);

  R = 34 + n1 * 44 + (n2 - 0.5) * 20;
  G = 72 + n1 * 52 + (n2 - 0.5) * 24;
  B = 30 + n1 * 18 + (n2 - 0.5) * 10;
  if (n3 > 0.7) {
    const s = (n3 - 0.7) * 55;
    R += s * 0.6;
    G += s;
    B += s * 0.35;
  }
  if (n1 < 0.38) mix(94, 88, 52, (0.38 - n1) * 1.6);

  const forest = smooth(0.1, 0.5, w);
  R *= 1 - forest * 0.34;
  G *= 1 - forest * 0.28;
  B *= 1 - forest * 0.22;

  const castShadow = sampleField(f.wall, wx - 55, wy - 85) - w;
  if (castShadow > 0.04) {
    const s = Math.min(0.45, castShadow * 0.9);
    R *= 1 - s;
    G *= 1 - s;
    B *= 1 - s * 0.8;
  }

  const br = sampleField(f.brush, wx, wy);
  if (br > 0.25) mix(22, 58, 30, smooth(0.25, 0.6, br) * 0.85);

  const ld = sampleField(f.lane, wx, wy);
  const lh = 300 + (n2 - 0.5) * 110;
  if (ld < lh + 70) {
    mix(98 + n3 * 20, 80 + n3 * 16, 56 + n3 * 10, smooth(lh + 70, lh - 10, ld) * 0.95);
    if (ld < lh - 20) {
      worley(wx / 85, wy / 85);
      const keep = hash2(CX, CY);
      if (keep > 0.2) {
        const amount = smooth(lh - 20, lh - 110, ld) * (keep < 0.36 ? 0.5 : 1);
        const tone = 0.78 + hash2(CX + 71, CY + 13) * 0.34;
        const bevel = (F1 < 0.28 ? 0.08 : 0) - (F2 - F1 < 0.16 ? 0.1 : 0);
        mix((114 + n3 * 18) * (tone + bevel), (108 + n3 * 16) * (tone + bevel), (96 + n3 * 12) * (tone + bevel), amount);
        const edge = F2 - F1;
        if (edge < 0.07) mix(44, 40, 34, (1 - edge / 0.07) * amount * 0.9);
      }
    }
  }

  const dbx = wx - BLUE_BASE.x;
  const dby = wy - BLUE_BASE.y;
  const drx = wx - RED_BASE.x;
  const dry = wy - RED_BASE.y;
  const dBlue = Math.sqrt(dbx * dbx + dby * dby);
  const dRed = Math.sqrt(drx * drx + dry * dry);
  const blueSide = dBlue < dRed;
  const db = blueSide ? dBlue : dRed;
  const plaza = 1320 + (n2 - 0.5) * 50;
  if (db < plaza + 40) {
    const t = smooth(plaza + 40, plaza - 10, db);
    const ang = blueSide ? Math.atan2(dby, dbx) : Math.atan2(dry, drx);
    const ringW = 150;
    const ringI = Math.floor(db / ringW);
    const rf = db / ringW - ringI;
    const spokes = 12 + ringI * 6;
    const af = (ang / TAU + 0.5) * spokes + ringI * 0.5;
    const si = Math.floor(af);
    const sf = af - si;
    const tone = 0.8 + hash2(ringI * 31 + 7, si) * 0.3;
    mix((124 + n3 * 16) * tone, (128 + n3 * 16) * tone, (118 + n3 * 12) * tone, t);
    const sw = 7 / Math.max(1, (TAU * Math.max(db, 60)) / spokes);
    if (rf < 0.05 || rf > 0.97 || sf < sw || sf > 1 - sw) mix(58, 60, 56, 0.8 * t);
    if (db > plaza - 80) mix(78, 80, 74, t * 0.85);
    if (db < 380) {
      const glow = smooth(380, 120, db) * 0.18 + (db > 300 && db < 332 ? 0.35 : 0);
      if (blueSide) mix(70, 150, 230, glow);
      else mix(230, 90, 90, glow);
    }
  }

  const rd = sampleField(f.river, wx, wy);
  const rh = 420 + (n2 - 0.5) * 80;
  if (rd < rh + 110 && w < 0.7) {
    mix(92 + n3 * 16, 84 + n3 * 14, 60 + n3 * 10, smooth(rh + 110, rh + 30, rd));
    if (rd < rh) {
      const t = rd / rh;
      const depth = 1 - t * t;
      const edge = smooth(rh, rh - 45, rd);
      const ripple = (n2 - 0.5) * 16 + (n3 - 0.5) * 10;
      mix(40 - depth * 26 + ripple * 0.5, 118 - depth * 66 + ripple, 126 - depth * 52 + ripple, edge);
      if (t > 0.84) {
        const foam = smooth(0.84, 0.97, t) * (0.35 + n3 * 0.5);
        mix(200, 226, 222, foam * edge);
      }
    }
  }

  if (w > 0.3) {
    const wt = 0.5 + (n2 - 0.5) * 0.2;
    const k = smooth(wt - 0.1, wt + 0.02, w);
    if (k > 0) {
      const gx = sampleField(f.wall, wx + 45, wy) - sampleField(f.wall, wx - 45, wy);
      const gy = sampleField(f.wall, wx, wy + 45) - sampleField(f.wall, wx, wy - 45);
      let lit = (gx * 0.6 + gy * 0.8) * 2.4;
      lit = lit < -1 ? -1 : lit > 1 ? 1 : lit;
      const rock = 68 + n3 * 36 + (n2 - 0.5) * 22;
      const l = 1 + lit * 0.55;
      let rr = rock * 1.03 * l;
      let rg = rock * l;
      let rb = rock * 0.86 * l;
      const inner = smooth(wt + 0.06, wt + 0.28, w);
      rr += (15 - rr) * inner;
      rg += (30 - rg) * inner;
      rb += (21 - rb) * inner;
      R += (rr - R) * k;
      G += (rg - G) * k;
      B += (rb - B) * k;
    }
  }
}

export function shadeRows(data: Uint8ClampedArray, width: number, x0: number, y0: number, scale: number, rowStart: number, rowEnd: number) {
  const f = terrainFields();
  const inv = 1 / scale;
  for (let py = rowStart; py < rowEnd; py++) {
    const wy = y0 + (py + 0.5) * inv;
    let i = py * width * 4;
    for (let px = 0; px < width; px++) {
      shade(x0 + (px + 0.5) * inv, wy, f);
      data[i] = R;
      data[i + 1] = G;
      data[i + 2] = B;
      data[i + 3] = 255;
      i += 4;
    }
  }
}

interface Tree {
  x: number;
  y: number;
  r: number;
  h: number;
}

const TREE_PALETTES: Array<[string, string, string]> = [
  ['#5f9a4e', '#2c5e30', '#173a1e'],
  ['#4e8a5c', '#23523a', '#123123'],
  ['#7a9a46', '#3f6228', '#223a16'],
  ['#6aa65a', '#34703a', '#1a4222']
];

export function decorate(ctx: CanvasRenderingContext2D, x0: number, y0: number, size: number, lod: 0 | 1) {
  const f = terrainFields();
  const margin = 280;

  const onGrass = (x: number, y: number) =>
    sampleField(f.wall, x, y) < 0.22 &&
    sampleField(f.brush, x, y) < 0.2 &&
    sampleField(f.lane, x, y) > 430 &&
    sampleField(f.river, x, y) > 560 &&
    Math.hypot(x - BLUE_BASE.x, y - BLUE_BASE.y) > 1420 &&
    Math.hypot(x - RED_BASE.x, y - RED_BASE.y) > 1420;

  if (lod === 0) {
    const TS = 55;
    ctx.lineCap = 'round';
    for (let gy = Math.floor(y0 / TS); gy <= Math.ceil((y0 + size) / TS); gy++) {
      for (let gx = Math.floor(x0 / TS); gx <= Math.ceil((x0 + size) / TS); gx++) {
        if (hash2(gx * 13 + 3, gy * 7 + 1) > 0.3) continue;
        const x = (gx + hash2(gx, gy + 91)) * TS;
        const y = (gy + hash2(gx + 17, gy)) * TS;
        if (sampleField(f.wall, x, y) > 0.3 || sampleField(f.lane, x, y) < 330 || sampleField(f.river, x, y) < 480) continue;
        if (Math.hypot(x - BLUE_BASE.x, y - BLUE_BASE.y) < 1400 || Math.hypot(x - RED_BASE.x, y - RED_BASE.y) < 1400) continue;
        ctx.strokeStyle = hash2(gx, gy) > 0.5 ? 'rgba(150,205,110,0.32)' : 'rgba(18,44,20,0.35)';
        ctx.lineWidth = 3;
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.moveTo(x + k * 6, y + 8);
          ctx.quadraticCurveTo(x + k * 7, y, x + k * 10 + 3, y - 12 - (k === 0 ? 5 : 0));
          ctx.stroke();
        }
      }
    }

    const FS = 70;
    const flowerColors = ['#a67be0', '#f1d36b', '#eef0e0', '#e889b5', '#8fb8ff'];
    for (let gy = Math.floor(y0 / FS); gy <= Math.ceil((y0 + size) / FS); gy++) {
      for (let gx = Math.floor(x0 / FS); gx <= Math.ceil((x0 + size) / FS); gx++) {
        if (hash2(gx * 5 + 2, gy * 3 + 8) > 0.075) continue;
        const x = (gx + hash2(gx + 3, gy)) * FS;
        const y = (gy + hash2(gx, gy + 3)) * FS;
        if (!onGrass(x, y)) continue;
        ctx.fillStyle = flowerColors[Math.floor(hash2(gx + 9, gy + 9) * flowerColors.length)];
        const count = 4 + Math.floor(hash2(gx + 1, gy + 2) * 4);
        for (let k = 0; k < count; k++) {
          const a = hash2(gx * 7 + k, gy) * TAU;
          const d = hash2(gx, gy * 7 + k) * 20;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 4.5, 0, TAU);
          ctx.fill();
        }
      }
    }

    const LS = 180;
    for (let gy = Math.floor(y0 / LS); gy <= Math.ceil((y0 + size) / LS); gy++) {
      for (let gx = Math.floor(x0 / LS); gx <= Math.ceil((x0 + size) / LS); gx++) {
        if (hash2(gx + 40, gy + 41) > 0.22) continue;
        const x = (gx + hash2(gx + 44, gy)) * LS;
        const y = (gy + hash2(gx, gy + 44)) * LS;
        if (sampleField(f.river, x, y) > 300 || sampleField(f.wall, x, y) > 0.4) continue;
        const r = 16 + hash2(gx, gy + 5) * 16;
        const rot = hash2(gx + 5, gy) * TAU;
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.ellipse(x + 4, y + 5, r, r * 0.8, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#4f8c4a';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, r, rot + 0.35, rot + TAU - 0.05);
        ctx.closePath();
        ctx.fill();
        if (hash2(gx + 8, gy + 8) > 0.6) {
          ctx.fillStyle = '#f2b8d6';
          ctx.beginPath();
          ctx.arc(x + r * 0.2, y - r * 0.2, 5, 0, TAU);
          ctx.fill();
        }
      }
    }

    const BS = 42;
    for (let gy = Math.floor(y0 / BS); gy <= Math.ceil((y0 + size) / BS); gy++) {
      for (let gx = Math.floor(x0 / BS); gx <= Math.ceil((x0 + size) / BS); gx++) {
        const x = (gx + hash2(gx + 61, gy)) * BS;
        const y = (gy + hash2(gx, gy + 61)) * BS;
        if (sampleField(f.brush, x, y) < 0.45) continue;
        for (let k = 0; k < 7; k++) {
          const a = -Math.PI / 2 + (k - 3) * 0.28 + (hash2(gx + k, gy) - 0.5) * 0.3;
          const len = 36 + hash2(gx, gy + k) * 26;
          const g = ctx.createLinearGradient(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
          g.addColorStop(0, '#173d1f');
          g.addColorStop(1, '#5fae4c');
          ctx.strokeStyle = g;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + 6, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
          ctx.stroke();
        }
      }
    }

    const RS = 120;
    for (let gy = Math.floor((y0 - 80) / RS); gy <= Math.ceil((y0 + size + 80) / RS); gy++) {
      for (let gx = Math.floor((x0 - 80) / RS); gx <= Math.ceil((x0 + size + 80) / RS); gx++) {
        if (hash2(gx + 90, gy + 90) > 0.42) continue;
        const x = (gx + hash2(gx + 93, gy)) * RS;
        const y = (gy + hash2(gx, gy + 93)) * RS;
        const w = sampleField(f.wall, x, y);
        if (w < 0.36 || w > 0.6) continue;
        const r = 20 + hash2(gx, gy + 7) * 26;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(x + r * 0.3, y + r * 0.45, r * 1.05, r * 0.6, 0, 0, TAU);
        ctx.fill();
        const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.1);
        g.addColorStop(0, '#9c9a8c');
        g.addColorStop(0.6, '#5e5c52');
        g.addColorStop(1, '#34332d');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.78, hash2(gx, gy) * 1.2, 0, TAU);
        ctx.fill();
      }
    }
  }

  const SP = 150;
  const trees: Tree[] = [];
  for (let gy = Math.floor((y0 - margin) / SP); gy <= Math.ceil((y0 + size + margin) / SP); gy++) {
    for (let gx = Math.floor((x0 - margin) / SP); gx <= Math.ceil((x0 + size + margin) / SP); gx++) {
      const tx = (gx + 0.15 + hash2(gx * 3 + 1, gy * 7 + 2) * 0.7) * SP;
      const ty = (gy + 0.15 + hash2(gx * 5 + 9, gy * 11 + 4) * 0.7) * SP;
      const w = sampleField(f.wall, tx, ty);
      if (w < 0.6) continue;
      trees.push({
        x: tx,
        y: ty,
        r: 70 + hash2(gx + 31, gy + 17) * 55 + Math.min(1, (w - 0.6) * 2.5) * 40,
        h: hash2(gx + 5, gy + 77)
      });
    }
  }
  trees.sort((a, b) => a.y - b.y);

  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  for (const t of trees) {
    ctx.beginPath();
    ctx.ellipse(t.x + t.r * 0.35, t.y + t.r * 0.45, t.r * 1.05, t.r * 0.7, 0, 0, TAU);
    ctx.fill();
  }

  for (const t of trees) {
    const pal = TREE_PALETTES[Math.floor(t.h * TREE_PALETTES.length) % TREE_PALETTES.length];
    if (lod === 1) {
      const g = ctx.createRadialGradient(t.x - t.r * 0.3, t.y - t.r * 0.35, t.r * 0.1, t.x, t.y, t.r);
      g.addColorStop(0, pal[0]);
      g.addColorStop(1, pal[2]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r * 0.9, 0, TAU);
      ctx.fill();
      continue;
    }
    const blobs: Array<[number, number, number]> = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU + t.h * 3;
      blobs.push([t.x + Math.cos(a) * t.r * 0.4, t.y + Math.sin(a) * t.r * 0.34, t.r * (0.44 + hash2(k, Math.floor(t.h * 1000)) * 0.12)]);
    }
    blobs.push([t.x, t.y - t.r * 0.08, t.r * 0.6]);
    for (const [bx, by, br] of blobs) {
      const g = ctx.createRadialGradient(bx - br * 0.35, by - br * 0.42, br * 0.08, bx, by, br);
      g.addColorStop(0, pal[0]);
      g.addColorStop(0.55, pal[1]);
      g.addColorStop(1, pal[2]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(210,240,170,0.18)';
    for (let k = 0; k < 6; k++) {
      const a = -2.2 + hash2(k + 3, Math.floor(t.h * 997)) * 1.4;
      const d = t.r * (0.2 + hash2(k, Math.floor(t.h * 991)) * 0.45);
      ctx.beginPath();
      ctx.arc(t.x + Math.cos(a) * d, t.y + Math.sin(a) * d, t.r * 0.09, 0, TAU);
      ctx.fill();
    }
  }
}
