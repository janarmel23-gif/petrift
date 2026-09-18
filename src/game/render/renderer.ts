import { angleTo, clamp, dist, TAU, type Point } from '../core/math';
import { BLUE_BASE, RED_BASE, WORLD_SIZE } from '../data/map';
import type { SkillDef } from '../data/types';
import type { Unit } from '../sim/unit';
import type { World } from '../sim/world';
import { Camera } from './camera';
import { drawPet } from './pets';
import { terrainCanvas, terrainDetail } from './terrain';

const TEAM_COLOR: Record<string, string> = {
  blue: '#4fb3ff',
  red: '#ff5f6d',
  neutral: '#c9b06a'
};

export interface TargetingPreview {
  skill: SkillDef;
  point: Point;
  valid: boolean;
}

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  camera = new Camera();
  quality: 'low' | 'medium' | 'high' | 'ultra' = 'high';
  showAllHeroes = true;
  showDamageNumbers = true;
  private fog: HTMLCanvasElement;
  private fogCtx: CanvasRenderingContext2D;
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.fog = document.createElement('canvas');
    this.fogCtx = this.fog.getContext('2d')!;
  }

  resize(width: number, height: number, dpr: number, mode: 'desktop' | 'tablet' | 'mobile') {
    this.dpr = dpr;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.fog.width = Math.floor(width * 0.5);
    this.fog.height = Math.floor(height * 0.5);
    this.camera.resize(width, height, mode);
  }

  render(world: World, targeting: TargetingPreview | null, hoverId: number, dt: number) {
    const ctx = this.ctx;
    const cam = this.camera;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.fillStyle = '#05080e';
    ctx.fillRect(0, 0, cam.width, cam.height);

    ctx.save();
    cam.apply(ctx);

    this.drawTerrain(world);
    this.drawLaneGlow(world);
    this.drawZones(world);
    if (targeting) this.drawTargeting(world, targeting);
    this.drawWards(world);
    this.drawStructures(world);
    this.drawEffectsBelow(world);
    this.drawUnits(world, hoverId);
    this.drawProjectiles(world);
    this.drawEffectsAbove(world);
    this.drawParticles(world);

    ctx.restore();

    this.drawFog(world);

    ctx.save();
    cam.apply(ctx);
    this.drawOverheads(world);
    this.drawFloaters(world);
    ctx.restore();

    ctx.restore();
  }

  private drawTerrain(world: World) {
    const ctx = this.ctx;
    const cam = this.camera;
    const img = terrainCanvas(this.quality);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, WORLD_SIZE, WORLD_SIZE);
    if (this.quality !== 'low') terrainDetail(ctx, cam.viewLeft, cam.viewTop, cam.viewWidth, cam.viewHeight, world.time);
  }

  private drawLaneGlow(world: World) {
    const ctx = this.ctx;
    for (const [base, color] of [
      [BLUE_BASE, '#4fb3ff'],
      [RED_BASE, '#ff5f6d']
    ] as Array<[Point, string]>) {
      if (!this.camera.isVisible(base.x, base.y, 1600)) continue;
      const g = ctx.createRadialGradient(base.x, base.y, 100, base.x, base.y, 1500);
      g.addColorStop(0, `${color}33`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(base.x, base.y, 1500, 0, TAU);
      ctx.fill();
    }
  }

  private drawZones(world: World) {
    const ctx = this.ctx;
    for (const z of world.zones) {
      if (!this.camera.isVisible(z.x, z.y, z.radius)) continue;
      const age = world.time - z.createdAt;
      const life = clamp((z.expiresAt - world.time) / 0.6, 0, 1);
      const r = z.radius * clamp(z.rise, 0.2, 1);
      ctx.save();
      ctx.globalAlpha = 0.5 * life;
      const g = ctx.createRadialGradient(z.x, z.y, r * 0.2, z.x, z.y, r);
      g.addColorStop(0, `${z.color}55`);
      g.addColorStop(0.7, `${z.color}33`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(z.x, z.y, r, 0, TAU);
      ctx.fill();

      ctx.globalAlpha = 0.8 * life;
      ctx.strokeStyle = z.color;
      ctx.lineWidth = 5;
      ctx.setLineDash([26, 18]);
      ctx.lineDashOffset = -age * 40;
      ctx.beginPath();
      ctx.arc(z.x, z.y, r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);

      if (z.vfx === 'firezone' || z.vfx === 'inferno' || z.vfx === 'firetrail') {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + age * 1.4;
          const rr = r * (0.3 + ((i * 37) % 60) / 100);
          const fx = z.x + Math.cos(a) * rr;
          const fy = z.y + Math.sin(a) * rr + Math.sin(age * 6 + i) * 10;
          const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 44);
          fg.addColorStop(0, '#fff0c0');
          fg.addColorStop(0.4, z.color);
          fg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = fg;
          ctx.beginPath();
          ctx.arc(fx, fy, 44, 0, TAU);
          ctx.fill();
        }
      }
      if (z.vfx === 'spring' || z.vfx === 'dome') {
        ctx.globalAlpha = 0.35 * life;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.arc(z.x, z.y, r * (i / 3) * (0.8 + Math.sin(age * 2 + i) * 0.08), 0, TAU);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  private drawWards(world: World) {
    const ctx = this.ctx;
    for (const w of world.wards) {
      if (w.team !== world.playerTeam) continue;
      if (!this.camera.isVisible(w.x, w.y, 100)) continue;
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 10, 22, 10, 0, 0, TAU);
      ctx.fill();
      const pulse = 1 + Math.sin(world.time * 3) * 0.12;
      const g = ctx.createRadialGradient(0, -12, 0, 0, -12, 28 * pulse);
      g.addColorStop(0, '#fff8d0');
      g.addColorStop(0.5, '#ffe680');
      g.addColorStop(1, 'rgba(255,230,128,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, -12, 28 * pulse, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawStructures(world: World) {
    const ctx = this.ctx;
    const list = world.units.filter((u) => u.kind === 'tower' || u.kind === 'inhibitor' || u.kind === 'nexus');
    list.sort((a, b) => a.y - b.y);
    for (const s of list) {
      if (!this.camera.isVisible(s.x, s.y, 300)) continue;
      const color = TEAM_COLOR[s.team];
      ctx.save();
      ctx.translate(s.x, s.y);

      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.beginPath();
      ctx.ellipse(0, s.radius * 0.35, s.radius * 1.15, s.radius * 0.5, 0, 0, TAU);
      ctx.fill();

      if (!s.alive) {
        ctx.fillStyle = 'rgba(40,36,32,0.85)';
        ctx.beginPath();
        ctx.moveTo(-s.radius * 0.8, s.radius * 0.3);
        ctx.lineTo(-s.radius * 0.4, -s.radius * 0.5);
        ctx.lineTo(s.radius * 0.2, -s.radius * 0.1);
        ctx.lineTo(s.radius * 0.7, s.radius * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(80,70,60,0.6)';
        ctx.beginPath();
        ctx.ellipse(0, s.radius * 0.3, s.radius * 0.9, s.radius * 0.32, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
        continue;
      }

      if (s.kind === 'nexus') {
        const pulse = Math.sin(world.time * 2) * 0.1 + 1;
        const g = ctx.createRadialGradient(0, -40, 10, 0, -40, s.radius * 1.6 * pulse);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.3, color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, -40, s.radius * 1.6 * pulse, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#2a3446';
        ctx.beginPath();
        ctx.moveTo(-s.radius * 0.9, s.radius * 0.35);
        ctx.lineTo(s.radius * 0.9, s.radius * 0.35);
        ctx.lineTo(s.radius * 0.6, -s.radius * 0.1);
        ctx.lineTo(-s.radius * 0.6, -s.radius * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, -s.radius * 1.15);
        ctx.lineTo(s.radius * 0.42, -s.radius * 0.2);
        ctx.lineTo(0, s.radius * 0.1);
        ctx.lineTo(-s.radius * 0.42, -s.radius * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.moveTo(0, -s.radius * 1.15);
        ctx.lineTo(s.radius * 0.18, -s.radius * 0.3);
        ctx.lineTo(0, s.radius * 0.1);
        ctx.closePath();
        ctx.fill();
      } else if (s.kind === 'inhibitor') {
        const pulse = Math.sin(world.time * 2.4) * 0.12 + 1;
        ctx.fillStyle = '#242c3a';
        ctx.beginPath();
        ctx.ellipse(0, s.radius * 0.28, s.radius * 0.85, s.radius * 0.36, 0, 0, TAU);
        ctx.fill();
        const g = ctx.createLinearGradient(0, -s.radius, 0, s.radius * 0.4);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.4, color);
        g.addColorStop(1, '#101828');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -s.radius * 1.05 * pulse);
        ctx.lineTo(s.radius * 0.45, 0);
        ctx.lineTo(0, s.radius * 0.35);
        ctx.lineTo(-s.radius * 0.45, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#3a4152';
        ctx.beginPath();
        ctx.moveTo(-s.radius * 0.72, s.radius * 0.4);
        ctx.lineTo(-s.radius * 0.48, -s.radius * 0.85);
        ctx.lineTo(s.radius * 0.48, -s.radius * 0.85);
        ctx.lineTo(s.radius * 0.72, s.radius * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#4c5466';
        ctx.fillRect(-s.radius * 0.62, -s.radius * 1.05, s.radius * 1.24, s.radius * 0.26);
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = i % 2 ? '#39404f' : '#525b6d';
          ctx.fillRect(-s.radius * 0.62 + i * s.radius * 0.31, -s.radius * 1.3, s.radius * 0.2, s.radius * 0.28);
        }
        const charge = clamp(s.passiveState.rampUp ?? 0, 0, 3) / 3;
        const g = ctx.createRadialGradient(0, -s.radius * 0.55, 2, 0, -s.radius * 0.55, s.radius * (0.5 + charge * 0.5));
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.35, color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, -s.radius * 0.55, s.radius * (0.5 + charge * 0.5), 0, TAU);
        ctx.fill();
      }

      ctx.strokeStyle = `${color}66`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, s.radius * 0.36, s.radius * 1.05, s.radius * 0.44, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawUnits(world: World, hoverId: number) {
    const ctx = this.ctx;
    const drawable = world.units.filter(
      (u) => u.alive && (u.kind === 'hero' || u.kind === 'minion' || u.kind === 'monster') && this.camera.isVisible(u.x, u.y, 260) && (world.isVisible(u) || u.team === world.playerTeam)
    );
    drawable.sort((a, b) => a.y - b.y);

    for (const u of drawable) {
      ctx.save();
      ctx.translate(u.x, u.y);

      const color = TEAM_COLOR[u.team];
      const isHero = u.kind === 'hero';
      const scale = isHero ? u.radius * 2.75 * u.scale : u.radius * 1.9;

      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath();
      ctx.ellipse(0, u.radius * 0.5, u.radius * 1.05, u.radius * 0.42, 0, 0, TAU);
      ctx.fill();

      if (isHero) {
        ctx.strokeStyle = u.isPlayer ? '#ffe680' : `${color}aa`;
        ctx.lineWidth = u.isPlayer ? 5 : 3;
        ctx.beginPath();
        ctx.ellipse(0, u.radius * 0.5, u.radius * 1.2, u.radius * 0.5, 0, 0, TAU);
        ctx.stroke();
        if (u.id === hoverId) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(0, u.radius * 0.5, u.radius * 1.45, u.radius * 0.62, 0, 0, TAU);
          ctx.stroke();
        }
      }

      const shield = u.shieldAmount;
      if (shield > 0) {
        const sg = ctx.createRadialGradient(0, -u.radius * 0.3, u.radius * 0.4, 0, -u.radius * 0.3, u.radius * 2);
        sg.addColorStop(0, 'rgba(255,255,255,0)');
        sg.addColorStop(0.7, 'rgba(160,230,255,0.22)');
        sg.addColorStop(1, 'rgba(160,230,255,0.5)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(0, -u.radius * 0.3, u.radius * 2, 0, TAU);
        ctx.fill();
      }

      if (isHero && u.hero) {
        const extras = u.skin?.extras ?? [];
        if (extras.length > 0 && this.quality !== 'low') this.drawSkinAura(ctx, world, u, extras);
        drawPet(ctx, u.hero.art, u.skin, {
          time: u.animTime,
          moving: u.moveTarget || u.dash ? 1 : 0,
          attack: u.attackAnim,
          cast: u.castAnim,
          hurt: u.hurtAnim,
          facingLeft: Math.cos(u.facing) < 0,
          size: scale * 0.42,
          dead: false,
          stealth: u.hidden ? 1 : 0,
          tint: u.has('stun') ? 'rgba(255,220,120,0.25)' : null
        });
      } else if (u.kind === 'minion') {
        this.drawMinion(ctx, u, color, world.time);
      } else {
        this.drawMonster(ctx, u, world.time);
      }

      if (u.has('stun') || u.has('knockup')) {
        ctx.strokeStyle = '#ffe680';
        ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          const a = world.time * 5 + (i / 3) * TAU;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * u.radius * 1.1, -u.radius * 1.9 + Math.sin(a) * 6, 5, 0, TAU);
          ctx.stroke();
        }
      }
      if (u.has('silence')) {
        ctx.strokeStyle = '#c9a8ff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, -u.radius * 2, 12, 0, TAU);
        ctx.moveTo(-9, -u.radius * 2 - 9);
        ctx.lineTo(9, -u.radius * 2 + 9);
        ctx.stroke();
      }
      if (u.has('root')) {
        ctx.strokeStyle = '#8a6a3a';
        ctx.lineWidth = 4;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * u.radius * 0.7, u.radius * 0.5 + Math.sin(a) * u.radius * 0.28);
          ctx.lineTo(Math.cos(a) * u.radius * 1.3, u.radius * 0.2 + Math.sin(a) * u.radius * 0.4);
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }

  private drawSkinAura(ctx: CanvasRenderingContext2D, world: World, u: Unit, extras: string[]) {
    const color = u.skin?.aura ?? '#ffffff';
    const t = world.time;
    ctx.save();
    ctx.globalAlpha = 0.65;
    for (let i = 0; i < 5; i++) {
      const a = t * (extras.includes('void') ? -1.2 : 1.4) + (i / 5) * TAU;
      const r = u.radius * (1.5 + Math.sin(t * 2 + i) * 0.2);
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r * 0.5 - u.radius * 0.4;
      const g = ctx.createRadialGradient(px, py, 0, px, py, 12);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, 12, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawMinion(ctx: CanvasRenderingContext2D, u: Unit, color: string, time: number) {
    const r = u.radius;
    const bob = Math.sin(u.animTime * 10) * r * 0.1;
    const flip = Math.cos(u.facing) < 0 ? -1 : 1;
    ctx.save();
    ctx.scale(flip, 1);
    ctx.translate(0, bob);
    const big = u.name.includes('Super');
    ctx.fillStyle = big ? '#d9c48a' : u.name.includes('Siege') ? '#8f9aa8' : color;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.82, r * 0.72, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.2, -r * 0.24, r * 0.34, r * 0.24, -0.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2a2f3a';
    ctx.beginPath();
    ctx.arc(r * 0.26, -r * 0.14, r * 0.13, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-r * 0.1, -r * 0.14, r * 0.13, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,24,32,0.8)';
    ctx.lineWidth = r * 0.12;
    ctx.lineCap = 'round';
    const swing = Math.sin(u.animTime * 10) * 0.6 + u.attackAnim * 1.2;
    ctx.beginPath();
    ctx.moveTo(r * 0.5, r * 0.1);
    ctx.lineTo(r * 0.5 + Math.cos(-0.6 + swing) * r * 0.6, r * 0.1 + Math.sin(-0.6 + swing) * r * 0.6);
    ctx.stroke();
    ctx.restore();
  }

  private drawMonster(ctx: CanvasRenderingContext2D, u: Unit, time: number) {
    const r = u.radius;
    const big = r > 60;
    const bob = Math.sin(u.animTime * 4) * r * 0.06;
    ctx.save();
    ctx.translate(0, bob);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r * 1.3);
    g.addColorStop(0, big ? '#8f6ad6' : '#7a6b4a');
    g.addColorStop(1, big ? '#3a2260' : '#3a3222');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.95, r * 0.82, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffcf4a';
    ctx.beginPath();
    ctx.arc(r * 0.3, -r * 0.2, r * 0.14, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-r * 0.05, -r * 0.24, r * 0.14, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1a1420';
    ctx.beginPath();
    ctx.arc(r * 0.33, -r * 0.2, r * 0.06, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-r * 0.02, -r * 0.24, r * 0.06, 0, TAU);
    ctx.fill();
    if (big) {
      ctx.fillStyle = '#d0b0ff';
      for (let i = -1; i <= 1; i += 2) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.5, -r * 0.6);
        ctx.lineTo(i * r * 0.72, -r * 1.25);
        ctx.lineTo(i * r * 0.86, -r * 0.5);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawProjectiles(world: World) {
    const ctx = this.ctx;
    for (const p of world.projectiles) {
      if (!this.camera.isVisible(p.x, p.y, 120)) continue;
      const angle = Math.atan2(p.dirY, p.dirX);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);
      const size = p.radius * 0.9 * p.scale;
      switch (p.vfx) {
        case 'basic':
        case 'towerbolt': {
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(0.4, p.color);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(0, 0, size * 1.4, size * 0.7, 0, 0, TAU);
          ctx.fill();
          break;
        }
        case 'arrow':
        case 'quill':
        case 'feather': {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(size * 1.6, 0);
          ctx.lineTo(-size * 0.8, size * 0.4);
          ctx.lineTo(-size * 0.4, 0);
          ctx.lineTo(-size * 0.8, -size * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(-size * 1.6, -size * 0.12, size * 1.4, size * 0.24);
          break;
        }
        case 'fireball':
        case 'ember': {
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.6);
          g.addColorStop(0, '#fff6d0');
          g.addColorStop(0.35, p.color);
          g.addColorStop(1, 'rgba(255,60,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(0, 0, size * 1.6, 0, TAU);
          ctx.fill();
          break;
        }
        case 'bubble': {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(0, 0, size, 0, TAU);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.beginPath();
          ctx.arc(0, 0, size * 0.85, 0, TAU);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ctx.beginPath();
          ctx.arc(-size * 0.35, -size * 0.35, size * 0.18, 0, TAU);
          ctx.fill();
          break;
        }
        case 'moonbeam': {
          const g = ctx.createLinearGradient(-size * 3, 0, size * 2, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(1, p.color);
          ctx.fillStyle = g;
          ctx.fillRect(-size * 3, -size * 0.5, size * 5, size);
          break;
        }
        default: {
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.4);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(0.35, p.color);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(0, 0, size * 1.6, size * 0.9, 0, 0, TAU);
          ctx.fill();
          break;
        }
      }
      ctx.restore();
    }
  }

  private drawEffectsBelow(world: World) {
    const ctx = this.ctx;
    for (const e of world.effects) {
      const t = 1 - e.life / e.maxLife;
      if (!this.camera.isVisible(e.x, e.y, e.radius + 200)) continue;
      switch (e.kind) {
        case 'aoe':
        case 'zonecast': {
          ctx.save();
          ctx.globalAlpha = (1 - t) * 0.8;
          const g = ctx.createRadialGradient(e.x, e.y, e.radius * 0.1, e.x, e.y, e.radius * (0.4 + t * 0.8));
          g.addColorStop(0, `${e.color}cc`);
          g.addColorStop(0.6, `${e.color}55`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.radius * (0.4 + t * 0.8), 0, TAU);
          ctx.fill();
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 6 * (1 - t);
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.radius * (0.4 + t * 0.9), 0, TAU);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'cone': {
          ctx.save();
          ctx.globalAlpha = (1 - t) * 0.72;
          ctx.translate(e.x, e.y);
          ctx.rotate(e.angle);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, e.radius);
          g.addColorStop(0, `${e.color}dd`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, e.radius * (0.55 + t * 0.6), -e.width, e.width);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'linehit': {
          ctx.save();
          ctx.globalAlpha = (1 - t) * 0.8;
          ctx.strokeStyle = e.color;
          ctx.lineWidth = e.width * (1 - t * 0.4);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.x2, e.y2);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'dashline': {
          ctx.save();
          ctx.globalAlpha = (1 - t) * 0.5;
          ctx.strokeStyle = e.color;
          ctx.lineWidth = e.radius * 0.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.x2, e.y2);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'moveflag': {
          ctx.save();
          ctx.globalAlpha = 1 - t;
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.ellipse(e.x, e.y, e.radius * (0.4 + t * 1.3), e.radius * 0.45 * (0.4 + t * 1.3), 0, 0, TAU);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(e.x, e.y - e.radius * 1.6 * (1 - t));
          ctx.lineTo(e.x, e.y);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'levelup':
        case 'skillup': {
          ctx.save();
          ctx.globalAlpha = 1 - t;
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.ellipse(e.x, e.y + 20, e.radius * (0.5 + t), e.radius * 0.4 * (0.5 + t), 0, 0, TAU);
          ctx.stroke();
          ctx.restore();
          break;
        }
        default:
          break;
      }
    }
  }

  private drawEffectsAbove(world: World) {
    const ctx = this.ctx;
    for (const e of world.effects) {
      const t = 1 - e.life / e.maxLife;
      if (!this.camera.isVisible(e.x, e.y, e.radius + 300)) continue;
      switch (e.kind) {
        case 'impact':
        case 'explosion': {
          ctx.save();
          ctx.globalAlpha = 1 - t;
          const r = e.radius * (0.4 + t * 1.2);
          const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(0.35, e.color);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(e.x, e.y, r, 0, TAU);
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'lightning':
        case 'arc':
        case 'bolt': {
          ctx.save();
          ctx.globalAlpha = 1 - t;
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 4;
          ctx.shadowColor = e.color;
          ctx.shadowBlur = 16;
          ctx.beginPath();
          const segs = 6;
          ctx.moveTo(e.x, e.y);
          for (let i = 1; i <= segs; i++) {
            const f = i / segs;
            const jx = (Math.random() - 0.5) * 30 * (1 - f);
            const jy = (Math.random() - 0.5) * 30 * (1 - f);
            ctx.lineTo(e.x + (e.x2 - e.x) * f + jx, e.y + (e.y2 - e.y) * f + jy);
          }
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'healbeam': {
          ctx.save();
          ctx.globalAlpha = (1 - t) * 0.9;
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 8;
          ctx.setLineDash([16, 12]);
          ctx.lineDashOffset = -world.time * 80;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.x2, e.y2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
          break;
        }
        case 'blink': {
          ctx.save();
          ctx.globalAlpha = 1 - t;
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.radius * (0.4 + t), 0, TAU);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(e.x2, e.y2, e.radius * (1.2 - t), 0, TAU);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'shieldburst':
        case 'selfbuff': {
          ctx.save();
          ctx.globalAlpha = 1 - t;
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 6 * (1 - t);
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.radius * (0.4 + t * 1.1), 0, TAU);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'melee_hit': {
          ctx.save();
          ctx.globalAlpha = 1 - t;
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 6;
          const a = angleTo(e.x2, e.y2, e.x, e.y);
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.radius, a - 0.9, a + 0.9);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'herodeath':
        case 'structuredown': {
          ctx.save();
          ctx.globalAlpha = (1 - t) * 0.9;
          const r = e.radius * (0.3 + t * 1.5);
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 10 * (1 - t);
          ctx.beginPath();
          ctx.arc(e.x, e.y, r, 0, TAU);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'stasis': {
          ctx.save();
          ctx.globalAlpha = 0.7;
          const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius);
          g.addColorStop(0, 'rgba(255,240,180,0.1)');
          g.addColorStop(0.8, 'rgba(255,230,128,0.5)');
          g.addColorStop(1, 'rgba(255,230,128,0.1)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.radius, 0, TAU);
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'knockup': {
          ctx.save();
          ctx.globalAlpha = 1 - t;
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.ellipse(e.x, e.y + 16, e.radius * (1 - t * 0.5), e.radius * 0.4, 0, 0, TAU);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'ignite': {
          ctx.save();
          ctx.globalAlpha = 1 - t;
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU + world.time * 3;
            const g = ctx.createRadialGradient(e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30, 0, e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30, 24);
            g.addColorStop(0, '#fff0c0');
            g.addColorStop(1, 'rgba(255,90,20,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30, 24, 0, TAU);
            ctx.fill();
          }
          ctx.restore();
          break;
        }
        default:
          break;
      }
    }
  }

  private drawParticles(world: World) {
    const ctx = this.ctx;
    ctx.save();
    for (const p of world.particles) {
      if (!this.camera.isVisible(p.x, p.y, 60)) continue;
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      if (p.kind === 'shard') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
        ctx.restore();
      } else if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (2 - a) * 4, 0, TAU);
        ctx.stroke();
      } else {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        g.addColorStop(0, p.color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawTargeting(world: World, t: TargetingPreview) {
    const ctx = this.ctx;
    const p = world.player;
    if (!p.alive) return;
    const def = t.skill;
    const color = t.valid ? (p.skin?.spellColor ?? def.color) : '#ff5f6d';

    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.setLineDash([22, 14]);
    if (def.range > 0) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, def.range, def.range * 0.92, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const d = dist(p.x, p.y, t.point.x, t.point.y);
    const angle = angleTo(p.x, p.y, t.point.x, t.point.y);
    const clamped = d > def.range && def.range > 0
      ? { x: p.x + Math.cos(angle) * def.range, y: p.y + Math.sin(angle) * def.range }
      : t.point;

    ctx.globalAlpha = 0.4;
    ctx.fillStyle = color;
    switch (def.shape) {
      case 'circle':
      case 'zone':
        ctx.beginPath();
        ctx.ellipse(def.range <= 0 ? p.x : clamped.x, def.range <= 0 ? p.y : clamped.y, def.radius, def.radius * 0.92, 0, 0, TAU);
        ctx.fill();
        break;
      case 'piercing':
      case 'line':
      case 'projectile': {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.fillRect(0, -def.width * 0.5, def.range, def.width);
        ctx.restore();
        break;
      }
      case 'cone': {
        const half = Math.atan2(def.width, Math.max(1, def.range)) + 0.32;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, def.range, -half, half);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'dash':
      case 'blink': {
        ctx.beginPath();
        ctx.ellipse(clamped.x, clamped.y, Math.max(70, def.radius), Math.max(60, def.radius * 0.9), 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(clamped.x, clamped.y);
        ctx.stroke();
        break;
      }
      case 'aura':
      case 'self':
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, Math.max(def.radius, 120), Math.max(def.radius, 120) * 0.92, 0, 0, TAU);
        ctx.fill();
        break;
      case 'targeted': {
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(clamped.x, clamped.y, 90, 80, 0, 0, TAU);
        ctx.stroke();
        break;
      }
      default:
        break;
    }
    ctx.restore();
  }

  private drawOverheads(world: World) {
    const ctx = this.ctx;
    for (const u of world.units) {
      if (!u.alive) continue;
      if (!this.camera.isVisible(u.x, u.y, 200)) continue;
      if (u.kind === 'ward') continue;
      if (!world.isVisible(u) && u.team !== world.playerTeam) continue;

      const isHero = u.kind === 'hero';
      const isStructure = u.kind === 'tower' || u.kind === 'inhibitor' || u.kind === 'nexus';
      const w = isHero ? 96 : isStructure ? 120 : 52;
      const h = isHero ? 11 : isStructure ? 12 : 7;
      const y = u.y - (isHero ? u.radius * 2.6 : isStructure ? u.radius * 1.5 : u.radius * 1.9);
      const x = u.x - w / 2;
      const ally = u.team === world.playerTeam;
      const color = u.team === 'neutral' ? '#c9b06a' : ally ? '#5ce08a' : '#ff5f6d';

      ctx.fillStyle = 'rgba(8,12,20,0.78)';
      ctx.fillRect(x - 2, y - 2, w + 4, h + 4);

      const pct = u.hpPercent;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w * pct, h);

      const shield = u.shieldAmount;
      if (shield > 0) {
        const sw = Math.min(w, (shield / Math.max(1, u.maxHp)) * w);
        ctx.fillStyle = 'rgba(200,240,255,0.9)';
        ctx.fillRect(x + w * pct, y, Math.min(sw, w - w * pct), h);
      }

      if (isHero || isStructure) {
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1;
        const segments = isHero ? Math.max(1, Math.floor(u.maxHp / 200)) : 8;
        for (let i = 1; i < segments; i++) {
          const sx = x + (w / segments) * i;
          ctx.beginPath();
          ctx.moveTo(sx, y);
          ctx.lineTo(sx, y + h);
          ctx.stroke();
        }
      }

      if (isHero) {
        if (u.maxMp > 0) {
          ctx.fillStyle = 'rgba(8,12,20,0.78)';
          ctx.fillRect(x - 2, y + h + 1, w + 4, 6);
          ctx.fillStyle = '#5b8cff';
          ctx.fillRect(x, y + h + 2, w * u.mpPercent, 4);
        }
        ctx.fillStyle = 'rgba(10,14,22,0.9)';
        ctx.beginPath();
        ctx.arc(x - 12, y + h * 0.5, 12, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = ally ? '#5ce08a' : '#ff5f6d';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#ffe9b0';
        ctx.font = 'bold 14px Rajdhani, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(u.level), x - 12, y + h * 0.5 + 1);

        ctx.fillStyle = u.isPlayer ? '#ffe680' : ally ? '#cfe8ff' : '#ffc9cf';
        ctx.font = '600 15px Rajdhani, sans-serif';
        ctx.textBaseline = 'bottom';
        ctx.fillText(u.name, u.x, y - 8);

        if (u.channel) {
          const p = 1 - u.channel.remaining / u.channel.total;
          ctx.fillStyle = 'rgba(8,12,20,0.8)';
          ctx.fillRect(x, y - 34, w, 9);
          ctx.fillStyle = '#7cd8ff';
          ctx.fillRect(x, y - 34, w * p, 9);
          ctx.fillStyle = '#d7ecff';
          ctx.font = '600 12px Rajdhani, sans-serif';
          ctx.fillText(u.channel.label, u.x, y - 36);
        }
      }
    }
  }

  private drawFloaters(world: World) {
    if (!this.showDamageNumbers) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of world.floaters) {
      if (!this.camera.isVisible(f.x, f.y, 100)) continue;
      const a = clamp(f.life / f.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `${f.crit ? 800 : 700} ${f.size}px Rajdhani, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(6,10,18,0.9)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  private drawFog(world: World) {
    if (this.quality === 'low') return;
    const fc = this.fogCtx;
    const cam = this.camera;
    const sw = this.fog.width;
    const sh = this.fog.height;
    fc.setTransform(1, 0, 0, 1, 0, 0);
    fc.clearRect(0, 0, sw, sh);
    fc.fillStyle = 'rgba(3,6,12,0.86)';
    fc.fillRect(0, 0, sw, sh);
    fc.globalCompositeOperation = 'destination-out';

    const scale = 0.5;
    for (const src of world.visionSourcesFor(world.playerTeam)) {
      const s = cam.worldToScreen(src.x, src.y);
      const sx = s.x * scale;
      const sy = s.y * scale;
      const r = src.r * cam.zoom * scale;
      if (sx + r < 0 || sy + r < 0 || sx - r > sw || sy - r > sh) continue;
      const g = fc.createRadialGradient(sx, sy, r * 0.55, sx, sy, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.75, 'rgba(0,0,0,0.75)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      fc.fillStyle = g;
      fc.beginPath();
      fc.arc(sx, sy, r, 0, TAU);
      fc.fill();
    }
    fc.globalCompositeOperation = 'source-over';

    const ctx = this.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.fog, 0, 0, cam.width, cam.height);
    ctx.restore();
  }
}
