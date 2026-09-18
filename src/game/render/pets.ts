import type { PetArt, PetPalette, SkinDef } from '../data/types';

export interface PetRenderState {
  time: number;
  moving: number;
  attack: number;
  cast: number;
  hurt: number;
  facingLeft: boolean;
  size: number;
  dead: boolean;
  stealth: number;
  tint: string | null;
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, Math.PI * 2);
}

function bodyGradient(ctx: CanvasRenderingContext2D, p: PetPalette, x: number, y: number, r: number): CanvasGradient {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.45, r * 0.1, x, y, r * 1.25);
  g.addColorStop(0, p.fur);
  g.addColorStop(0.62, p.fur);
  g.addColorStop(1, p.furDark);
  return g;
}

function drawTail(ctx: CanvasRenderingContext2D, art: PetArt, p: PetPalette, s: PetRenderState, u: number) {
  const wag = Math.sin(s.time * 6 + 1) * (0.22 + s.moving * 0.25);
  ctx.save();
  ctx.translate(-u * 0.72, -u * 0.18);
  ctx.rotate(wag);
  switch (art.tail) {
    case 'bushy': {
      const g = ctx.createLinearGradient(0, 0, -u * 1.1, -u * 0.6);
      g.addColorStop(0, p.furDark);
      g.addColorStop(0.55, p.fur);
      g.addColorStop(1, p.belly);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, u * 0.12);
      ctx.quadraticCurveTo(-u * 0.95, u * 0.1, -u * 1.02, -u * 0.72);
      ctx.quadraticCurveTo(-u * 0.5, -u * 0.34, 0, -u * 0.28);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'curl':
      ctx.strokeStyle = p.furDark;
      ctx.lineWidth = u * 0.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(-u * 0.18, -u * 0.2, u * 0.26, Math.PI * 0.4, Math.PI * 2.1);
      ctx.stroke();
      break;
    case 'long':
      ctx.strokeStyle = p.furDark;
      ctx.lineWidth = u * 0.15;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-u * 0.7, u * 0.1, -u * 0.86, -u * 0.55);
      ctx.stroke();
      ctx.fillStyle = p.belly;
      ellipse(ctx, -u * 0.88, -u * 0.6, u * 0.1, u * 0.12);
      ctx.fill();
      break;
    case 'fan': {
      ctx.fillStyle = p.accent;
      for (let i = -2; i <= 2; i++) {
        ctx.save();
        ctx.rotate(i * 0.2);
        ellipse(ctx, -u * 0.5, 0, u * 0.52, u * 0.11);
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'plume': {
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((i - 1.5) * 0.24);
        const g = ctx.createLinearGradient(0, 0, -u * 0.9, 0);
        g.addColorStop(0, p.accent);
        g.addColorStop(1, p.glow);
        ctx.fillStyle = g;
        ellipse(ctx, -u * 0.48, 0, u * 0.5, u * 0.08);
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'fin': {
      const g = ctx.createLinearGradient(0, -u * 0.4, -u * 0.8, u * 0.4);
      g.addColorStop(0, p.accent);
      g.addColorStop(1, 'rgba(255,255,255,0.15)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -u * 0.2);
      ctx.quadraticCurveTo(-u * 0.75, -u * 0.62, -u * 0.86, u * 0.05);
      ctx.quadraticCurveTo(-u * 0.6, u * 0.44, 0, u * 0.22);
      ctx.closePath();
      ctx.fill();
      break;
    }
    default:
      ctx.fillStyle = p.furDark;
      ellipse(ctx, -u * 0.1, -u * 0.05, u * 0.17, u * 0.15);
      ctx.fill();
      break;
  }
  ctx.restore();
}

function drawLegs(ctx: CanvasRenderingContext2D, art: PetArt, p: PetPalette, s: PetRenderState, u: number, back: boolean) {
  const swing = Math.sin(s.time * 11) * s.moving * 0.55;
  const swing2 = Math.sin(s.time * 11 + Math.PI) * s.moving * 0.55;
  const len = art.legs === 'short' ? u * 0.34 : art.legs === 'tall' ? u * 0.66 : u * 0.48;
  const w = u * 0.17;
  ctx.fillStyle = back ? p.furDark : p.fur;
  const baseY = u * 0.38;
  const xs = back ? [-u * 0.34, u * 0.2] : [-u * 0.16, u * 0.42];
  const angles = back ? [swing2, swing] : [swing, swing2];
  for (let i = 0; i < 2; i++) {
    ctx.save();
    ctx.translate(xs[i], baseY);
    ctx.rotate(angles[i] * 0.6);
    ctx.beginPath();
    ctx.roundRect(-w / 2, 0, w, len, w * 0.5);
    ctx.fill();
    ctx.fillStyle = p.belly;
    ellipse(ctx, 0, len, w * 0.62, w * 0.42);
    ctx.fill();
    ctx.fillStyle = back ? p.furDark : p.fur;
    ctx.restore();
  }
}

function drawWings(ctx: CanvasRenderingContext2D, p: PetPalette, s: PetRenderState, u: number) {
  const flap = Math.sin(s.time * 9) * (0.3 + s.moving * 0.4);
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(-u * 0.1, -u * 0.22);
    ctx.rotate(dir * (0.5 + flap) * (dir < 0 ? 1 : 0.8));
    const g = ctx.createLinearGradient(0, 0, -u * 0.2, -u * 1.0);
    g.addColorStop(0, p.fur);
    g.addColorStop(1, p.accent);
    ctx.fillStyle = g;
    ctx.globalAlpha = dir < 0 ? 0.75 : 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-u * 0.5, -u * 0.95, u * 0.34, -u * 0.86);
    ctx.quadraticCurveTo(u * 0.3, -u * 0.3, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

function drawEars(ctx: CanvasRenderingContext2D, art: PetArt, p: PetPalette, s: PetRenderState, u: number, hx: number, hy: number, hr: number) {
  const twitch = Math.sin(s.time * 4.2) * 0.1 + s.cast * 0.2;
  const draw = (dir: number) => {
    ctx.save();
    ctx.translate(hx + dir * hr * 0.58, hy - hr * 0.68);
    ctx.rotate(dir * (0.22 + twitch));
    ctx.fillStyle = p.fur;
    switch (art.ears) {
      case 'perk':
        ctx.beginPath();
        ctx.moveTo(-hr * 0.28, hr * 0.28);
        ctx.quadraticCurveTo(0, -hr * 0.92, hr * 0.3, hr * 0.24);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = p.belly;
        ctx.beginPath();
        ctx.moveTo(-hr * 0.13, hr * 0.2);
        ctx.quadraticCurveTo(0, -hr * 0.52, hr * 0.15, hr * 0.18);
        ctx.closePath();
        ctx.fill();
        break;
      case 'flop':
        ctx.beginPath();
        ctx.ellipse(dir * hr * 0.12, hr * 0.42, hr * 0.27, hr * 0.5, dir * 0.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'long':
        ctx.beginPath();
        ctx.ellipse(0, -hr * 0.42, hr * 0.2, hr * 0.86, dir * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.belly;
        ctx.beginPath();
        ctx.ellipse(0, -hr * 0.42, hr * 0.1, hr * 0.62, dir * 0.12, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'round':
        ellipse(ctx, 0, 0, hr * 0.32, hr * 0.32);
        ctx.fill();
        ctx.fillStyle = p.belly;
        ellipse(ctx, 0, 0, hr * 0.17, hr * 0.17);
        ctx.fill();
        break;
      case 'tuft':
        ctx.beginPath();
        ctx.moveTo(-hr * 0.3, hr * 0.3);
        ctx.lineTo(dir * hr * 0.1, -hr * 0.95);
        ctx.lineTo(hr * 0.32, hr * 0.26);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = p.accent;
        ctx.beginPath();
        ctx.moveTo(-hr * 0.12, hr * 0.2);
        ctx.lineTo(dir * hr * 0.06, -hr * 0.6);
        ctx.lineTo(hr * 0.14, hr * 0.18);
        ctx.closePath();
        ctx.fill();
        break;
      case 'feather':
        for (let i = 0; i < 3; i++) {
          ctx.save();
          ctx.rotate((i - 1) * 0.3);
          ctx.fillStyle = i === 1 ? p.accent : p.fur;
          ellipse(ctx, 0, -hr * 0.42, hr * 0.1, hr * 0.5);
          ctx.fill();
          ctx.restore();
        }
        break;
      default:
        break;
    }
    ctx.restore();
  };
  draw(-1);
  draw(1);
}

function drawFace(ctx: CanvasRenderingContext2D, art: PetArt, p: PetPalette, s: PetRenderState, u: number, hx: number, hy: number, hr: number) {
  const blink = Math.sin(s.time * 0.9) > 0.985 ? 0.12 : 1;
  const eyeY = hy - hr * 0.06;
  const eyeR = hr * 0.19;
  const hasBeak = art.features.includes('beak');

  ctx.fillStyle = '#ffffff';
  ellipse(ctx, hx - hr * 0.3, eyeY, eyeR, eyeR * blink);
  ctx.fill();
  ellipse(ctx, hx + hr * 0.36, eyeY, eyeR, eyeR * blink);
  ctx.fill();

  ctx.fillStyle = p.eye;
  ellipse(ctx, hx - hr * 0.26, eyeY, eyeR * 0.56, eyeR * 0.72 * blink);
  ctx.fill();
  ellipse(ctx, hx + hr * 0.4, eyeY, eyeR * 0.56, eyeR * 0.72 * blink);
  ctx.fill();

  ctx.fillStyle = '#10121a';
  ellipse(ctx, hx - hr * 0.24, eyeY, eyeR * 0.3, eyeR * 0.46 * blink);
  ctx.fill();
  ellipse(ctx, hx + hr * 0.42, eyeY, eyeR * 0.3, eyeR * 0.46 * blink);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ellipse(ctx, hx - hr * 0.3, eyeY - eyeR * 0.34, eyeR * 0.16, eyeR * 0.16);
  ctx.fill();
  ellipse(ctx, hx + hr * 0.36, eyeY - eyeR * 0.34, eyeR * 0.16, eyeR * 0.16);
  ctx.fill();

  if (hasBeak) {
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.moveTo(hx + hr * 0.36, hy + hr * 0.18);
    ctx.quadraticCurveTo(hx + hr * 1.08, hy + hr * 0.3, hx + hr * 0.3, hy + hr * 0.62);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = p.belly;
    ellipse(ctx, hx + hr * 0.16, hy + hr * 0.42, hr * 0.42, hr * 0.3);
    ctx.fill();
    ctx.fillStyle = '#2a2028';
    ellipse(ctx, hx + hr * 0.2, hy + hr * 0.3, hr * 0.12, hr * 0.09);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,32,40,0.75)';
    ctx.lineWidth = hr * 0.05;
    ctx.beginPath();
    ctx.moveTo(hx + hr * 0.2, hy + hr * 0.38);
    ctx.lineTo(hx + hr * 0.2, hy + hr * 0.5);
    ctx.moveTo(hx + hr * 0.2, hy + hr * 0.5);
    ctx.quadraticCurveTo(hx + hr * 0.02, hy + hr * 0.62, hx - hr * 0.1, hy + hr * 0.46);
    ctx.moveTo(hx + hr * 0.2, hy + hr * 0.5);
    ctx.quadraticCurveTo(hx + hr * 0.4, hy + hr * 0.64, hx + hr * 0.52, hy + hr * 0.46);
    ctx.stroke();
  }

  if (art.features.includes('whiskers')) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = hr * 0.045;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(hx + hr * 0.42, hy + hr * 0.3 + i * hr * 0.12);
      ctx.lineTo(hx + hr * 1.15, hy + hr * 0.16 + i * hr * 0.3);
      ctx.stroke();
    }
  }

  if (art.features.includes('goggles')) {
    ctx.strokeStyle = 'rgba(30,34,48,0.9)';
    ctx.lineWidth = hr * 0.16;
    ctx.beginPath();
    ctx.moveTo(hx - hr * 0.8, hy - hr * 0.56);
    ctx.lineTo(hx + hr * 0.82, hy - hr * 0.56);
    ctx.stroke();
    ctx.fillStyle = 'rgba(120,220,255,0.55)';
    ellipse(ctx, hx + hr * 0.42, hy - hr * 0.58, hr * 0.26, hr * 0.2);
    ctx.fill();
  }

  if (art.features.includes('gills')) {
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = hr * 0.1;
    ctx.lineCap = 'round';
    for (const dir of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const a = -0.5 + i * 0.42;
        ctx.beginPath();
        ctx.moveTo(hx + dir * hr * 0.75, hy - hr * 0.2 + i * hr * 0.2);
        ctx.lineTo(hx + dir * hr * (1.25 + Math.sin(s.time * 3 + i) * 0.08), hy - hr * 0.45 + i * hr * 0.28);
        ctx.stroke();
      }
    }
  }
}

function drawWeapon(ctx: CanvasRenderingContext2D, art: PetArt, p: PetPalette, s: PetRenderState, u: number, weapon: PetArt['weapon']) {
  if (weapon === 'none') return;
  const swing = s.attack * 1.3 - s.cast * 0.6;
  ctx.save();
  ctx.translate(u * 0.52, u * 0.06);
  ctx.rotate(-0.5 + swing);
  ctx.lineCap = 'round';
  switch (weapon) {
    case 'blade':
      ctx.strokeStyle = '#5a5f70';
      ctx.lineWidth = u * 0.09;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(u * 0.16, u * 0.16);
      ctx.stroke();
      ctx.fillStyle = '#e8eef7';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-u * 0.12, -u * 0.86);
      ctx.lineTo(u * 0.1, -u * 0.8);
      ctx.lineTo(u * 0.12, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = p.accent;
      ctx.fillRect(-u * 0.16, -u * 0.06, u * 0.32, u * 0.08);
      break;
    case 'bow':
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = u * 0.08;
      ctx.beginPath();
      ctx.arc(0, 0, u * 0.56, -Math.PI * 0.72, Math.PI * 0.72);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = u * 0.03;
      ctx.beginPath();
      ctx.moveTo(u * 0.17, -u * 0.53);
      ctx.lineTo(u * 0.17 - s.attack * u * 0.3, 0);
      ctx.lineTo(u * 0.17, u * 0.53);
      ctx.stroke();
      break;
    case 'staff':
    case 'wand': {
      ctx.strokeStyle = '#7a5a3a';
      ctx.lineWidth = u * 0.08;
      ctx.beginPath();
      ctx.moveTo(0, u * 0.35);
      ctx.lineTo(0, -u * 0.85);
      ctx.stroke();
      const glow = ctx.createRadialGradient(0, -u * 0.95, 0, 0, -u * 0.95, u * 0.34);
      glow.addColorStop(0, '#ffffff');
      glow.addColorStop(0.4, p.glow);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ellipse(ctx, 0, -u * 0.95, u * 0.34, u * 0.34);
      ctx.fill();
      break;
    }
    case 'orb': {
      const pulse = 1 + Math.sin(s.time * 3) * 0.08 + s.cast * 0.3;
      const glow = ctx.createRadialGradient(0, -u * 0.35, 0, 0, -u * 0.35, u * 0.42 * pulse);
      glow.addColorStop(0, '#ffffff');
      glow.addColorStop(0.35, p.glow);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ellipse(ctx, 0, -u * 0.35, u * 0.42 * pulse, u * 0.42 * pulse);
      ctx.fill();
      break;
    }
    case 'hammer':
      ctx.strokeStyle = '#7a5a3a';
      ctx.lineWidth = u * 0.1;
      ctx.beginPath();
      ctx.moveTo(0, u * 0.3);
      ctx.lineTo(0, -u * 0.6);
      ctx.stroke();
      ctx.fillStyle = '#9aa2b2';
      ctx.beginPath();
      ctx.roundRect(-u * 0.3, -u * 0.86, u * 0.6, u * 0.34, u * 0.08);
      ctx.fill();
      ctx.fillStyle = p.accent;
      ctx.fillRect(-u * 0.3, -u * 0.74, u * 0.6, u * 0.07);
      break;
    case 'shield':
      ctx.fillStyle = p.accent;
      ctx.beginPath();
      ctx.moveTo(0, -u * 0.55);
      ctx.lineTo(u * 0.4, -u * 0.34);
      ctx.lineTo(u * 0.36, u * 0.3);
      ctx.lineTo(0, u * 0.58);
      ctx.lineTo(-u * 0.36, u * 0.3);
      ctx.lineTo(-u * 0.4, -u * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = u * 0.05;
      ctx.stroke();
      break;
    case 'cannon': {
      ctx.fillStyle = '#4a5162';
      ctx.beginPath();
      ctx.roundRect(-u * 0.1, -u * 0.22, u * 0.86, u * 0.36, u * 0.12);
      ctx.fill();
      ctx.fillStyle = p.accent;
      ctx.beginPath();
      ctx.roundRect(u * 0.6, -u * 0.26, u * 0.2, u * 0.44, u * 0.08);
      ctx.fill();
      if (s.attack > 0.3) {
        const flash = ctx.createRadialGradient(u * 0.9, 0, 0, u * 0.9, 0, u * 0.4);
        flash.addColorStop(0, '#fff8d0');
        flash.addColorStop(1, 'rgba(255,180,60,0)');
        ctx.fillStyle = flash;
        ellipse(ctx, u * 0.9, 0, u * 0.4, u * 0.4);
        ctx.fill();
      }
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

export function drawPet(ctx: CanvasRenderingContext2D, art: PetArt, skin: SkinDef | null, s: PetRenderState) {
  const p = skin?.palette ?? art.palette;
  const weapon = skin?.weapon ?? art.weapon;
  const u = s.size;
  const bob = Math.sin(s.time * 9) * s.moving * u * 0.06 - s.attack * u * 0.05;
  const squash = 1 + Math.sin(s.time * 9) * s.moving * 0.04;

  ctx.save();
  if (s.stealth > 0) ctx.globalAlpha = 0.38;
  if (s.facingLeft) ctx.scale(-1, 1);
  ctx.translate(s.attack * u * 0.14, bob);

  drawTail(ctx, art, p, s, u);
  drawLegs(ctx, art, p, s, u, true);

  if (art.features.includes('wings')) drawWings(ctx, p, s, u);

  const bw = art.body === 'chunky' ? u * 0.82 : art.body === 'long' ? u * 0.86 : art.body === 'shelled' ? u * 0.8 : u * 0.68;
  const bh = (art.body === 'chunky' ? u * 0.66 : art.body === 'slim' ? u * 0.5 : u * 0.58) * squash;

  ctx.fillStyle = bodyGradient(ctx, p, 0, 0, u * 0.8);
  ellipse(ctx, 0, 0, bw, bh, -0.06);
  ctx.fill();

  ctx.fillStyle = p.belly;
  ctx.globalAlpha = 0.85;
  ellipse(ctx, u * 0.1, bh * 0.38, bw * 0.62, bh * 0.44, -0.04);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (art.features.includes('shell')) {
    const g = ctx.createRadialGradient(-u * 0.1, -u * 0.3, u * 0.05, 0, -u * 0.05, u * 0.9);
    g.addColorStop(0, p.accent);
    g.addColorStop(0.5, p.furDark);
    g.addColorStop(1, '#1d2a26');
    ctx.fillStyle = g;
    ellipse(ctx, -u * 0.06, -u * 0.16, bw * 0.92, bh * 0.94, -0.08);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = u * 0.045;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(-u * 0.06, -u * 0.16, bw * (0.24 + i * 0.2), bh * (0.24 + i * 0.2), -0.08, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (art.features.includes('spikes')) {
    ctx.fillStyle = p.furDark;
    for (let i = 0; i < 11; i++) {
      const a = -Math.PI * 0.94 + (i / 10) * Math.PI * 0.92;
      const len = u * (0.28 + Math.sin(i * 1.7) * 0.06 + s.attack * 0.1);
      const sx = Math.cos(a) * bw * 0.86;
      const sy = Math.sin(a) * bh * 0.94;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(a - 0.14) * len, sy + Math.sin(a - 0.14) * len);
      ctx.lineTo(sx + Math.cos(a + 0.14) * len * 0.72, sy + Math.sin(a + 0.14) * len * 0.72);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = p.accent;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI * 0.8 + (i / 4) * Math.PI * 0.62;
      const sx = Math.cos(a) * bw * 0.8;
      const sy = Math.sin(a) * bh * 0.88;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(a) * u * 0.3, sy + Math.sin(a) * u * 0.3);
      ctx.lineTo(sx + Math.cos(a + 0.2) * u * 0.14, sy + Math.sin(a + 0.2) * u * 0.14);
      ctx.closePath();
      ctx.fill();
    }
  }

  if (art.features.includes('mane')) {
    ctx.fillStyle = p.furDark;
    ctx.beginPath();
    ctx.arc(u * 0.3, -u * 0.36, u * 0.56, 0, Math.PI * 2);
    ctx.fill();
  }

  drawLegs(ctx, art, p, s, u, false);

  const hr = art.body === 'chunky' ? u * 0.48 : u * 0.42;
  const hx = u * 0.44;
  const hy = -u * 0.38 - Math.sin(s.time * 9) * s.moving * u * 0.02;

  drawEars(ctx, art, p, s, u, hx, hy, hr);

  ctx.fillStyle = bodyGradient(ctx, p, hx, hy, hr * 1.3);
  ellipse(ctx, hx, hy, hr, hr * 0.94);
  ctx.fill();

  if (art.features.includes('horn')) {
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.moveTo(hx + hr * 0.1, hy - hr * 0.8);
    ctx.lineTo(hx + hr * 0.42, hy - hr * 1.6);
    ctx.lineTo(hx + hr * 0.42, hy - hr * 0.72);
    ctx.closePath();
    ctx.fill();
  }

  drawFace(ctx, art, p, s, u, hx, hy, hr);
  drawWeapon(ctx, art, p, s, u, weapon);

  if (s.hurt > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(255,70,70,${s.hurt * 0.5})`;
    ctx.fillRect(-u * 1.6, -u * 1.8, u * 3.2, u * 3.2);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (s.tint) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = s.tint;
    ctx.fillRect(-u * 1.6, -u * 1.8, u * 3.2, u * 3.2);
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore();
}

export function drawPetPortrait(ctx: CanvasRenderingContext2D, art: PetArt, skin: SkinDef | null, size: number, time: number) {
  ctx.save();
  ctx.translate(size * 0.5, size * 0.62);
  drawPet(ctx, art, skin, {
    time,
    moving: 0,
    attack: 0,
    cast: 0,
    hurt: 0,
    facingLeft: false,
    size: size * 0.32,
    dead: false,
    stealth: 0,
    tint: null
  });
  ctx.restore();
}
