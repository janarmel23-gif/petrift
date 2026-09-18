import { clamp, type Point } from '../core/math';
import type { DeviceMode } from '../core/input';
import { getHero, SPELL_BY_ID } from '../data/heroes';
import { ITEMS, ITEM_BY_ID, RECOMMENDED_BUILDS, componentCost } from '../data/items';
import { WORLD_SIZE } from '../data/map';
import type { ItemDef, ItemSlot } from '../data/types';
import { drawMinimap } from '../render/minimap';
import { makeIcon } from '../render/icons';
import { drawPetPortrait } from '../render/pets';
import type { Unit } from '../sim/unit';
import type { World } from '../sim/world';
import type { Camera } from '../render/camera';
import type { GameSettings } from '../../lib/types';

export interface HudCallbacks {
  onSkill: (index: number, aim: Point | null) => void;
  onLevelSkill: (index: number) => void;
  onSpell: (index: number, aim: Point | null) => void;
  onItem: (slot: number, aim: Point | null) => void;
  onRecall: () => void;
  onBuy: (itemId: string) => void;
  onSell: (slot: number) => void;
  onSurrender: () => void;
  onExit: () => void;
  onMinimap: (point: Point, moveHero: boolean) => void;
  onPing: (point: Point) => void;
  onSetting: (key: keyof GameSettings, value: unknown) => void;
  onRestart: () => void;
}

const SHOP_TABS: Array<{ id: ItemSlot | 'recommended'; label: string }> = [
  { id: 'recommended', label: 'Build' },
  { id: 'starter', label: 'Starter' },
  { id: 'boots', label: 'Boots' },
  { id: 'attack', label: 'Attack' },
  { id: 'magic', label: 'Magic' },
  { id: 'defense', label: 'Defense' },
  { id: 'legendary', label: 'Legendary' },
  { id: 'support', label: 'Support' },
  { id: 'jungle', label: 'Jungle' },
  { id: 'consumable', label: 'Consumable' }
];

export class Hud {
  root: HTMLElement;
  device: DeviceMode;
  settings: GameSettings;
  private cb: HudCallbacks;
  private refs = new Map<string, HTMLElement>();
  private world: World;
  private camera: Camera;
  private skillIcons: HTMLCanvasElement[] = [];
  private itemIconCache = new Map<string, string>();
  private pings: Array<{ x: number; y: number; at: number }> = [];
  private shopTab: ItemSlot | 'recommended' = 'recommended';
  private shopSearch = '';
  private scoreboardOpen = false;
  private shopOpen = false;
  private menuOpen = false;
  private portraitTime = 0;

  moveVector: Point | null = null;
  attackHeld = false;
  aiming: { index: number; kind: 'skill' | 'spell' | 'item'; dir: Point; distance: number } | null = null;

  constructor(root: HTMLElement, world: World, camera: Camera, device: DeviceMode, settings: GameSettings, cb: HudCallbacks) {
    this.root = root;
    this.world = world;
    this.camera = camera;
    this.device = device;
    this.settings = settings;
    this.cb = cb;
    this.build();
  }

  private ref<T extends HTMLElement = HTMLElement>(name: string): T {
    return this.refs.get(name) as T;
  }

