import { angleTo, clamp, dist, type Point } from './core/math';
import { detectDevice, Input, type DeviceMode } from './core/input';
import { findPath } from './core/pathfinding';
import { ITEM_BY_ID } from './data/items';
import { WORLD_SIZE } from './data/map';
import { Renderer, type TargetingPreview } from './render/renderer';
import { invalidateTerrain } from './render/terrain';
import { Hud } from './ui/hud';
import type { Unit } from './sim/unit';
import { World, type MatchConfig } from './sim/world';
import type { GameSettings, MatchPayload, TeamSide } from '../lib/types';

const FIXED_STEP = 1 / 60;

export interface GameHooks {
  onFinish: (payload: MatchPayload) => void;
  onExit: () => void;
  onRestart: () => void;
  onSettingChange: (settings: GameSettings) => void;
}

export class GameController {
  world: World;
  renderer: Renderer;
  hud: Hud;
  input: Input;
  device: DeviceMode;
  settings: GameSettings;

  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private hudRoot: HTMLElement;
  private hooks: GameHooks;
  private rafId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private running = false;
  private cursor: Point = { x: 0, y: 0 };
  private cursorWorld: Point = { x: 0, y: 0 };
  private targeting: { index: number; kind: 'skill' | 'spell' | 'item' } | null = null;
  private pendingAttackMove = false;
  private hoverId = 0;
  private resultShown = false;
  private resizeObserver: ResizeObserver | null = null;
  private onResize = () => this.resize();

