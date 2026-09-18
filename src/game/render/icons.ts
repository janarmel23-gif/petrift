import { TAU } from '../core/math';

type Glyph = 'bolt' | 'flame' | 'claw' | 'wave' | 'star' | 'shield' | 'drop' | 'arrow' | 'orb' | 'spiral' | 'burst' | 'crescent' | 'spike' | 'ring' | 'wind' | 'paw';

const GLYPH_MAP: Record<string, Glyph> = {
  arc: 'bolt',
  arrow: 'arrow',
  speedlines: 'wind',
  shockwave: 'ring',
  thunder: 'bolt',
  soul: 'crescent',
  slash: 'claw',
  smoke: 'spiral',
  claw: 'claw',
  furyburst: 'burst',
  ironskin: 'shield',
  slam: 'burst',
  bulwark: 'shield',
  charge: 'arrow',
  roar: 'ring',
  clover: 'star',
  carrot: 'drop',
  bloom: 'star',
  burrow: 'spiral',
  moonfall: 'crescent',
  ember: 'flame',
  fireball: 'flame',
  firezone: 'flame',
  firetrail: 'flame',
  inferno: 'burst',
  feather: 'arrow',
  quill: 'spike',
  wind: 'wind',
  updraft: 'wind',
  barrage: 'burst',
  pouch: 'paw',
  hammerarc: 'burst',
  rollball: 'ring',
  quake: 'ring',
  giantball: 'ring',
  shellglint: 'shield',
  wave: 'wave',
  shellcurl: 'shield',
  torrent: 'wave',
  dome: 'ring',
  scent: 'spiral',
  crossslash: 'claw',
  vanish: 'spiral',
  serpent: 'arrow',
  coil: 'spike',
  moonglow: 'crescent',
  moonbeam: 'bolt',
  sonic: 'ring',
  glide: 'wind',
  eclipse: 'crescent',
  barbs: 'spike',
  quillburst: 'burst',
  spikefield: 'spike',
  spikeroll: 'ring',
  quillstorm: 'burst',
  regrow: 'drop',
  bubble: 'orb',
  spring: 'drop',
  current: 'wave',
  deluge: 'wave',
  snore: 'shield',
  headbutt: 'arrow',
  grudge: 'shield',
  chomp: 'claw',
  lastwall: 'shield',
  flash: 'bolt',
  ignite: 'flame',
  heal: 'drop',
  sprint: 'wind',
  barrier: 'shield',
  smite: 'burst',
  cleanse: 'star',
  teleport: 'spiral'
};

function glyphFor(key: string): Glyph {
  if (GLYPH_MAP[key]) return GLYPH_MAP[key];
  const glyphs: Glyph[] = ['bolt', 'flame', 'claw', 'wave', 'star', 'shield', 'drop', 'arrow', 'orb', 'spiral', 'burst', 'crescent', 'spike', 'ring', 'wind', 'paw'];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return glyphs[h % glyphs.length];
}

function shade(color: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return `rgb(${r},${g},${b})`;
}