  private build() {
    const mobile = this.device !== 'desktop';
    this.root.style.setProperty('--hud-scale', String(this.settings.hud_scale || 1));
    this.root.innerHTML = `
      <div class="hud ${mobile ? 'hud-touch' : 'hud-desktop'}" data-ref="hud">
        <div class="hud-top">
          <div class="team-score blue"><span class="dot"></span><b data-ref="blueKills">0</b><small>Blue</small></div>
          <div class="clock-wrap">
            <div class="clock" data-ref="clock">00:00</div>
            <div class="objective-row">
              <span data-ref="drakeBlue" class="obj-pill blue">0</span>
              <span class="obj-label">Drakes</span>
              <span data-ref="drakeRed" class="obj-pill red">0</span>
            </div>
          </div>
          <div class="team-score red"><small>Red</small><b data-ref="redKills">0</b><span class="dot"></span></div>
          <button class="icon-btn menu-btn" data-ref="menuBtn" aria-label="Menu">≡</button>
        </div>

        <div class="killfeed" data-ref="killfeed"></div>
        <div class="announce" data-ref="announce"></div>

        <div class="minimap-wrap" data-ref="minimapWrap">
          <canvas data-ref="minimap" width="300" height="300"></canvas>
          <div class="minimap-legend"><span class="you"></span>You <span class="ally"></span>Ally <span class="enemy"></span>Enemy</div>
        </div>

        <div class="hud-bottom">
          <div class="player-card">
            <div class="portrait-wrap">
              <canvas data-ref="portrait" width="128" height="128"></canvas>
              <div class="level-badge" data-ref="level">1</div>
              <div class="skillpoint-badge hidden" data-ref="skillPoints">+1</div>
            </div>
            <div class="vitals">
              <div class="bar hp"><i data-ref="hpFill"></i><span data-ref="hpText">0/0</span></div>
              <div class="bar mp"><i data-ref="mpFill"></i><span data-ref="mpText">0/0</span></div>
              <div class="stat-row">
                <span class="gold"><b data-ref="gold">500</b></span>
                <span class="kda" data-ref="kda">0 / 0 / 0</span>
                <span class="cs" data-ref="cs">0 CS</span>
              </div>
            </div>
          </div>

          <div class="ability-bar" data-ref="abilityBar"></div>

          <div class="right-cluster">
            <div class="spell-bar" data-ref="spellBar"></div>
            <div class="item-bar" data-ref="itemBar"></div>
            <div class="util-bar">
              <button class="util-btn" data-ref="shopBtn">Shop</button>
              <button class="util-btn" data-ref="recallBtn">Recall</button>
              <button class="util-btn" data-ref="scoreBtn">Scores</button>
            </div>
          </div>
        </div>

        <div class="mobile-layer ${mobile ? '' : 'hidden'}" data-ref="mobileLayer">
          <div class="joystick" data-ref="joystick"><i data-ref="joystickKnob"></i></div>
          <div class="attack-cluster">
            <button class="attack-btn" data-ref="attackBtn"><span>ATK</span></button>
          </div>
        </div>

        <div class="overlay scoreboard hidden" data-ref="scoreboard">
          <div class="panel">
            <header><h2>Scoreboard</h2><button class="icon-btn" data-ref="scoreClose">✕</button></header>
            <div data-ref="scoreBody"></div>
          </div>
        </div>

        <div class="overlay shop hidden" data-ref="shop">
          <div class="panel shop-panel">
            <header>
              <h2>Rift Emporium</h2>
              <div class="shop-gold">Gold <b data-ref="shopGold">0</b></div>
              <input data-ref="shopSearch" placeholder="Search items" />
              <button class="icon-btn" data-ref="shopClose">✕</button>
            </header>
            <div class="shop-body">
              <nav class="shop-tabs" data-ref="shopTabs"></nav>
              <div class="shop-grid" data-ref="shopGrid"></div>
              <aside class="shop-detail" data-ref="shopDetail"></aside>
            </div>
            <footer>
              <div class="owned" data-ref="shopOwned"></div>
              <p class="hint">You must be near your base fountain to buy or sell.</p>
            </footer>
          </div>
        </div>

        <div class="overlay menu hidden" data-ref="menu">
          <div class="panel menu-panel">
            <header><h2>Match Menu</h2><button class="icon-btn" data-ref="menuClose">✕</button></header>
            <div class="settings-list" data-ref="settingsList"></div>
            <div class="menu-actions">
              <button class="btn ghost" data-ref="surrenderBtn">Surrender</button>
              <button class="btn danger" data-ref="exitBtn">Leave Match</button>
            </div>
          </div>
        </div>

        <div class="death-overlay hidden" data-ref="death">
          <div class="death-inner">
            <h2>You have fallen</h2>
            <div class="respawn" data-ref="respawnTimer">5.0</div>
            <p data-ref="deathReason"></p>
          </div>
        </div>

        <div class="overlay result hidden" data-ref="result">
          <div class="panel result-panel">
            <h1 data-ref="resultTitle">VICTORY</h1>
            <p data-ref="resultSub"></p>
            <div data-ref="resultBody"></div>
            <div class="menu-actions">
              <button class="btn" data-ref="resultAgain">Play Again</button>
              <button class="btn ghost" data-ref="resultExit">Back to Lobby</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.root.querySelectorAll<HTMLElement>('[data-ref]').forEach((el) => {
      this.refs.set(el.dataset.ref!, el);
    });

    this.buildAbilityBar();
    this.buildSpellBar();
    this.buildItemBar();
    this.buildShop();
    this.buildSettings();
    this.wire();
  }

  private buildAbilityBar() {
    const bar = this.ref('abilityBar');
    bar.innerHTML = '';
    this.skillIcons = [];
    const hero = getHero(this.world.player.heroId);
    hero.skills.forEach((def, index) => {
      const btn = document.createElement('div');
      btn.className = `ability ${def.key === 'P' ? 'passive' : ''} ${def.key === 'R' ? 'ult' : ''}`;
      btn.setAttribute('role', 'button');
      btn.dataset.index = String(index);
      const face = document.createElement('div');
      face.className = 'ability-face';
      btn.appendChild(face);
      const icon = makeIcon(this.device === 'mobile' ? 54 : 62, this.world.player.skin?.spellColor ?? def.color, def.vfx);
      this.skillIcons.push(icon);
      face.appendChild(icon);
      const cd = document.createElement('span');
      cd.className = 'cd';
      face.appendChild(cd);
      const sweep = document.createElement('i');
      sweep.className = 'sweep';
      face.appendChild(sweep);
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = def.key;
      btn.appendChild(key);
      const pips = document.createElement('span');
      pips.className = 'pips';
      const max = def.key === 'R' ? 3 : def.key === 'P' ? 0 : 5;
      for (let i = 0; i < max; i++) pips.appendChild(document.createElement('i'));
      btn.appendChild(pips);
      const up = document.createElement('button');
      up.className = 'levelup hidden';
      up.textContent = '+';
      up.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
      });
      up.addEventListener('pointerup', (e) => e.stopPropagation());
      up.addEventListener('click', (e) => {
        e.stopPropagation();
        this.cb.onLevelSkill(index);
      });
      btn.appendChild(up);
      this.attachCastHandlers(btn, index, 'skill');
      btn.addEventListener('pointerenter', () => this.showTooltip(btn, this.skillTooltip(index)));
      btn.addEventListener('pointerleave', () => this.hideTooltip());
      bar.appendChild(btn);
    });
  }

  private buildSpellBar() {
    const bar = this.ref('spellBar');
    bar.innerHTML = '';
    this.world.player.spells.forEach((slot, index) => {
      const def = SPELL_BY_ID.get(slot.id);
      const btn = document.createElement('button');
      btn.className = 'spell';
      btn.appendChild(makeIcon(this.device === 'mobile' ? 40 : 46, def?.color ?? '#7cd8ff', def?.icon ?? 'star'));
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = index === 0 ? 'D' : 'F';
      btn.appendChild(key);
      const cd = document.createElement('span');
      cd.className = 'cd';
      btn.appendChild(cd);
      this.attachCastHandlers(btn, index, 'spell');
      btn.addEventListener('pointerenter', () => this.showTooltip(btn, `<b>${def?.name ?? ''}</b><p>${def?.description ?? ''}</p>`));
      btn.addEventListener('pointerleave', () => this.hideTooltip());
      bar.appendChild(btn);
    });
  }

  private buildItemBar() {
    const bar = this.ref('itemBar');
    bar.innerHTML = '';
    for (let i = 0; i < 7; i++) {
      const btn = document.createElement('button');
      btn.className = 'item-slot empty';
      btn.dataset.slot = String(i);
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = i === 6 ? 'T' : String(i + 1);
      btn.appendChild(key);
      const cd = document.createElement('span');
      cd.className = 'cd';
      btn.appendChild(cd);
      this.attachCastHandlers(btn, i, 'item');
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.cb.onSell(i);
      });
      bar.appendChild(btn);
    }
  }

  private attachCastHandlers(btn: HTMLElement, index: number, kind: 'skill' | 'spell' | 'item') {
    let dragging = false;
    let startX = 0;
    let startY = 0;

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
        void 0;
      }
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      if (this.device !== 'desktop') {
        this.aiming = { index, kind, dir: { x: 1, y: 0 }, distance: 0 };
        btn.classList.add('aiming');
      }
    });

    btn.addEventListener('pointermove', (e) => {
      if (!dragging || this.device === 'desktop') return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const len = Math.hypot(dx, dy);
      if (len > 6 && this.aiming) {
        this.aiming.dir = { x: dx / len, y: dy / len };
        this.aiming.distance = clamp(len / 70, 0, 1);
      }
    });

    const finish = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      btn.classList.remove('aiming');
      const aim = this.aiming && this.aiming.distance > 0.12 ? { ...this.aiming.dir } : null;
      this.aiming = null;
      if (kind === 'skill') this.cb.onSkill(index, aim);
      else if (kind === 'spell') this.cb.onSpell(index, aim);
      else this.cb.onItem(index, aim);
      try {
        btn.releasePointerCapture(e.pointerId);
      } catch {
        return;
      }
    };

    btn.addEventListener('pointerup', finish);
    btn.addEventListener('pointercancel', () => {
      dragging = false;
      this.aiming = null;
      btn.classList.remove('aiming');
    });
  }

  private buildShop() {
    const tabs = this.ref('shopTabs');
    tabs.innerHTML = '';
    for (const tab of SHOP_TABS) {
      const btn = document.createElement('button');
      btn.textContent = tab.label;
      btn.className = tab.id === this.shopTab ? 'active' : '';
      btn.addEventListener('click', () => {
        this.shopTab = tab.id;
        tabs.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderShopGrid();
      });
      tabs.appendChild(btn);
    }
    this.renderShopGrid();
  }

  private itemIcon(item: ItemDef): string {
    const cached = this.itemIconCache.get(item.id);
    if (cached) return cached;
    const url = makeIcon(48, item.color, item.icon).toDataURL();
    this.itemIconCache.set(item.id, url);
    return url;
  }

  private renderShopGrid() {
    const grid = this.ref('shopGrid');
    const player = this.world.player;
    let list: ItemDef[];
    if (this.shopTab === 'recommended') {
      const ids = RECOMMENDED_BUILDS[player.heroId] ?? [];
      list = ids.map((id) => ITEM_BY_ID.get(id)).filter(Boolean) as ItemDef[];
    } else {
      list = ITEMS.filter((i) => i.slot === this.shopTab);
    }
    if (this.shopSearch) {
      const q = this.shopSearch.toLowerCase();
      list = ITEMS.filter((i) => i.name.toLowerCase().includes(q) || i.tags.some((t) => t.includes(q)));
    }

    grid.innerHTML = '';
    for (const item of list) {
      const card = document.createElement('button');
      card.className = 'shop-item';
      const affordable = player.gold >= item.cost;
      if (!affordable) card.classList.add('poor');
      card.innerHTML = `
        <img src="${this.itemIcon(item)}" alt="" />
        <span class="name">${item.name}</span>
        <span class="price">${item.cost}</span>
      `;
      card.addEventListener('click', () => this.showItemDetail(item));
      card.addEventListener('dblclick', () => this.cb.onBuy(item.id));
      grid.appendChild(card);
    }
    if (list.length > 0) this.showItemDetail(list[0]);
  }

  private showItemDetail(item: ItemDef) {
    const detail = this.ref('shopDetail');
    const statLines = Object.entries(item.stats)
      .map(([k, v]) => `<li>${statLabel(k)} <b>${formatStat(k, v as number)}</b></li>`)
      .join('');
    const parts = item.buildsFrom
      .map((id) => ITEM_BY_ID.get(id))
      .filter(Boolean)
      .map((p) => `<span class="part"><img src="${this.itemIcon(p as ItemDef)}" alt=""/>${(p as ItemDef).name}</span>`)
      .join('');
    detail.innerHTML = `
      <div class="detail-head">
        <img src="${this.itemIcon(item)}" alt="" />
        <div><h3>${item.name}</h3><span class="tier">Tier ${item.tier} ${item.unique ? '· Unique' : ''}</span></div>
      </div>
      <ul class="stats">${statLines || '<li>No base stats</li>'}</ul>
      ${item.passiveText ? `<p class="passive"><b>Passive</b> ${item.passiveText}</p>` : ''}
      ${item.activeText ? `<p class="active"><b>Active</b> ${item.activeText} (${item.activeCooldown}s)</p>` : ''}
      ${parts ? `<div class="parts"><span>Builds from</span>${parts}</div>` : ''}
      <div class="detail-buy">
        <span class="cost">${item.cost}g ${item.buildsFrom.length ? `(+${componentCost(item)} upgrade)` : ''}</span>
        <button class="btn" data-buy="${item.id}">Purchase</button>
      </div>
    `;
    detail.querySelector<HTMLButtonElement>('[data-buy]')?.addEventListener('click', () => this.cb.onBuy(item.id));
  }

  private buildSettings() {
    const list = this.ref('settingsList');
    const toggles: Array<{ key: keyof GameSettings; label: string; hint: string }> = [
      { key: 'quick_cast', label: 'Quick cast', hint: 'Abilities fire instantly at the cursor' },
      { key: 'camera_locked', label: 'Lock camera', hint: 'Camera follows your hero' },
      { key: 'show_all_heroes_on_map', label: 'Show all heroes on map', hint: 'Minimap reveals every hero position' },
      { key: 'show_damage_numbers', label: 'Damage numbers', hint: 'Show floating combat text' }
    ];
    list.innerHTML = '';
    for (const t of toggles) {
      const row = document.createElement('label');
      row.className = 'setting-row';
      row.innerHTML = `
        <div><span>${t.label}</span><small>${t.hint}</small></div>
        <input type="checkbox" ${this.settings[t.key] ? 'checked' : ''} />
      `;
      const input = row.querySelector('input')!;
      input.addEventListener('change', () => {
        (this.settings as unknown as Record<string, unknown>)[t.key] = input.checked;
        this.cb.onSetting(t.key, input.checked);
      });
      list.appendChild(row);
    }

    const quality = document.createElement('label');
    quality.className = 'setting-row';
    quality.innerHTML = `
      <div><span>Graphics quality</span><small>Lower this if the game stutters</small></div>
      <select>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="ultra">Ultra</option>
      </select>
    `;
    const select = quality.querySelector('select')!;
    select.value = this.settings.graphics_quality;
    select.addEventListener('change', () => {
      this.settings.graphics_quality = select.value as GameSettings['graphics_quality'];
      this.cb.onSetting('graphics_quality', select.value);
    });
    list.appendChild(quality);
  }

  private wire() {
    this.ref('menuBtn').addEventListener('click', () => this.toggleMenu());
    this.ref('menuClose').addEventListener('click', () => this.toggleMenu(false));
    this.ref('scoreBtn').addEventListener('click', () => this.toggleScoreboard());
    this.ref('scoreClose').addEventListener('click', () => this.toggleScoreboard(false));
    this.ref('shopBtn').addEventListener('click', () => this.toggleShop());
    this.ref('shopClose').addEventListener('click', () => this.toggleShop(false));
    this.ref('recallBtn').addEventListener('click', () => this.cb.onRecall());
    this.ref('surrenderBtn').addEventListener('click', () => this.cb.onSurrender());
    this.ref('exitBtn').addEventListener('click', () => this.cb.onExit());
    this.ref('resultExit').addEventListener('click', () => this.cb.onExit());
    this.ref('resultAgain').addEventListener('click', () => this.cb.onRestart());

    const search = this.ref<HTMLInputElement>('shopSearch');
    search.addEventListener('input', () => {
      this.shopSearch = search.value.trim();
      this.renderShopGrid();
    });

    const minimap = this.ref<HTMLCanvasElement>('minimap');
    const toWorld = (e: PointerEvent): Point => {
      const rect = minimap.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * WORLD_SIZE;
      const y = ((e.clientY - rect.top) / rect.height) * WORLD_SIZE;
      return { x, y };
    };
    minimap.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const p = toWorld(e);
      if (e.button === 2 || e.shiftKey) this.cb.onMinimap(p, true);
      else if (e.ctrlKey || e.altKey) {
        this.cb.onPing(p);
        this.pings.push({ x: p.x, y: p.y, at: this.world.time });
      } else this.cb.onMinimap(p, false);
    });
    minimap.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.cb.onMinimap(toWorld(e as unknown as PointerEvent), true);
    });

    this.setupJoystick();
    this.ref('attackBtn').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.attackHeld = true;
    });
    const releaseAttack = () => {
      this.attackHeld = false;
    };
    this.ref('attackBtn').addEventListener('pointerup', releaseAttack);
    this.ref('attackBtn').addEventListener('pointercancel', releaseAttack);
    this.ref('attackBtn').addEventListener('pointerleave', releaseAttack);
  }

  private setupJoystick() {
    const pad = this.ref('joystick');
    const knob = this.ref('joystickKnob');
    let active = false;
    let pointerId = -1;
    const radius = 62;

    const update = (clientX: number, clientY: number) => {
      const rect = pad.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const len = Math.hypot(dx, dy);
      const max = rect.width / 2;
      if (len > max) {
        dx = (dx / len) * max;
        dy = (dy / len) * max;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const mag = Math.min(1, len / max);
      if (mag > 0.14) {
        const nl = Math.hypot(dx, dy) || 1;
        this.moveVector = { x: dx / nl, y: dy / nl };
      } else {
        this.moveVector = null;
      }
    };

    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      active = true;
      pointerId = e.pointerId;
      try {
        pad.setPointerCapture(e.pointerId);
      } catch {
        void 0;
      }
      update(e.clientX, e.clientY);
    });
    pad.addEventListener('pointermove', (e) => {
      if (!active || e.pointerId !== pointerId) return;
      update(e.clientX, e.clientY);
    });
    const stop = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      active = false;
      pointerId = -1;
      this.moveVector = null;
      knob.style.transform = 'translate(0px, 0px)';
    };
    pad.addEventListener('pointerup', stop);
    pad.addEventListener('pointercancel', stop);
  }

  private skillTooltip(index: number): string {
    const player = this.world.player;
    const state = player.skills[index];
    if (!state) return '';
    const def = state.def;
    const rank = Math.max(0, state.rank - 1);
    const dmg = def.baseDamage[Math.min(rank, def.baseDamage.length - 1)];
    const cd = def.cooldown[Math.min(rank, def.cooldown.length - 1)];
    const cost = def.manaCost[Math.min(rank, def.manaCost.length - 1)];
    return `
      <b>${def.name}</b> <em>${def.key}${state.rank > 0 ? ` · Rank ${state.rank}` : ' · Locked'}</em>
      <p>${def.description}</p>
      <ul>
        ${dmg > 0 ? `<li>Damage <b>${Math.round(dmg)}</b> ${def.adRatio ? `(+${Math.round(def.adRatio * 100)}% AD)` : ''} ${def.apRatio ? `(+${Math.round(def.apRatio * 100)}% AP)` : ''}</li>` : ''}
        ${def.key !== 'P' ? `<li>Cooldown <b>${cd}s</b></li><li>Cost <b>${cost}</b></li>` : ''}
        ${def.range > 0 ? `<li>Range <b>${def.range}</b></li>` : ''}
      </ul>
    `;
  }

  private showTooltip(anchor: HTMLElement, html: string) {
    if (this.device !== 'desktop' || !html) return;
    let tip = this.root.querySelector<HTMLElement>('.tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'tooltip';
      this.root.querySelector('.hud')?.appendChild(tip);
    }
    tip.innerHTML = html;
    tip.classList.add('visible');
    const rect = anchor.getBoundingClientRect();
    tip.style.left = `${clamp(rect.left + rect.width / 2 - 150, 12, window.innerWidth - 312)}px`;
    tip.style.bottom = `${window.innerHeight - rect.top + 12}px`;
  }

  private hideTooltip() {
    this.root.querySelector('.tooltip')?.classList.remove('visible');
  }

  toggleScoreboard(force?: boolean) {
    this.scoreboardOpen = force ?? !this.scoreboardOpen;
    this.ref('scoreboard').classList.toggle('hidden', !this.scoreboardOpen);
    if (this.scoreboardOpen) this.renderScoreboard();
  }

  toggleShop(force?: boolean) {
    this.shopOpen = force ?? !this.shopOpen;
    this.ref('shop').classList.toggle('hidden', !this.shopOpen);
    if (this.shopOpen) this.renderShopGrid();
  }

  toggleMenu(force?: boolean) {
    this.menuOpen = force ?? !this.menuOpen;
    this.ref('menu').classList.toggle('hidden', !this.menuOpen);
  }

  get anyOverlayOpen(): boolean {
    return this.scoreboardOpen || this.shopOpen || this.menuOpen;
  }

  closeOverlays() {
    this.toggleScoreboard(false);
    this.toggleShop(false);
    this.toggleMenu(false);
  }

  private renderScoreboard() {
    const body = this.ref('scoreBody');
    const score = this.world.score();
    const row = (e: (typeof score)[number]) => {
      const hero = getHero(e.heroId);
      const items = e.items
        .map((id) => {
          const item = ITEM_BY_ID.get(id);
          return item ? `<img src="${this.itemIcon(item)}" title="${item.name}" alt="" />` : '';
        })
        .join('');
      return `
        <tr class="${e.team}">
          <td class="who"><b>${e.name}</b><small>${hero.name} · ${hero.role}${e.isBot ? ` · ${e.botDifficulty} bot` : ''}</small></td>
          <td>${e.level}</td>
          <td>${e.kills} / ${e.deaths} / ${e.assists}</td>
          <td>${e.cs}</td>
          <td>${(e.goldEarned / 1000).toFixed(1)}k</td>
          <td>${(e.damageDealt / 1000).toFixed(1)}k</td>
          <td class="items">${items}</td>
        </tr>
      `;
    };
    const head = `<tr><th>Player</th><th>Lv</th><th>K / D / A</th><th>CS</th><th>Gold</th><th>Damage</th><th>Items</th></tr>`;
    body.innerHTML = `
      <table class="score-table">
        <thead>${head}</thead>
        <tbody>${score.filter((s) => s.team === 'blue').map(row).join('')}</tbody>
      </table>
      <table class="score-table">
        <thead>${head}</thead>
        <tbody>${score.filter((s) => s.team === 'red').map(row).join('')}</tbody>
      </table>
    `;
  }

  showResult(win: boolean) {
    const panel = this.ref('result');
    panel.classList.remove('hidden');
    this.ref('resultTitle').textContent = win ? 'VICTORY' : 'DEFEAT';
    this.ref('resultTitle').className = win ? 'win' : 'lose';
    const mins = Math.floor(this.world.time / 60);
    const secs = Math.floor(this.world.time % 60);
    this.ref('resultSub').textContent = `${mins}:${String(secs).padStart(2, '0')} · ${this.world.kills.blue} - ${this.world.kills.red}`;
    this.renderScoreboard();
    this.ref('resultBody').innerHTML = this.ref('scoreBody').innerHTML;
  }

  update(dt: number) {
    const world = this.world;
    const p = world.player;
    this.portraitTime += dt;

    const mins = Math.floor(world.time / 60);
    const secs = Math.floor(world.time % 60);
    this.ref('clock').textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    this.ref('blueKills').textContent = String(world.kills.blue);
    this.ref('redKills').textContent = String(world.kills.red);
    this.ref('drakeBlue').textContent = String(world.drakeStacks.blue);
    this.ref('drakeRed').textContent = String(world.drakeStacks.red);

    this.ref('level').textContent = String(p.level);
    this.ref('gold').textContent = String(Math.floor(p.gold));
    this.ref('kda').textContent = `${p.kills} / ${p.deaths} / ${p.assists}`;
    this.ref('cs').textContent = `${p.cs} CS`;
    this.ref('shopGold').textContent = String(Math.floor(p.gold));

    const hpPct = p.hpPercent * 100;
    this.ref('hpFill').style.width = `${hpPct}%`;
    this.ref('hpText').textContent = `${Math.max(0, Math.round(p.hp))} / ${Math.round(p.maxHp)}`;
    this.ref('mpFill').style.width = `${p.mpPercent * 100}%`;
    this.ref('mpText').textContent = `${Math.round(p.mp)} / ${Math.round(p.maxMp)}`;

    this.ref('skillPoints').classList.toggle('hidden', p.skillPoints <= 0);
    this.ref('skillPoints').textContent = `+${p.skillPoints}`;

    const portrait = this.ref<HTMLCanvasElement>('portrait');
    const pctx = portrait.getContext('2d');
    if (pctx && p.hero) {
      pctx.clearRect(0, 0, portrait.width, portrait.height);
      const g = pctx.createRadialGradient(64, 54, 8, 64, 64, 70);
      g.addColorStop(0, 'rgba(90,140,200,0.55)');
      g.addColorStop(1, 'rgba(10,16,28,0.9)');
      pctx.fillStyle = g;
      pctx.fillRect(0, 0, 128, 128);
      drawPetPortrait(pctx, p.hero.art, p.skin, 128, this.portraitTime);
    }

    this.updateAbilityBar();
    this.updateSpellBar();
    this.updateItemBar();
    this.updateKillFeed();
    this.updateAnnounce();
    this.updateDeath();

    drawMinimap(this.ref<HTMLCanvasElement>('minimap'), world, this.camera, this.settings.show_all_heroes_on_map, this.pings);
    this.pings = this.pings.filter((x) => world.time - x.at < 3);

    if (this.scoreboardOpen && Math.floor(world.time * 2) % 2 === 0) this.renderScoreboard();
    if (this.shopOpen) this.ref('shopBtn').classList.toggle('disabled', !world.canShop(p));
  }

  private updateAbilityBar() {
    const p = this.world.player;
    const bar = this.ref('abilityBar');
    bar.querySelectorAll<HTMLElement>('.ability').forEach((btn, index) => {
      const state = p.skills[index];
      if (!state) return;
      const remaining = this.world.skillCooldownRemaining(p, index);
      const total = this.world.skillTotalCooldown(p, index);
      const cdEl = btn.querySelector<HTMLElement>('.cd')!;
      const sweep = btn.querySelector<HTMLElement>('.sweep')!;
      const ready = this.world.skillReady(p, index);
      btn.classList.toggle('locked', state.rank === 0 && state.def.key !== 'P');
      btn.classList.toggle('ready', ready);
      btn.classList.toggle('nomana', state.rank > 0 && remaining <= 0 && p.mp < state.def.manaCost[Math.max(0, state.rank - 1)]);
      cdEl.textContent = remaining > 0 ? (remaining > 1 ? Math.ceil(remaining).toString() : remaining.toFixed(1)) : '';
      sweep.style.height = `${clamp(remaining / Math.max(0.1, total), 0, 1) * 100}%`;
      const up = btn.querySelector<HTMLElement>('.levelup')!;
      up.classList.toggle('hidden', !this.world.canLevelSkill(p, index));
      const pips = btn.querySelectorAll<HTMLElement>('.pips i');
      pips.forEach((pip, i) => pip.classList.toggle('on', i < state.rank));
    });
  }

  private updateSpellBar() {
    const p = this.world.player;
    this.ref('spellBar')
      .querySelectorAll<HTMLElement>('.spell')
      .forEach((btn, index) => {
        const remaining = this.world.spellCooldownRemaining(p, index);
        btn.classList.toggle('ready', remaining <= 0);
        btn.querySelector<HTMLElement>('.cd')!.textContent = remaining > 0 ? Math.ceil(remaining).toString() : '';
      });
  }

  private updateItemBar() {
    const p = this.world.player;
    this.ref('itemBar')
      .querySelectorAll<HTMLElement>('.item-slot')
      .forEach((btn, slot) => {
        const id = p.items[slot];
        const item = id ? ITEM_BY_ID.get(id) : undefined;
        btn.classList.toggle('empty', !item);
        let img = btn.querySelector('img');
        if (item) {
          if (!img) {
            img = document.createElement('img');
            btn.insertBefore(img, btn.firstChild);
          }
          const src = this.itemIcon(item);
          if (img.getAttribute('src') !== src) img.setAttribute('src', src);
          img.setAttribute('title', item.name);
          const cdUntil = p.passiveState[`item_${slot}`] ?? 0;
          const remaining = Math.max(0, cdUntil - this.world.time);
          btn.querySelector<HTMLElement>('.cd')!.textContent = remaining > 0 ? Math.ceil(remaining).toString() : '';
          btn.classList.toggle('usable', item.active !== 'none');
        } else if (img) {
          img.remove();
          btn.querySelector<HTMLElement>('.cd')!.textContent = '';
        }
      });
  }

  private updateKillFeed() {
    const feed = this.ref('killfeed');
    const entries = this.world.killFeed.filter((k) => this.world.time - k.at < 7);
    feed.innerHTML = entries
      .map((k) => {
        const cls = k.killerTeam === this.world.playerTeam ? 'good' : 'bad';
        return `<div class="feed-row ${cls}"><b>${k.killer}</b> <span>slew</span> <b>${k.victim}</b>${k.assists ? `<em>+${k.assists}</em>` : ''}</div>`;
      })
      .join('');
  }

  private updateAnnounce() {
    const el = this.ref('announce');
    const current = this.world.announcements[this.world.announcements.length - 1];
    if (!current) {
      el.innerHTML = '';
      el.className = 'announce';
      return;
    }
    const age = this.world.time - current.at;
    el.className = `announce visible ${current.tone}`;
    el.style.opacity = String(clamp(1 - Math.max(0, age - current.duration + 0.6) / 0.6, 0, 1));
    el.innerHTML = `<h2>${current.text}</h2><p>${current.sub}</p>`;
  }

  private updateDeath() {
    const p = this.world.player;
    const el = this.ref('death');
    if (p.alive) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    const remaining = Math.max(0, p.respawnAt - this.world.time);
    this.ref('respawnTimer').textContent = remaining.toFixed(1);
    const killer = this.world.unit(p.lastDamagedBy);
    this.ref('deathReason').textContent = killer ? `Slain by ${killer.name}` : 'Slain in the Rift';
  }

  destroy() {
    this.root.innerHTML = '';
    this.refs.clear();
  }
}

function statLabel(key: string): string {
  const map: Record<string, string> = {
    ad: 'Attack Damage',
    ap: 'Ability Power',
    hp: 'Health',
    mana: 'Mana',
    armor: 'Armor',
    mr: 'Magic Resist',
    attackSpeed: 'Attack Speed',
    critChance: 'Critical Chance',
    lifesteal: 'Life Steal',
    spellVamp: 'Spell Vamp',
    abilityHaste: 'Ability Haste',
    moveSpeed: 'Move Speed',
    moveSpeedPct: 'Move Speed',
    armorPen: 'Armor Penetration',
    magicPen: 'Magic Penetration',
    hpRegen: 'Health Regen',
    manaRegen: 'Mana Regen',
    tenacity: 'Tenacity'
  };
  return map[key] ?? key;
}

function formatStat(key: string, value: number): string {
  const pct = ['attackSpeed', 'critChance', 'lifesteal', 'spellVamp', 'moveSpeedPct', 'tenacity'];
  if (pct.includes(key)) return `+${Math.round(value * 100)}%`;
  return `+${value}`;
}
