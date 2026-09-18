import { GRID, TERRAIN_WALL, TILE, terrain } from '../data/map';
import type { Point } from './math';

const NEIGHBORS: Array<[number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, 1.4142],
  [1, -1, 1.4142],
  [-1, 1, 1.4142],
  [-1, -1, 1.4142]
];

class BinaryHeap {
  private items: number[] = [];
  private scores: Float64Array;

  constructor(size: number) {
    this.scores = new Float64Array(size);
  }

  setScore(node: number, score: number) {
    this.scores[node] = score;
  }

  push(node: number) {
    this.items.push(node);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.scores[this.items[parent]] <= this.scores[this.items[i]]) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop(): number {
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (l < this.items.length && this.scores[this.items[l]] < this.scores[this.items[smallest]]) smallest = l;
        if (r < this.items.length && this.scores[this.items[r]] < this.scores[this.items[smallest]]) smallest = r;
        if (smallest === i) break;
        [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
        i = smallest;
      }
    }
    return top;
  }

  get size(): number {
    return this.items.length;
  }

  clear() {
    this.items.length = 0;
  }
}

const total = GRID * GRID;
const gScore = new Float64Array(total);
const cameFrom = new Int32Array(total);
const visited = new Uint8Array(total);
const closed = new Uint8Array(total);
const heap = new BinaryHeap(total);

function idx(gx: number, gy: number): number {
  return gy * GRID + gx;
}

function walkableCell(grid: Uint8Array, gx: number, gy: number): boolean {
  if (gx < 0 || gy < 0 || gx >= GRID || gy >= GRID) return false;
  return grid[idx(gx, gy)] !== TERRAIN_WALL;
}

export function nearestWalkable(x: number, y: number): Point {
  const grid = terrain();
  let gx = Math.floor(x / TILE);
  let gy = Math.floor(y / TILE);
  if (walkableCell(grid, gx, gy)) return { x, y };
  for (let r = 1; r < 24; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = gx + dx;
        const ny = gy + dy;
        if (walkableCell(grid, nx, ny)) return { x: (nx + 0.5) * TILE, y: (ny + 0.5) * TILE };
      }
    }
  }
  return { x, y };
}

export function hasLineOfWalk(ax: number, ay: number, bx: number, by: number): boolean {
  const grid = terrain();
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / (TILE * 0.5));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = ax + (bx - ax) * t;
    const py = ay + (by - ay) * t;
    if (!walkableCell(grid, Math.floor(px / TILE), Math.floor(py / TILE))) return false;
  }
  return true;
}

export function findPath(from: Point, to: Point, budget = 6000): Point[] {
  const grid = terrain();
  const start = nearestWalkable(from.x, from.y);
  const goal = nearestWalkable(to.x, to.y);

  if (hasLineOfWalk(start.x, start.y, goal.x, goal.y)) return [goal];

  const sx = Math.floor(start.x / TILE);
  const sy = Math.floor(start.y / TILE);
  const tx = Math.floor(goal.x / TILE);
  const ty = Math.floor(goal.y / TILE);
  const startIdx = idx(sx, sy);
  const goalIdx = idx(tx, ty);
  if (startIdx === goalIdx) return [goal];

  visited.fill(0);
  closed.fill(0);
  heap.clear();

  gScore[startIdx] = 0;
  cameFrom[startIdx] = -1;
  visited[startIdx] = 1;
  heap.setScore(startIdx, heuristic(sx, sy, tx, ty));
  heap.push(startIdx);

  let expanded = 0;
  let found = false;

  while (heap.size > 0 && expanded < budget) {
    const current = heap.pop();
    if (closed[current]) continue;
    closed[current] = 1;
    expanded++;
    if (current === goalIdx) {
      found = true;
      break;
    }
    const cx = current % GRID;
    const cy = (current / GRID) | 0;
    for (const [dx, dy, cost] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!walkableCell(grid, nx, ny)) continue;
      if (dx !== 0 && dy !== 0) {
        if (!walkableCell(grid, cx + dx, cy) || !walkableCell(grid, cx, cy + dy)) continue;
      }
      const ni = idx(nx, ny);
      if (closed[ni]) continue;
      const tentative = gScore[current] + cost;
      if (visited[ni] && tentative >= gScore[ni]) continue;
      visited[ni] = 1;
      gScore[ni] = tentative;
      cameFrom[ni] = current;
      heap.setScore(ni, tentative + heuristic(nx, ny, tx, ty));
      heap.push(ni);
    }
  }

  if (!found) return [];

  const cells: number[] = [];
  let node = goalIdx;
  while (node !== -1) {
    cells.push(node);
    node = cameFrom[node];
  }
  cells.reverse();

  const points: Point[] = cells.map((c) => ({ x: ((c % GRID) + 0.5) * TILE, y: (((c / GRID) | 0) + 0.5) * TILE }));
  points[points.length - 1] = goal;
  return smoothPath(points);
}

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return (dx + dy) + (1.4142 - 2) * Math.min(dx, dy);
}

function smoothPath(points: Point[]): Point[] {
  if (points.length <= 2) return points;
  const out: Point[] = [];
  let anchor = 0;
  for (let i = 2; i < points.length; i++) {
    if (!hasLineOfWalk(points[anchor].x, points[anchor].y, points[i].x, points[i].y)) {
      out.push(points[i - 1]);
      anchor = i - 1;
    }
  }
  out.push(points[points.length - 1]);
  return out;
}
