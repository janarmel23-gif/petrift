export const WORLD_SIZE = 12000;
export const TILE = 100;
export const GRID = WORLD_SIZE / TILE;

export const TERRAIN_WALL = 0;
export const TERRAIN_GROUND = 1;
export const TERRAIN_BRUSH = 2;
export const TERRAIN_RIVER = 3;
export const TERRAIN_BASE = 4;

export type Vec = { x: number; y: number };

const n = (x: number, y: number): Vec => ({ x: x * WORLD_SIZE, y: y * WORLD_SIZE });
const mirror = (v: Vec): Vec => ({ x: WORLD_SIZE - v.x, y: WORLD_SIZE - v.y });

export const BLUE_BASE = n(0.078, 0.922);
export const RED_BASE = mirror(BLUE_BASE);
export const BLUE_SPAWN = n(0.085, 0.912);
export const RED_SPAWN = mirror(BLUE_SPAWN);
export const BLUE_SHOP = n(0.12, 0.945);
export const RED_SHOP = mirror(BLUE_SHOP);

export const LANE_TOP: Vec[] = [
  n(0.1, 0.895),
  n(0.072, 0.74),
  n(0.068, 0.52),
  n(0.068, 0.3),
  n(0.082, 0.15),
  n(0.15, 0.078),
  n(0.32, 0.068),
  n(0.55, 0.068),
  n(0.78, 0.072),
  n(0.895, 0.1)
];

export const LANE_MID: Vec[] = [
  n(0.115, 0.885),
  n(0.2, 0.8),
  n(0.3, 0.7),
  n(0.4, 0.6),
  n(0.5, 0.5),
  n(0.6, 0.4),
  n(0.7, 0.3),
  n(0.8, 0.2),
  n(0.885, 0.115)
];

export const LANE_BOT: Vec[] = LANE_TOP.map(mirror).reverse();

export const RIVER_PATH: Vec[] = [n(0.09, 0.09), n(0.28, 0.28), n(0.5, 0.5), n(0.72, 0.72), n(0.91, 0.91)];

export type LaneId = 'top' | 'mid' | 'bot';

export const LANES: Record<LaneId, Vec[]> = { top: LANE_TOP, mid: LANE_MID, bot: LANE_BOT };

export interface StructureSpec {
  id: string;
  kind: 'tower' | 'inhibitor' | 'nexus';
  team: 'blue' | 'red';
  lane: LaneId | 'base';
  tierIndex: number;
  pos: Vec;
}

const blueStructures: Array<Omit<StructureSpec, 'team'>> = [
  { id: 'blue_top_t1', kind: 'tower', lane: 'top', tierIndex: 1, pos: n(0.068, 0.34) },
  { id: 'blue_top_t2', kind: 'tower', lane: 'top', tierIndex: 2, pos: n(0.07, 0.56) },
  { id: 'blue_top_t3', kind: 'tower', lane: 'top', tierIndex: 3, pos: n(0.076, 0.762) },
  { id: 'blue_top_inhib', kind: 'inhibitor', lane: 'top', tierIndex: 4, pos: n(0.078, 0.822) },
  { id: 'blue_mid_t1', kind: 'tower', lane: 'mid', tierIndex: 1, pos: n(0.355, 0.645) },
  { id: 'blue_mid_t2', kind: 'tower', lane: 'mid', tierIndex: 2, pos: n(0.268, 0.732) },
  { id: 'blue_mid_t3', kind: 'tower', lane: 'mid', tierIndex: 3, pos: n(0.185, 0.815) },
  { id: 'blue_mid_inhib', kind: 'inhibitor', lane: 'mid', tierIndex: 4, pos: n(0.145, 0.855) },
  { id: 'blue_bot_t1', kind: 'tower', lane: 'bot', tierIndex: 1, pos: n(0.34, 0.932) },
  { id: 'blue_bot_t2', kind: 'tower', lane: 'bot', tierIndex: 2, pos: n(0.56, 0.93) },
  { id: 'blue_bot_t3', kind: 'tower', lane: 'bot', tierIndex: 3, pos: n(0.238, 0.924) },
  { id: 'blue_bot_inhib', kind: 'inhibitor', lane: 'bot', tierIndex: 4, pos: n(0.178, 0.924) },
  { id: 'blue_nexus_t1', kind: 'tower', lane: 'base', tierIndex: 5, pos: n(0.108, 0.9) },
  { id: 'blue_nexus_t2', kind: 'tower', lane: 'base', tierIndex: 5, pos: n(0.092, 0.876) },
  { id: 'blue_nexus', kind: 'nexus', lane: 'base', tierIndex: 6, pos: BLUE_BASE }
];

const fixedBlue: Array<Omit<StructureSpec, 'team'>> = blueStructures.map((s) =>
  s.id === 'blue_bot_t3'
    ? { ...s, pos: n(0.238, 0.924) }
    : s.id === 'blue_bot_t2'
      ? { ...s, pos: n(0.42, 0.93) }
      : s.id === 'blue_bot_t1'
        ? { ...s, pos: n(0.64, 0.932) }
        : s
);

