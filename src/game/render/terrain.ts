import { WORLD_SIZE } from '../data/map';
import { decorate, hash2, sampleField, shadeRows, terrainFields } from './terrain-gen';

export type TerrainQuality = 'low' | 'medium' | 'high' | 'ultra';

const CHUNK = 1000;
const CHUNKS = WORLD_SIZE / CHUNK;
const FULL_SIZE = 512;

let fullMap: HTMLCanvasElement | null = null;

export function terrainCanvas(): HTMLCanvasElement {
  if (fullMap) return fullMap;
  const scale = FULL_SIZE / WORLD_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = FULL_SIZE;
  canvas.height = FULL_SIZE;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(FULL_SIZE, FULL_SIZE);
  shadeRows(img.data, FULL_SIZE, 0, 0, scale, 0, FULL_SIZE);
  ctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.scale(scale, scale);
  decorate(ctx, 0, 0, WORLD_SIZE, 1);
  ctx.restore();
  fullMap = canvas;
  return canvas;
}

interface WorkerResult {
  key: number;
  epoch: number;
  size: number;
  buffer: ArrayBuffer;
}

interface SliceJob {
  key: number;
  size: number;
  data: Uint8ClampedArray;
  row: number;
}

function chunkScale(quality: TerrainQuality): number {
  return quality === 'ultra' ? 0.55 : quality === 'high' ? 0.42 : quality === 'medium' ? 0.3 : 0.22;
}

export class TerrainChunks {
  private cache = new Map<number, HTMLCanvasElement>();
  private inflight = new Set<number>();
  private ready: Array<{ key: number; size: number; data: Uint8ClampedArray }> = [];
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: number[] = [];
  private slice: SliceJob | null = null;
  private quality: TerrainQuality = 'high';
  private scale = chunkScale('high');
  private maxCached = 70;
  private epoch = 0;