  constructor(container: HTMLElement, config: MatchConfig, settings: GameSettings, hooks: GameHooks) {
    this.container = container;
    this.hooks = hooks;
    this.settings = settings;
    this.device = settings.control_scheme === 'auto' ? detectDevice() : settings.control_scheme === 'mobile' ? 'mobile' : 'desktop';

    container.innerHTML = '<canvas class="game-canvas"></canvas><div class="hud-root"></div>';
    this.canvas = container.querySelector('canvas')!;
    this.hudRoot = container.querySelector('.hud-root')!;

    this.world = new World(config);
    this.renderer = new Renderer(this.canvas);
    this.renderer.quality = settings.graphics_quality;
    this.input = new Input(this.canvas);

    this.hud = new Hud(this.hudRoot, this.world, this.renderer.camera, this.device, settings, {
      onSkill: (index, aim) => this.castSkillFromHud(index, aim),
      onLevelSkill: (index) => this.world.levelSkill(this.world.player, index),
      onSpell: (index, aim) => this.castSpellFromHud(index, aim),
      onItem: (slot, aim) => this.useItemFromHud(slot, aim),
      onRecall: () => this.world.startRecall(this.world.player),
      onBuy: (itemId) => this.buy(itemId),
      onSell: (slot) => this.world.sellItem(this.world.player, slot),
      onSurrender: () => this.world.surrender(),
      onExit: () => this.exit(),
      onRestart: () => {
        this.stop();
        this.hooks.onRestart();
      },
      onMinimap: (point, moveHero) => {
        if (moveHero) this.issueMove(point);
        else {
          this.renderer.camera.jumpTo(point);
          this.renderer.camera.locked = false;
        }
      },
      onPing: (point) => this.world.addEffect('aoe', point.x, point.y, 0, 0, 220, '#ffd24a', 1.2),
      onSetting: (key, value) => {
        (this.settings as unknown as Record<string, unknown>)[key as string] = value;
        if (key === 'graphics_quality') {
          this.renderer.quality = value as GameSettings['graphics_quality'];
          invalidateTerrain();
        }
        if (key === 'camera_locked') this.renderer.camera.locked = Boolean(value);
        this.hooks.onSettingChange(this.settings);
      }
    });

    this.renderer.camera.locked = settings.camera_locked;
    this.renderer.camera.jumpTo({ x: this.world.player.x, y: this.world.player.y });
    this.bindPointer();
    this.bindKeys();
    this.resize();

    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  destroy() {
    this.stop();
    this.input.destroy();
    this.hud.destroy();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    this.resizeObserver?.disconnect();
    this.container.innerHTML = '';
  }

  private resize() {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(320, rect.width || window.innerWidth);
    const height = Math.max(240, rect.height || window.innerHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, this.device === 'mobile' ? 2 : 2.5);
    const mode: DeviceMode = this.device === 'desktop' ? 'desktop' : width >= 1024 ? 'tablet' : 'mobile';
    this.renderer.resize(width, height, dpr, mode);
  }

  private loop = (now: number) => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    const raw = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const frame = clamp(raw, 0, 0.25);

    this.accumulator += frame;
    let steps = 0;
    while (this.accumulator >= FIXED_STEP && steps < 6) {
      this.handleContinuousInput(FIXED_STEP);
      this.world.update(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
      steps++;
    }

    this.updateCamera(frame);
    this.updateHover();
    this.renderer.showAllHeroes = this.settings.show_all_heroes_on_map;
    this.renderer.showDamageNumbers = this.settings.show_damage_numbers;
    this.renderer.render(this.world, this.buildTargetingPreview(), this.hoverId, frame);
    this.hud.update(frame);

    if (this.world.finished && !this.resultShown) {
      this.resultShown = true;
      this.finish();
    }
  };

  private finish() {
    const win = this.world.winner === this.world.playerTeam;
    this.hud.showResult(win);
    const score = this.world.score();
    const payload: MatchPayload = {
      mode: 'rift_5v5',
      bot_difficulty: this.world.difficulty,
      map_id: 'menagerie_rift',
      duration_seconds: Math.round(this.world.time),
      winner: this.world.winner,
      surrendered: this.world.surrendered,
      blue_kills: this.world.kills.blue,
      red_kills: this.world.kills.red,
      account_xp: Math.round(180 + this.world.time / 6 + (win ? 220 : 0)),
      coins_earned: Math.round(120 + this.world.time / 10 + (win ? 180 : 0)),
      players: score.map((s) => ({
        slot: s.slot,
        team: s.team as TeamSide,
        hero_id: s.heroId,
        skin_id: s.skinId,
        display_name: s.name,
        is_bot: s.isBot,
        bot_difficulty: s.botDifficulty,
        kills: s.kills,
        deaths: s.deaths,
        assists: s.assists,
        creep_score: s.cs,
        gold_earned: s.goldEarned,
        hero_level: s.level,
        damage_dealt: s.damageDealt,
        damage_taken: s.damageTaken,
        healing_done: s.healingDone,
        turrets_destroyed: s.turretsDestroyed,
        largest_multikill: s.largestMultikill,
        items: s.items
      }))
    };
    this.hooks.onFinish(payload);
  }

  private exit() {
    this.stop();
    this.hooks.onExit();
  }

  private updateCamera(dt: number) {
    const cam = this.renderer.camera;
    const p = this.world.player;
    if (cam.locked && p) cam.setTarget({ x: p.x, y: p.y });

    if (this.device === 'desktop' && !cam.locked) {
      const edge = 26;
      const speed = 1400 * dt;
      if (this.cursor.x < edge) cam.nudge(-speed, 0);
      if (this.cursor.x > cam.width - edge) cam.nudge(speed, 0);
      if (this.cursor.y < edge) cam.nudge(0, -speed);
      if (this.cursor.y > cam.height - edge) cam.nudge(0, speed);
    }

    const wheel = this.input.consumeWheel();
    if (wheel !== 0) {
      cam.zoom = clamp(cam.zoom * (wheel > 0 ? 0.92 : 1.08), cam.zoom * 0.5, cam.zoom * 2);
    }

    cam.update(dt, this.world.shake);
    this.cursorWorld = cam.screenToWorld(this.cursor.x, this.cursor.y);
  }

  private updateHover() {
    const p = this.world.player;
    let best = 0;
    let bestD = 90;
    for (const u of this.world.units) {
      if (!u.alive || u.kind === 'ward') continue;
      if (!this.world.isVisible(u) && u.team !== p.team) continue;
      const d = dist(this.cursorWorld.x, this.cursorWorld.y, u.x, u.y);
      if (d < u.radius + 26 && d < bestD) {
        bestD = d;
        best = u.id;
      }
    }
    this.hoverId = best;
  }

  private buildTargetingPreview(): TargetingPreview | null {
    const p = this.world.player;
    if (!p.alive) return null;

    if (this.hud.aiming) {
      const a = this.hud.aiming;
      if (a.kind !== 'skill') return null;
      const state = p.skills[a.index];
      if (!state || state.rank === 0) return null;
      const range = state.def.range > 0 ? state.def.range : state.def.radius;
      return {
        skill: state.def,
        point: { x: p.x + a.dir.x * range * Math.max(0.35, a.distance), y: p.y + a.dir.y * range * Math.max(0.35, a.distance) },
        valid: this.world.skillReady(p, a.index)
      };
    }

    if (this.targeting && this.targeting.kind === 'skill') {
      const state = p.skills[this.targeting.index];
      if (!state) return null;
      return { skill: state.def, point: this.cursorWorld, valid: this.world.skillReady(p, this.targeting.index) };
    }
    return null;
  }

  private handleContinuousInput(dt: number) {
    const p = this.world.player;
    if (!p.alive) return;

    if (this.device !== 'desktop') {
      const v = this.hud.moveVector;
      if (v) {
        p.attackMove = false;
        p.targetId = 0;
        p.path.length = 0;
        p.channel = null;
        p.moveTarget = {
          x: clamp(p.x + v.x * 520, 60, WORLD_SIZE - 60),
          y: clamp(p.y + v.y * 520, 60, WORLD_SIZE - 60)
        };
      } else if (!p.targetId && p.moveTarget && !this.hud.attackHeld) {
        p.moveTarget = null;
      }

      if (this.hud.attackHeld) {
        const target = this.world.acquireTarget(p, p.stats().attackRange + 320);
        if (target) {
          p.targetId = target.id;
          if (!this.hud.moveVector) p.moveTarget = null;
        }
      }
    } else {
      if (this.input.pointer.down && this.input.pointer.button === 2) {
        this.issueContextAction(this.cursorWorld, false);
      }
    }

    if (p.attackMove && p.attackMovePoint) {
      const target = this.world.unit(p.targetId);
      if (!target || !target.alive) {
        const found = this.world.acquireTarget(p, p.stats().attackRange + 220);
        if (found) p.targetId = found.id;
        else if (!p.moveTarget) p.moveTarget = { ...p.attackMovePoint };
      }
    }
  }

  private bindPointer() {
    const canvas = this.canvas;

    canvas.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    });