export const STRUCTURES: StructureSpec[] = [
  ...fixedBlue.map((s) => ({ ...s, team: 'blue' as const })),
  ...fixedBlue.map((s) => ({
    ...s,
    id: s.id.replace('blue', 'red'),
    team: 'red' as const,
    lane: s.lane === 'top' ? ('bot' as LaneId) : s.lane === 'bot' ? ('top' as LaneId) : s.lane,
    pos: mirror(s.pos)
  }))
];

export type CampKind = 'gromp' | 'wolves' | 'raptors' | 'buff_red' | 'buff_blue' | 'krug' | 'scuttle' | 'drake' | 'ancient';

export interface CampSpec {
  id: string;
  kind: CampKind;
  side: 'blue' | 'red' | 'neutral';
  pos: Vec;
  respawn: number;
  count: number;
}

const blueCamps: Array<Omit<CampSpec, 'side'>> = [
  { id: 'blue_gromp', kind: 'gromp', pos: n(0.135, 0.63), respawn: 130, count: 1 },
  { id: 'blue_buff_blue', kind: 'buff_blue', pos: n(0.19, 0.69), respawn: 300, count: 1 },
  { id: 'blue_wolves', kind: 'wolves', pos: n(0.245, 0.75), respawn: 130, count: 3 },
  { id: 'blue_raptors', kind: 'raptors', pos: n(0.4, 0.84), respawn: 130, count: 4 },
  { id: 'blue_buff_red', kind: 'buff_red', pos: n(0.47, 0.79), respawn: 300, count: 1 },
  { id: 'blue_krug', kind: 'krug', pos: n(0.56, 0.855), respawn: 130, count: 2 }
];

export const CAMPS: CampSpec[] = [
  ...blueCamps.map((c) => ({ ...c, side: 'blue' as const })),
  ...blueCamps.map((c) => ({ ...c, id: c.id.replace('blue', 'red'), side: 'red' as const, pos: mirror(c.pos) })),
  { id: 'drake_pit', kind: 'drake', side: 'neutral', pos: n(0.665, 0.665), respawn: 300, count: 1 },
  { id: 'ancient_pit', kind: 'ancient', side: 'neutral', pos: n(0.335, 0.335), respawn: 420, count: 1 },
  { id: 'scuttle_bot', kind: 'scuttle', side: 'neutral', pos: n(0.8, 0.8), respawn: 150, count: 1 },
  { id: 'scuttle_top', kind: 'scuttle', side: 'neutral', pos: n(0.2, 0.2), respawn: 150, count: 1 }
];

export interface BrushSpec {
  x: number;
  y: number;
  w: number;
  h: number;
}

const blueBrush: BrushSpec[] = [
  { x: 0.115, y: 0.44, w: 0.05, h: 0.07 },
  { x: 0.28, y: 0.86, w: 0.08, h: 0.045 },
  { x: 0.155, y: 0.755, w: 0.055, h: 0.05 },
  { x: 0.33, y: 0.7, w: 0.05, h: 0.055 },
  { x: 0.46, y: 0.88, w: 0.06, h: 0.045 },
  { x: 0.52, y: 0.7, w: 0.05, h: 0.05 },
  { x: 0.215, y: 0.575, w: 0.05, h: 0.05 }
];

export const BRUSHES: BrushSpec[] = [
  ...blueBrush,
  ...blueBrush.map((b) => ({ x: 1 - b.x - b.w, y: 1 - b.y - b.h, w: b.w, h: b.h })),
  { x: 0.42, y: 0.52, w: 0.06, h: 0.05 },
  { x: 0.52, y: 0.43, w: 0.06, h: 0.05 }
].map((b) => ({ x: b.x * WORLD_SIZE, y: b.y * WORLD_SIZE, w: b.w * WORLD_SIZE, h: b.h * WORLD_SIZE }));

const junglePaths: Vec[][] = [
  [n(0.1, 0.83), n(0.135, 0.72), n(0.135, 0.63), n(0.16, 0.55), n(0.13, 0.46)],
  [n(0.135, 0.63), n(0.19, 0.69), n(0.245, 0.75), n(0.3, 0.79), n(0.4, 0.84)],
  [n(0.4, 0.84), n(0.47, 0.79), n(0.56, 0.855), n(0.62, 0.9)],
  [n(0.47, 0.79), n(0.53, 0.73), n(0.6, 0.66), n(0.665, 0.665)],
  [n(0.245, 0.75), n(0.3, 0.68), n(0.36, 0.63)],
  [n(0.16, 0.55), n(0.24, 0.5), n(0.31, 0.44), n(0.335, 0.335)],
  [n(0.13, 0.46), n(0.16, 0.36), n(0.2, 0.2)],
  [n(0.2, 0.2), n(0.28, 0.28), n(0.335, 0.335)],
  [n(0.8, 0.8), n(0.72, 0.72), n(0.665, 0.665)],
  [n(0.4, 0.84), n(0.44, 0.9)],
  [n(0.62, 0.9), n(0.68, 0.86), n(0.74, 0.82), n(0.8, 0.8)]
];

