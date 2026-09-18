import { TAU, clamp } from '../core/math';
import { WORLD_SIZE } from '../data/map';
import type { World } from '../sim/world';
import type { Camera } from './camera';
import { terrainCanvas } from './terrain';

export function drawMinimap(canvas: HTMLCanvasElement, world: World, camera: Camera, showAllHeroes: boolean, pings: Array<{ x: number; y: number; at: number }>) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = canvas.width;
  const scale = size / WORLD_SIZE;

  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(terrainCanvas(), 0, 0, size, size);

  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#03060c';
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (const src of world.visionSourcesFor(world.playerTeam)) {
    const r = src.r * scale;
    const g = ctx.createRadialGradient(src.x * scale, src.y * scale, r * 0.4, src.x * scale, src.y * scale, r);
    g.addColorStop(0, 'rgba(0,0,0,0.85)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(src.x * scale, src.y * scale, r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  for (const u of world.units) {
    if (!u.alive) continue;
    const x = u.x * scale;
    const y = u.y * scale;
    const ally = u.team === world.playerTeam;
    const color = u.team === 'neutral' ? '#c9b06a' : ally ? '#4fe08a' : '#ff5f6d';

    if (u.kind === 'tower' || u.kind === 'inhibitor' || u.kind === 'nexus') {
      ctx.fillStyle = color;
      const s = u.kind === 'nexus' ? 7 : u.kind === 'inhibitor' ? 5 : 4;
      ctx.beginPath();
      if (u.kind === 'nexus') {
        ctx.moveTo(x, y - s);
        ctx.lineTo(x + s, y);
        ctx.lineTo(x, y + s);
        ctx.lineTo(x - s, y);
        ctx.closePath();
      } else {
        ctx.rect(x - s / 2, y - s / 2, s, s);
      }
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      continue;
    }

    if (u.kind === 'minion') {
      if (!ally && !world.isVisible(u)) continue;
      ctx.fillStyle = ally ? 'rgba(110,235,160,0.85)' : 'rgba(255,120,130,0.85)';
      ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
      continue;
    }

    if (u.kind === 'monster') {
      if (!world.isVisible(u)) continue;
      ctx.fillStyle = '#e0c070';
      ctx.beginPath();
      ctx.arc(x, y, u.radius > 60 ? 4 : 2.4, 0, TAU);
      ctx.fill();
      continue;
    }

    if (u.kind === 'hero') {
      const known = ally || world.isVisible(u) || showAllHeroes;
      if (!known) continue;
      const dim = !ally && !world.isVisible(u);
      ctx.globalAlpha = dim ? 0.45 : 1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, u.isPlayer ? 6 : 5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = u.isPlayer ? '#ffe680' : 'rgba(0,0,0,0.75)';
      ctx.lineWidth = u.isPlayer ? 2.5 : 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  for (const w of world.wards) {
    if (w.team !== world.playerTeam) continue;
    ctx.fillStyle = '#ffe680';
    ctx.beginPath();
    ctx.arc(w.x * scale, w.y * scale, 2.6, 0, TAU);
    ctx.fill();
  }

  for (const p of pings) {
    const age = world.time - p.at;
    if (age > 2.5) continue;
    const r = 6 + (age % 0.8) * 16;
    ctx.strokeStyle = `rgba(255,214,102,${clamp(1 - age / 2.5, 0, 1)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x * scale, p.y * scale, r, 0, TAU);
    ctx.stroke();
  }

  const vx = camera.viewLeft * scale;
  const vy = camera.viewTop * scale;
  const vw = camera.viewWidth * scale;
  const vh = camera.viewHeight * scale;
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(vx, vy, vw, vh);
}
