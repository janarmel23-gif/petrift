import { clamp, lerp, type Point } from '../core/math';
import { WORLD_SIZE } from '../data/map';

export class Camera {
  x = WORLD_SIZE / 2;
  y = WORLD_SIZE / 2;
  zoom = 0.55;
  width = 1280;
  height = 720;
  locked = true;
  shakeX = 0;
  shakeY = 0;
  private targetX = this.x;
  private targetY = this.y;

  resize(width: number, height: number, mode: 'desktop' | 'tablet' | 'mobile') {
    this.width = width;
    this.height = height;
    const desired = mode === 'desktop' ? 1750 : mode === 'tablet' ? 1250 : 1000;
    this.zoom = clamp(height / desired, 0.18, 1.6);
  }

  setTarget(p: Point) {
    this.targetX = p.x;
    this.targetY = p.y;
  }

  nudge(dx: number, dy: number) {
    this.targetX = clamp(this.targetX + dx / this.zoom, 0, WORLD_SIZE);
    this.targetY = clamp(this.targetY + dy / this.zoom, 0, WORLD_SIZE);
    this.locked = false;
  }

  jumpTo(p: Point) {
    this.targetX = p.x;
    this.targetY = p.y;
    this.x = p.x;
    this.y = p.y;
  }

  update(dt: number, shake: number) {
    const t = clamp(dt * 11, 0, 1);
    this.x = lerp(this.x, this.targetX, t);
    this.y = lerp(this.y, this.targetY, t);
    const halfW = this.width / (2 * this.zoom);
    const halfH = this.height / (2 * this.zoom);
    this.x = clamp(this.x, Math.min(halfW, WORLD_SIZE / 2), Math.max(WORLD_SIZE - halfW, WORLD_SIZE / 2));
    this.y = clamp(this.y, Math.min(halfH, WORLD_SIZE / 2), Math.max(WORLD_SIZE - halfH, WORLD_SIZE / 2));
    if (shake > 0.05) {
      this.shakeX = (Math.random() - 0.5) * shake;
      this.shakeY = (Math.random() - 0.5) * shake;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  apply(ctx: CanvasRenderingContext2D) {
    ctx.translate(this.width / 2 + this.shakeX, this.height / 2 + this.shakeY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  worldToScreen(x: number, y: number): Point {
    return {
      x: (x - this.x) * this.zoom + this.width / 2 + this.shakeX,
      y: (y - this.y) * this.zoom + this.height / 2 + this.shakeY
    };
  }

  screenToWorld(x: number, y: number): Point {
    return {
      x: (x - this.width / 2 - this.shakeX) / this.zoom + this.x,
      y: (y - this.height / 2 - this.shakeY) / this.zoom + this.y
    };
  }

  get viewLeft(): number {
    return this.x - this.width / (2 * this.zoom);
  }

  get viewTop(): number {
    return this.y - this.height / (2 * this.zoom);
  }

  get viewWidth(): number {
    return this.width / this.zoom;
  }

  get viewHeight(): number {
    return this.height / this.zoom;
  }

  isVisible(x: number, y: number, margin = 200): boolean {
    return (
      x > this.viewLeft - margin &&
      x < this.viewLeft + this.viewWidth + margin &&
      y > this.viewTop - margin &&
      y < this.viewTop + this.viewHeight + margin
    );
  }
}