export const JUNGLE_PATHS: Vec[][] = [...junglePaths, ...junglePaths.map((p) => p.map(mirror))];

function carveLine(grid: Uint8Array, a: Vec, b: Vec, radius: number, value: number) {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (TILE * 0.5)) + 1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    carveCircle(grid, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, radius, value);
  }
}

function carveCircle(grid: Uint8Array, cx: number, cy: number, radius: number, value: number) {
  const r = Math.ceil(radius / TILE);
  const gx = Math.floor(cx / TILE);
  const gy = Math.floor(cy / TILE);
  for (let y = gy - r; y <= gy + r; y++) {
    if (y < 0 || y >= GRID) continue;
    for (let x = gx - r; x <= gx + r; x++) {
      if (x < 0 || x >= GRID) continue;
      const dx = (x + 0.5) * TILE - cx;
      const dy = (y + 0.5) * TILE - cy;
      if (dx * dx + dy * dy <= radius * radius) grid[y * GRID + x] = value;
    }
  }
}

function carveRect(grid: Uint8Array, x: number, y: number, w: number, h: number, value: number) {
  const x0 = Math.max(0, Math.floor(x / TILE));
  const y0 = Math.max(0, Math.floor(y / TILE));
  const x1 = Math.min(GRID - 1, Math.floor((x + w) / TILE));
  const y1 = Math.min(GRID - 1, Math.floor((y + h) / TILE));
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) grid[gy * GRID + gx] = value;
  }
}

function carvePath(grid: Uint8Array, points: Vec[], radius: number, value: number) {
  for (let i = 0; i < points.length - 1; i++) carveLine(grid, points[i], points[i + 1], radius, value);
}

let cachedTerrain: Uint8Array | null = null;

export function terrain(): Uint8Array {
  if (cachedTerrain) return cachedTerrain;
  const grid = new Uint8Array(GRID * GRID).fill(TERRAIN_WALL);

  carveCircle(grid, BLUE_BASE.x, BLUE_BASE.y, 1450, TERRAIN_BASE);
  carveCircle(grid, RED_BASE.x, RED_BASE.y, 1450, TERRAIN_BASE);

  carvePath(grid, LANE_TOP, 520, TERRAIN_GROUND);
  carvePath(grid, LANE_MID, 500, TERRAIN_GROUND);
  carvePath(grid, LANE_BOT, 520, TERRAIN_GROUND);

  for (const path of JUNGLE_PATHS) carvePath(grid, path, 330, TERRAIN_GROUND);

  for (const camp of CAMPS) {
    const r = camp.kind === 'drake' || camp.kind === 'ancient' ? 640 : 420;
    carveCircle(grid, camp.pos.x, camp.pos.y, r, TERRAIN_GROUND);
  }

  carvePath(grid, RIVER_PATH, 470, TERRAIN_RIVER);

  carveCircle(grid, BLUE_BASE.x, BLUE_BASE.y, 1450, TERRAIN_BASE);
  carveCircle(grid, RED_BASE.x, RED_BASE.y, 1450, TERRAIN_BASE);

  for (const b of BRUSHES) carveRect(grid, b.x, b.y, b.w, b.h, TERRAIN_BRUSH);

  for (let i = 0; i < GRID; i++) {
    grid[i] = TERRAIN_WALL;
    grid[(GRID - 1) * GRID + i] = TERRAIN_WALL;
    grid[i * GRID] = TERRAIN_WALL;
    grid[i * GRID + GRID - 1] = TERRAIN_WALL;
  }

  cachedTerrain = grid;
  return grid;
}

export function tileAt(x: number, y: number): number {
  const grid = terrain();
  const gx = Math.floor(x / TILE);
  const gy = Math.floor(y / TILE);
  if (gx < 0 || gy < 0 || gx >= GRID || gy >= GRID) return TERRAIN_WALL;
  return grid[gy * GRID + gx];
}

export function isWalkable(x: number, y: number): boolean {
  return tileAt(x, y) !== TERRAIN_WALL;
}

export function inBrush(x: number, y: number): boolean {
  return tileAt(x, y) === TERRAIN_BRUSH;
}

export function inRiver(x: number, y: number): boolean {
  return tileAt(x, y) === TERRAIN_RIVER;
}

export function inBase(x: number, y: number, team: 'blue' | 'red'): boolean {
  const base = team === 'blue' ? BLUE_BASE : RED_BASE;
  return Math.hypot(x - base.x, y - base.y) < 1400;
}

export function laneFor(team: 'blue' | 'red', lane: LaneId): Vec[] {
  const path = LANES[lane];
  return team === 'blue' ? path : [...path].reverse();
}

export function clampToWorld(v: Vec): Vec {
  return { x: Math.max(60, Math.min(WORLD_SIZE - 60, v.x)), y: Math.max(60, Math.min(WORLD_SIZE - 60, v.y)) };
}
