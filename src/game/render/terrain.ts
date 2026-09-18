import { GRID, TERRAIN_BASE, TERRAIN_BRUSH, TERRAIN_GROUND, TERRAIN_RIVER, TERRAIN_WALL, TILE, WORLD_SIZE, terrain } from '../data/map';

let cache: HTMLCanvasElement | null = null;
let cacheScale = 0;

function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

const PALETTE: Record<number, [string, string]> = {
  [TERRAIN_WALL]: ['#0d1b16', '#06100d'],
  [TERRAIN_GROUND]: ['#2f6b42', '#22543a'],
  [TERRAIN_BRUSH]: ['#1f4a2d', '#16371f'],
  [TERRAIN_RIVER]: ['#1d5a72', '#144457'],
  [TERRAIN_BASE]: ['#3b5a7a', '#2a4460']
};

export function terrainCanvas(quality: 'low' | 'medium' | 'high' | 'ultra'): HTMLCanvasElement {
  const scale = quality === 'ultra' ? 0.4 : quality === 'high' ? 0.32 : quality === 'medium' ? 0.22 : 0.14;
  if (cache && cacheScale === scale) return cache;

  const size = Math.round(WORLD_SIZE * scale);
  const base = document.createElement('canvas');
  base.width = size;
  base.height = size;
  const bctx = base.getContext('2d')!;
  const grid = terrain();
  const cell = TILE * scale;

  bctx.fillStyle = '#060d0b';
  bctx.fillRect(0, 0, size, size);

  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const t = grid[gy * GRID + gx];
      const [a, b] = PALETTE[t] ?? PALETTE[TERRAIN_WALL];
      const n = hash(gx, gy);
      bctx.fillStyle = n > 0.5 ? a : b;
      bctx.fillRect(gx * cell - 0.6, gy * cell - 0.6, cell + 1.2, cell + 1.2);

      if (t === TERRAIN_GROUND && n > 0.86) {
        bctx.fillStyle = 'rgba(120,190,120,0.1)';
        bctx.fillRect(gx * cell, gy * cell, cell, cell);
      }
      if (t === TERRAIN_BASE && n > 0.8) {
        bctx.fillStyle = 'rgba(160,210,255,0.1)';
        bctx.fillRect(gx * cell, gy * cell, cell, cell);
      }
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const blur = Math.max(1, cell * 0.42);
  try {
    ctx.filter = `blur(${blur.toFixed(2)}px)`;
    ctx.drawImage(base, 0, 0);
    ctx.filter = 'none';
  } catch {
    ctx.drawImage(base, 0, 0);
  }

  ctx.globalAlpha = 0.5;
  for (let gy = 1; gy < GRID - 1; gy++) {
    for (let gx = 1; gx < GRID - 1; gx++) {
      if (grid[gy * GRID + gx] !== TERRAIN_WALL) continue;
      const openBelow = grid[(gy + 1) * GRID + gx] !== TERRAIN_WALL;
      const openAbove = grid[(gy - 1) * GRID + gx] !== TERRAIN_WALL;
      const openLeft = grid[gy * GRID + gx - 1] !== TERRAIN_WALL;
      const openRight = grid[gy * GRID + gx + 1] !== TERRAIN_WALL;
      if (openBelow) {
        const g = ctx.createLinearGradient(0, gy * cell, 0, (gy + 1.6) * cell);
        g.addColorStop(0, 'rgba(0,0,0,0.55)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(gx * cell, gy * cell, cell + 1, cell * 1.6);
      }
      if (openAbove) {
        const g = ctx.createLinearGradient(0, gy * cell, 0, gy * cell + cell * 0.6);
        g.addColorStop(0, 'rgba(126,186,146,0.3)');
        g.addColorStop(1, 'rgba(126,186,146,0)');
        ctx.fillStyle = g;
        ctx.fillRect(gx * cell, gy * cell - 1, cell + 1, cell * 0.6);
      }
      if (openLeft) {
        const g = ctx.createLinearGradient(gx * cell, 0, gx * cell + cell * 0.7, 0);
        g.addColorStop(0, 'rgba(0,0,0,0.3)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(gx * cell, gy * cell, cell * 0.7, cell + 1);
      }
      if (openRight) {
        const g = ctx.createLinearGradient(gx * cell + cell, 0, gx * cell + cell * 0.3, 0);
        g.addColorStop(0, 'rgba(0,0,0,0.3)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(gx * cell + cell * 0.3, gy * cell, cell * 0.7 + 1, cell + 1);
      }
    }
  }
  ctx.globalAlpha = 1;

  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const t = grid[gy * GRID + gx];
      if (t !== TERRAIN_BRUSH) continue;
      const n = hash(gx * 3, gy * 7);
      ctx.fillStyle = `rgba(30,${90 + n * 40 | 0},50,0.9)`;
      ctx.beginPath();
      ctx.ellipse((gx + 0.5) * cell, (gy + 0.5) * cell, cell * 0.8, cell * 0.7, n * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  cache = canvas;
  cacheScale = scale;
  return canvas;
}

export function invalidateTerrain() {
  cache = null;
  cacheScale = 0;
}

export function terrainDetail(ctx: CanvasRenderingContext2D, left: number, top: number, width: number, height: number, time: number) {
  const grid = terrain();
  const gx0 = Math.max(0, Math.floor(left / TILE));
  const gy0 = Math.max(0, Math.floor(top / TILE));
  const gx1 = Math.min(GRID - 1, Math.ceil((left + width) / TILE));
  const gy1 = Math.min(GRID - 1, Math.ceil((top + height) / TILE));
  if ((gx1 - gx0) * (gy1 - gy0) > 12000) return;

  ctx.save();
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const t = grid[gy * GRID + gx];
      const n = hash(gx, gy);
      const x = (gx + 0.5) * TILE;
      const y = (gy + 0.5) * TILE;

      if (t === TERRAIN_GROUND && n > 0.72) {
        ctx.strokeStyle = `rgba(150,220,150,${0.1 + n * 0.14})`;
        ctx.lineWidth = 3;
        const sway = Math.sin(time * 1.6 + gx * 0.7 + gy * 0.4) * 6;
        for (let i = 0; i < 3; i++) {
          const ox = x + (i - 1) * 16 + (n - 0.5) * 30;
          ctx.beginPath();
          ctx.moveTo(ox, y + 18);
          ctx.quadraticCurveTo(ox + sway * 0.5, y, ox + sway, y - 22);
          ctx.stroke();
        }
      }

      if (t === TERRAIN_RIVER) {
        const shimmer = 0.05 + Math.sin(time * 1.9 + gx * 0.5 + gy * 0.8) * 0.05;
        ctx.fillStyle = `rgba(190,240,255,${Math.max(0, shimmer)})`;
        ctx.beginPath();
        ctx.ellipse(x, y + Math.sin(time * 2 + gx) * 8, TILE * 0.6, TILE * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (t === TERRAIN_WALL && n > 0.93) {
        ctx.fillStyle = 'rgba(40,62,50,0.9)';
        ctx.beginPath();
        ctx.ellipse(x, y, TILE * 0.36, TILE * 0.28, n * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(90,130,100,0.35)';
        ctx.beginPath();
        ctx.ellipse(x - TILE * 0.1, y - TILE * 0.1, TILE * 0.18, TILE * 0.12, n * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}