  constructor() {
    terrainFields();
    const count = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 4) - 1));
    try {
      for (let i = 0; i < count; i++) {
        const worker = new Worker(new URL('./terrain-worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (e: MessageEvent<WorkerResult>) => this.onResult(worker, e.data);
        worker.onerror = () => this.dropWorker(worker);
        this.workers.push(worker);
        this.idle.push(worker);
      }
    } catch {
      this.workers = [];
      this.idle = [];
    }
  }

  configure(quality: TerrainQuality, lowPower: boolean) {
    this.maxCached = lowPower ? 32 : 70;
    if (quality === this.quality) return;
    this.quality = quality;
    this.scale = chunkScale(quality);
    this.cache.clear();
    this.inflight.clear();
    this.ready.length = 0;
    this.slice = null;
    this.epoch++;
  }

  destroy() {
    for (const w of this.workers) w.terminate();
    this.workers = [];
    this.idle = [];
    this.cache.clear();
  }

  private dropWorker(worker: Worker) {
    worker.terminate();
    this.workers = this.workers.filter((w) => w !== worker);
    this.idle = this.idle.filter((w) => w !== worker);
    this.inflight.clear();
  }

  private onResult(worker: Worker, msg: WorkerResult) {
    this.idle.push(worker);
    this.inflight.delete(msg.key);
    if (msg.epoch !== this.epoch) return;
    this.ready.push({ key: msg.key, size: msg.size, data: new Uint8ClampedArray(msg.buffer) });
  }

  private finalize(key: number, size: number, data: Uint8ClampedArray) {
    const cx = key % CHUNKS;
    const cy = Math.floor(key / CHUNKS);
    const x0 = cx * CHUNK;
    const y0 = cy * CHUNK;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(data), size, size), 0, 0);
    ctx.save();
    ctx.scale(size / CHUNK, size / CHUNK);
    ctx.translate(-x0, -y0);
    decorate(ctx, x0, y0, CHUNK, this.quality === 'low' ? 1 : 0);
    ctx.restore();
    this.cache.set(key, canvas);
  }

  update(left: number, top: number, width: number, height: number, budgetMs: number) {
    const start = performance.now();
    const cx0 = Math.max(0, Math.floor(left / CHUNK) - 1);
    const cy0 = Math.max(0, Math.floor(top / CHUNK) - 1);
    const cx1 = Math.min(CHUNKS - 1, Math.floor((left + width) / CHUNK) + 1);
    const cy1 = Math.min(CHUNKS - 1, Math.floor((top + height) / CHUNK) + 1);
    const centerX = left + width / 2;
    const centerY = top + height / 2;

    const wanted: Array<{ key: number; d: number }> = [];
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const key = cy * CHUNKS + cx;
        if (this.cache.has(key) || this.inflight.has(key) || this.slice?.key === key) continue;
        const d = Math.hypot((cx + 0.5) * CHUNK - centerX, (cy + 0.5) * CHUNK - centerY);
        wanted.push({ key, d });
      }
    }
    wanted.sort((a, b) => a.d - b.d);
    this.queue = wanted.map((w) => w.key);

    const size = Math.round(CHUNK * this.scale);
    while (this.idle.length > 0 && this.queue.length > 0) {
      const key = this.queue.shift()!;
      const worker = this.idle.pop()!;
      this.inflight.add(key);
      worker.postMessage({
        key,
        epoch: this.epoch,
        x0: (key % CHUNKS) * CHUNK,
        y0: Math.floor(key / CHUNKS) * CHUNK,
        size,
        scale: this.scale
      });
    }

    let finalized = 0;
    while (this.ready.length > 0 && finalized < 2 && performance.now() - start < budgetMs) {
      const item = this.ready.shift()!;
      this.finalize(item.key, item.size, item.data);
      finalized++;
    }

    if (this.workers.length === 0) {
      if (!this.slice && this.queue.length > 0) {
        const key = this.queue.shift()!;
        this.slice = { key, size, data: new Uint8ClampedArray(size * size * 4), row: 0 };
      }
      const job = this.slice;
      if (job) {
        const x0 = (job.key % CHUNKS) * CHUNK;
        const y0 = Math.floor(job.key / CHUNKS) * CHUNK;
        while (job.row < job.size && performance.now() - start < budgetMs) {
          const end = Math.min(job.size, job.row + 8);
          shadeRows(job.data, job.size, x0, y0, this.scale, job.row, end);
          job.row = end;
        }
        if (job.row >= job.size) {
          this.finalize(job.key, job.size, job.data);
          this.slice = null;
        }
      }
    }

    if (this.cache.size > this.maxCached) {
      for (const key of this.cache.keys()) {
        if (this.cache.size <= this.maxCached) break;
        const cx = key % CHUNKS;
        const cy = Math.floor(key / CHUNKS);
        if (cx >= cx0 && cx <= cx1 && cy >= cy0 && cy <= cy1) continue;
        this.cache.delete(key);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, left: number, top: number, width: number, height: number) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(terrainCanvas(), 0, 0, WORLD_SIZE, WORLD_SIZE);
    const cx0 = Math.max(0, Math.floor(left / CHUNK));
    const cy0 = Math.max(0, Math.floor(top / CHUNK));
    const cx1 = Math.min(CHUNKS - 1, Math.floor((left + width) / CHUNK));
    const cy1 = Math.min(CHUNKS - 1, Math.floor((top + height) / CHUNK));
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const key = cy * CHUNKS + cx;
        const canvas = this.cache.get(key);
        if (!canvas) continue;
        this.cache.delete(key);
        this.cache.set(key, canvas);
        ctx.drawImage(canvas, cx * CHUNK - 1, cy * CHUNK - 1, CHUNK + 2, CHUNK + 2);
      }
    }
  }
}

export function terrainDetail(ctx: CanvasRenderingContext2D, left: number, top: number, width: number, height: number, time: number) {
  const f = terrainFields();
  const S = 80;
  const gx0 = Math.floor(left / S);
  const gy0 = Math.floor(top / S);
  const gx1 = Math.ceil((left + width) / S);
  const gy1 = Math.ceil((top + height) / S);
  if ((gx1 - gx0) * (gy1 - gy0) > 9000) return;
  ctx.save();
  ctx.fillStyle = '#e8fbff';
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const h = hash2(gx * 7 + 3, gy * 13 + 5);
      if (h > 0.45) continue;
      const x = (gx + hash2(gx, gy + 7)) * S;
      const y = (gy + hash2(gx + 7, gy)) * S;
      if (sampleField(f.river, x, y) > 380 || sampleField(f.wall, x, y) > 0.45) continue;
      const a = Math.sin(time * (1.4 + h * 2) + h * 40);
      if (a < 0.35) continue;
      ctx.globalAlpha = (a - 0.35) * 0.45;
      ctx.beginPath();
      ctx.ellipse(x + Math.sin(time * 0.6 + h * 9) * 10, y, 16 + h * 14, 3, 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