    canvas.addEventListener('pointerdown', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      this.cursorWorld = this.renderer.camera.screenToWorld(this.cursor.x, this.cursor.y);
      this.input.pointer = { x: this.cursor.x, y: this.cursor.y, down: true, button: e.button };
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        void 0;
      }

      if (this.device !== 'desktop') return;

      if (e.button === 0) {
        if (this.targeting) {
          this.confirmTargeting(this.cursorWorld);
        } else if (this.pendingAttackMove) {
          this.pendingAttackMove = false;
          this.issueAttackMove(this.cursorWorld);
        }
      } else if (e.button === 2) {
        this.cancelTargeting();
        this.issueContextAction(this.cursorWorld, true);
      }
    });

    const up = (e: PointerEvent) => {
      this.input.pointer.down = false;
      this.input.pointer.button = -1;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        return;
      }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  private bindKeys() {
    const skillKeys = ['KeyQ', 'KeyW', 'KeyE', 'KeyR'];
    skillKeys.forEach((code, i) => {
      this.input.onKey(code, () => {
        const index = i + 1;
        if (this.input.ctrl) {
          this.world.levelSkill(this.world.player, index);
          return;
        }
        this.startCast(index, 'skill');
      });
    });

    this.input.onKey('KeyD', () => this.startCast(0, 'spell'));
    this.input.onKey('KeyF', () => this.startCast(1, 'spell'));
    for (let i = 0; i < 7; i++) {
      this.input.onKey(`Digit${i + 1}`, () => this.startCast(i, 'item'));
    }

    this.input.onKey('KeyB', () => this.world.startRecall(this.world.player));
    this.input.onKey('KeyP', () => this.hud.toggleShop());
    this.input.onKey('KeyO', () => this.hud.toggleShop());
    this.input.onKey('Tab', () => this.hud.toggleScoreboard());
    this.input.onKey('KeyA', () => {
      this.pendingAttackMove = true;
      this.cancelTargeting();
    });
    this.input.onKey('KeyS', () => {
      const p = this.world.player;
      p.moveTarget = null;
      p.path.length = 0;
      p.targetId = 0;
      p.attackMove = false;
    });
    this.input.onKey('KeyY', () => {
      this.renderer.camera.locked = !this.renderer.camera.locked;
      this.settings.camera_locked = this.renderer.camera.locked;
    });
    this.input.onKey('Space', () => {
      this.renderer.camera.jumpTo({ x: this.world.player.x, y: this.world.player.y });
    });
    this.input.onKey('Escape', () => {
      if (this.targeting) this.cancelTargeting();
      else if (this.hud.anyOverlayOpen) this.hud.closeOverlays();
      else this.hud.toggleMenu();
    });
  }

  private startCast(index: number, kind: 'skill' | 'spell' | 'item') {
    const p = this.world.player;
    if (!p.alive) return;

    if (kind === 'skill') {
      const state = p.skills[index];
      if (!state || state.rank === 0) return;
      const shape = state.def.shape;
      const needsAim = shape !== 'self';
      if (this.settings.quick_cast || !needsAim) {
        this.executeCast(index, kind, this.cursorWorld);
        return;
      }
      if (this.targeting && this.targeting.index === index && this.targeting.kind === kind) {
        this.executeCast(index, kind, this.cursorWorld);
        return;
      }
      this.targeting = { index, kind };
      return;
    }

    if (kind === 'spell') {
      this.executeCast(index, kind, this.cursorWorld);
      return;
    }

    this.executeCast(index, kind, this.cursorWorld);
  }

  private confirmTargeting(point: Point) {
    if (!this.targeting) return;
    const { index, kind } = this.targeting;
    this.targeting = null;
    this.executeCast(index, kind, point);
  }

  private cancelTargeting() {
    this.targeting = null;
    this.pendingAttackMove = false;
  }

  private executeCast(index: number, kind: 'skill' | 'spell' | 'item', point: Point) {
    const p = this.world.player;
    if (!p.alive) return;
    if (kind === 'skill') {
      const targetId = this.hoverId && this.world.unit(this.hoverId)?.kind !== 'ward' ? this.hoverId : 0;
      this.world.castSkill(p, index, point, targetId);
    } else if (kind === 'spell') {
      this.world.castSpell(p, index, point);
    } else {
      this.world.useItem(p, index, point);
    }
  }

  private castSkillFromHud(index: number, aimDir: Point | null) {
    const p = this.world.player;
    if (!p.alive) return;
    const state = p.skills[index];
    if (!state || state.rank === 0) return;
    const def = state.def;

    if (aimDir) {
      const range = def.range > 0 ? def.range : def.radius;
      this.world.castSkill(p, index, { x: p.x + aimDir.x * range, y: p.y + aimDir.y * range });
      return;
    }

    if (def.shape === 'self') {
      this.world.castSkill(p, index, { x: p.x, y: p.y });
      return;
    }

    const range = def.range > 0 ? def.range : def.radius;
    if (def.targetsAllies) {
      const ally = this.world
        .alliesInRadius(p.team, p.x, p.y, range, true)
        .filter((a) => a.id !== p.id)
        .sort((a, b) => a.hpPercent - b.hpPercent)[0];
      const t = ally ?? p;
      this.world.castSkill(p, index, { x: t.x, y: t.y }, t.id);
      return;
    }

    const enemy = this.world
      .enemiesInRadius(p.team, p.x, p.y, range + 200, false)
      .filter((e) => (e.kind === 'hero' || e.kind === 'minion' || e.kind === 'monster') && this.world.isVisible(e))
      .sort((a, b) => {
        const pa = a.kind === 'hero' ? 0 : 1;
        const pb = b.kind === 'hero' ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, b.x, b.y);
      })[0];

    if (enemy) {
      this.world.castSkill(p, index, { x: enemy.x, y: enemy.y }, enemy.id);
    } else {
      this.world.castSkill(p, index, { x: p.x + Math.cos(p.facing) * range, y: p.y + Math.sin(p.facing) * range });
    }
  }

  private castSpellFromHud(index: number, aimDir: Point | null) {
    const p = this.world.player;
    if (!p.alive) return;
    const slot = p.spells[index];
    if (!slot) return;
    if (aimDir) {
      this.world.castSpell(p, index, { x: p.x + aimDir.x * 420, y: p.y + aimDir.y * 420 });
      return;
    }
    const enemy = this.world.enemiesInRadius(p.team, p.x, p.y, 700, false).find((e) => e.kind === 'hero' && this.world.isVisible(e));
    this.world.castSpell(p, index, enemy ? { x: enemy.x, y: enemy.y } : { x: p.x + Math.cos(p.facing) * 400, y: p.y + Math.sin(p.facing) * 400 });
  }

  private useItemFromHud(slot: number, aimDir: Point | null) {
    const p = this.world.player;
    if (!p.alive) return;
    const point = aimDir ? { x: p.x + aimDir.x * 500, y: p.y + aimDir.y * 500 } : { x: p.x, y: p.y };
    this.world.useItem(p, slot, point);
  }

  private buy(itemId: string) {
    const item = ITEM_BY_ID.get(itemId);
    if (!item) return;
    const result = this.world.buyItem(this.world.player, item);
    this.world.announce(result.ok ? 'Purchased' : 'Cannot buy', result.message, result.ok ? 'good' : 'bad', 1.6);
  }

  private issueContextAction(point: Point, fresh: boolean) {
    const p = this.world.player;
    if (!p.alive) return;

    const target = this.world.units.find(
      (u) =>
        u.alive &&
        u.kind !== 'ward' &&
        this.world.isEnemy(p.team, u.team) &&
        this.world.isVisible(u) &&
        dist(point.x, point.y, u.x, u.y) < u.radius + 44
    );

    if (target && fresh) {
      p.targetId = target.id;
      p.attackMove = false;
      p.moveTarget = null;
      p.path.length = 0;
      p.channel = null;
      return;
    }

    this.issueMove(point);
  }

  private issueMove(point: Point) {
    const p = this.world.player;
    if (!p.alive) return;
    p.targetId = 0;
    p.attackMove = false;
    p.attackMovePoint = null;
    p.channel = null;
    p.recallProgress = 0;
    p.moveTarget = { x: clamp(point.x, 40, WORLD_SIZE - 40), y: clamp(point.y, 40, WORLD_SIZE - 40) };
    p.path = findPath({ x: p.x, y: p.y }, p.moveTarget);
    this.world.addEffect('moveflag', point.x, point.y, 0, 0, 40, '#7cffb0', 0.5);
  }

  private issueAttackMove(point: Point) {
    const p = this.world.player;
    if (!p.alive) return;
    p.attackMove = true;
    p.attackMovePoint = { ...point };
    p.targetId = 0;
    p.channel = null;
    p.moveTarget = { ...point };
    p.path = findPath({ x: p.x, y: p.y }, point);
    this.world.addEffect('aoe', point.x, point.y, 0, 0, 90, '#ff5f6d', 0.5);
  }
}