export function drawIcon(ctx: CanvasRenderingContext2D, size: number, color: string, key: string) {
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);

  const bg = ctx.createRadialGradient(c * 0.7, c * 0.6, size * 0.06, c, c, c);
  bg.addColorStop(0, shade(color, 70));
  bg.addColorStop(0.55, color);
  bg.addColorStop(1, shade(color, -90));
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(1, 1, size - 2, size - 2, size * 0.22);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = Math.max(1, size * 0.035);
  ctx.stroke();

  ctx.save();
  ctx.translate(c, c);
  ctx.fillStyle = 'rgba(12,16,24,0.82)';
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = size * 0.07;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const u = size * 0.3;

  switch (glyphFor(key)) {
    case 'bolt':
      ctx.beginPath();
      ctx.moveTo(u * 0.25, -u * 1.1);
      ctx.lineTo(-u * 0.55, u * 0.12);
      ctx.lineTo(u * 0.05, u * 0.12);
      ctx.lineTo(-u * 0.25, u * 1.1);
      ctx.lineTo(u * 0.62, -u * 0.18);
      ctx.lineTo(u * 0.02, -u * 0.18);
      ctx.closePath();
      ctx.fill();
      break;
    case 'flame':
      ctx.beginPath();
      ctx.moveTo(0, -u * 1.1);
      ctx.quadraticCurveTo(u * 0.9, -u * 0.1, u * 0.35, u * 0.5);
      ctx.quadraticCurveTo(u * 0.5, u * 1, 0, u * 1.05);
      ctx.quadraticCurveTo(-u * 0.5, u * 1, -u * 0.35, u * 0.5);
      ctx.quadraticCurveTo(-u * 0.9, -u * 0.1, 0, -u * 1.1);
      ctx.fill();
      break;
    case 'claw':
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * u * 0.5 - u * 0.2, -u * 1);
        ctx.quadraticCurveTo(i * u * 0.5 + u * 0.3, 0, i * u * 0.5, u * 1);
        ctx.stroke();
      }
      break;
    case 'wave':
      ctx.beginPath();
      for (let i = 0; i <= 2; i++) {
        const y = -u * 0.6 + i * u * 0.6;
        ctx.moveTo(-u, y);
        ctx.quadraticCurveTo(-u * 0.5, y - u * 0.4, 0, y);
        ctx.quadraticCurveTo(u * 0.5, y + u * 0.4, u, y);
      }
      ctx.stroke();
      break;
    case 'star':
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? u * 1.05 : u * 0.42;
        const a = (i / 10) * TAU - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    case 'shield':
      ctx.beginPath();
      ctx.moveTo(0, -u * 1.05);
      ctx.lineTo(u * 0.85, -u * 0.6);
      ctx.lineTo(u * 0.7, u * 0.5);
      ctx.lineTo(0, u * 1.1);
      ctx.lineTo(-u * 0.7, u * 0.5);
      ctx.lineTo(-u * 0.85, -u * 0.6);
      ctx.closePath();
      ctx.fill();
      break;
    case 'drop':
      ctx.beginPath();
      ctx.moveTo(0, -u * 1.1);
      ctx.quadraticCurveTo(u * 0.95, u * 0.2, 0, u * 1.05);
      ctx.quadraticCurveTo(-u * 0.95, u * 0.2, 0, -u * 1.1);
      ctx.fill();
      break;
    case 'arrow':
      ctx.beginPath();
      ctx.moveTo(u * 1.05, 0);
      ctx.lineTo(-u * 0.2, u * 0.7);
      ctx.lineTo(-u * 0.05, 0);
      ctx.lineTo(-u * 0.2, -u * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-u * 1.05, 0);
      ctx.lineTo(-u * 0.2, 0);
      ctx.stroke();
      break;
    case 'orb':
      ctx.beginPath();
      ctx.arc(0, 0, u * 0.85, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, u * 1.08, -0.5, 2.4);
      ctx.stroke();
      break;
    case 'spiral':
      ctx.beginPath();
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * TAU * 2.2;
        const r = u * 0.12 + (i / 60) * u * 0.95;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.stroke();
      break;
    case 'burst':
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * u * 0.3, Math.sin(a) * u * 0.3);
        ctx.lineTo(Math.cos(a) * u * 1.08, Math.sin(a) * u * 1.08);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, u * 0.24, 0, TAU);
      ctx.fill();
      break;
    case 'crescent':
      ctx.beginPath();
      ctx.arc(0, 0, u, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(u * 0.45, -u * 0.25, u * 0.88, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      break;
    case 'spike':
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * u * 0.55, u * 1);
        ctx.lineTo(i * u * 0.55 - u * 0.24, -u * 0.2);
        ctx.lineTo(i * u * 0.55, -u * 1.05);
        ctx.lineTo(i * u * 0.55 + u * 0.24, -u * 0.2);
        ctx.closePath();
        ctx.fill();
      }
      break;
    case 'ring':
      ctx.beginPath();
      ctx.arc(0, 0, u * 0.95, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, u * 0.5, 0, TAU);
      ctx.stroke();
      break;
    case 'wind':
      ctx.beginPath();
      ctx.moveTo(-u, -u * 0.5);
      ctx.lineTo(u * 0.5, -u * 0.5);
      ctx.quadraticCurveTo(u * 1.1, -u * 0.5, u * 0.8, -u * 0.95);
      ctx.moveTo(-u, u * 0.1);
      ctx.lineTo(u * 0.8, u * 0.1);
      ctx.moveTo(-u, u * 0.7);
      ctx.lineTo(u * 0.3, u * 0.7);
      ctx.quadraticCurveTo(u * 0.9, u * 0.7, u * 0.6, u * 1.1);
      ctx.stroke();
      break;
    case 'paw':
    default:
      ctx.beginPath();
      ctx.ellipse(0, u * 0.42, u * 0.62, u * 0.5, 0, 0, TAU);
      ctx.fill();
      for (const [px, py] of [[-0.7, -0.4], [-0.24, -0.72], [0.24, -0.72], [0.7, -0.4]]) {
        ctx.beginPath();
        ctx.ellipse(px * u, py * u, u * 0.24, u * 0.3, 0, 0, TAU);
        ctx.fill();
      }
      break;
  }

  ctx.restore();
}

export function makeIcon(size: number, color: string, key: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  drawIcon(ctx, size, color, key);
  return canvas;
}
