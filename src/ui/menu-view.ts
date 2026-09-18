import { HEROES, SUMMONER_SPELLS, getHero, getSkin } from '../game/data/heroes';
import { drawPetPortrait } from '../game/render/pets';
import { makeIcon } from '../game/render/icons';
import type { HeroDef, SkinDef } from '../game/data/types';
import type { BotLevel, GameSettings, LeaderboardRow, MasteryRow, MatchHistoryEntry, Profile, UnlockRow } from '../lib/types';

export interface LobbyState {
  profile: Profile;
  unlocks: UnlockRow[];
  mastery: MasteryRow[];
  settings: GameSettings;
  history: MatchHistoryEntry[];
  leaderboard: LeaderboardRow[];
  guest: boolean;
}

export interface LobbySelection {
  heroId: string;
  skinId: string;
  spells: [string, string];
  difficulty: BotLevel;
  team: 'blue' | 'red';
}

export interface LobbyCallbacks {
  onStart: (selection: LobbySelection) => void;
  onLogout: () => void;
  onPurchase: (kind: 'hero' | 'skin', contentId: string, heroId: string, price: number, currency: 'coins' | 'gems') => Promise<void>;
  onSettings: (settings: GameSettings) => void;
  onSaveLoadout: (selection: LobbySelection) => void;
  onInstall: () => void;
}

const TIER_LABEL: Record<string, string> = {
  warren: 'Warren',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
  mythic: 'Mythic',
  legend: 'Legend'
};

export class LobbyView {
  private root: HTMLElement;
  private state: LobbyState;
  private cb: LobbyCallbacks;
  private selection: LobbySelection;
  private tab = 'play';
  private animationEpoch = 0;
  private canInstall = false;

  constructor(root: HTMLElement, state: LobbyState, cb: LobbyCallbacks) {
    this.root = root;
    this.state = state;
    this.cb = cb;
    const owned = this.ownedHeroes();
    this.selection = {
      heroId: owned[0]?.id ?? 'bolt',
      skinId: `${owned[0]?.id ?? 'bolt'}:default`,
      spells: ['flash', 'ignite'],
      difficulty: 'medium',
      team: 'blue'
    };
    this.render();
  }

  setInstallAvailable(available: boolean) {
    this.canInstall = available;
    const btn = this.root.querySelector<HTMLElement>('[data-install]');
    if (btn) btn.classList.toggle('hidden', !available);
  }

  updateState(patch: Partial<LobbyState>) {
    this.state = { ...this.state, ...patch };
    this.render();
  }

  private ownsHero(id: string): boolean {
    return this.state.unlocks.some((u) => u.kind === 'hero' && u.content_id === id) || getHero(id).price === 0;
  }

  private ownsSkin(id: string): boolean {
    return id.endsWith(':default') || this.state.unlocks.some((u) => u.kind === 'skin' && u.content_id === id);
  }

  private ownedHeroes(): HeroDef[] {
    return HEROES.filter((h) => this.ownsHero(h.id));
  }

  private masteryFor(heroId: string): MasteryRow | undefined {
    return this.state.mastery.find((m) => m.hero_id === heroId);
  }

  private render() {
    const p = this.state.profile;
    this.animationEpoch += 1;

    this.root.innerHTML = `
      <div class="lobby">
        <header class="lobby-top">
          <div class="identity">
            <canvas class="avatar" width="72" height="72" data-avatar></canvas>
            <div>
              <h2>${p.display_name || p.username}</h2>
              <span class="sub">Level ${p.account_level} · ${TIER_LABEL[p.tier]} · ${p.rank_points} RP${this.state.guest ? ' · offline' : ''}</span>
            </div>
          </div>
          <div class="wallet">
            <span class="coin">${p.coins.toLocaleString()}</span>
            <span class="gem">${p.gems.toLocaleString()}</span>
          </div>
          <div class="top-actions">
            <button class="btn ghost small hidden" data-install>Install app</button>
            <button class="btn ghost small" data-logout>Sign out</button>
          </div>
        </header>

        <nav class="lobby-nav">
          ${['play', 'champions', 'profile', 'leaderboard', 'settings']
            .map((t) => `<button data-tab="${t}" class="${this.tab === t ? 'active' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`)
            .join('')}
        </nav>

        <div class="lobby-body" data-body></div>
      </div>
    `;

    this.root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.tab = btn.dataset.tab!;
        this.render();
      });
    });
    this.root.querySelector('[data-logout]')?.addEventListener('click', () => this.cb.onLogout());
    const install = this.root.querySelector<HTMLElement>('[data-install]');
    install?.classList.toggle('hidden', !this.canInstall);
    install?.addEventListener('click', () => this.cb.onInstall());

    const avatar = this.root.querySelector<HTMLCanvasElement>('[data-avatar]')!;
    this.animatePortrait(avatar, getHero(this.ownsHero(p.avatar_hero) ? p.avatar_hero : this.selection.heroId), null);

    const body = this.root.querySelector<HTMLElement>('[data-body]')!;
    switch (this.tab) {
      case 'champions':
        this.renderChampions(body);
        break;
      case 'profile':
        this.renderProfile(body);
        break;
      case 'leaderboard':
        this.renderLeaderboard(body);
        break;
      case 'settings':
        this.renderSettings(body);
        break;
      default:
        this.renderPlay(body);
        break;
    }
  }

  private animatePortrait(canvas: HTMLCanvasElement, hero: HeroDef, skin: SkinDef | null) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const epoch = this.animationEpoch;
    let t = Math.random() * 10;
    const frame = () => {
      if (!canvas.isConnected || epoch !== this.animationEpoch) return;
      t += 0.016;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawPetPortrait(ctx, hero.art, skin, canvas.width, t);
      requestAnimationFrame(frame);
    };
    frame();
  }

  private renderPlay(body: HTMLElement) {
    const hero = getHero(this.selection.heroId);
    const skin = getSkin(hero.id, this.selection.skinId);
    const mastery = this.masteryFor(hero.id);

    body.innerHTML = `
      <div class="play-layout">
        <section class="hero-grid-panel">
          <h3>Choose your pet</h3>
          <div class="hero-grid" data-hero-grid></div>
        </section>

        <section class="hero-detail">
          <div class="hero-stage">
            <canvas width="260" height="260" data-stage></canvas>
            <div class="hero-titles">
              <h2>${hero.name}</h2>
              <p>${hero.title} · ${hero.species}</p>
              <div class="role-chips"><span>${hero.role}</span><span>${hero.secondaryRole}</span><span>Difficulty ${'★'.repeat(hero.difficulty)}</span></div>
              ${mastery ? `<div class="mastery">Mastery ${mastery.mastery_level} · ${mastery.games} games · ${mastery.wins} wins</div>` : ''}
            </div>
          </div>

          <div class="skin-row" data-skins></div>

          <div class="ability-row" data-abilities></div>

          <p class="lore">${hero.lore}</p>
          <ul class="tips">${hero.tips.map((t) => `<li>${t}</li>`).join('')}</ul>
        </section>

        <section class="match-setup">
          <h3>Match setup</h3>
          <div class="setup-group">
            <label>Summoner spells</label>
            <div class="spell-picker" data-spells></div>
          </div>
          <div class="setup-group">
            <label>Bot difficulty</label>
            <div class="difficulty-picker">
              ${(['easy', 'medium', 'hard'] as BotLevel[])
                .map(
                  (d) => `<button data-diff="${d}" class="${this.selection.difficulty === d ? 'active' : ''}">
                    <b>${d[0].toUpperCase() + d.slice(1)}</b>
                    <small>${d === 'easy' ? 'Slow reactions, forgiving' : d === 'medium' ? 'Balanced, punishes mistakes' : 'Fast, coordinated, brutal'}</small>
                  </button>`
                )
                .join('')}
            </div>
          </div>
          <div class="setup-group">
            <label>Side</label>
            <div class="side-picker">
              <button data-side="blue" class="${this.selection.team === 'blue' ? 'active' : ''}">Blue</button>
              <button data-side="red" class="${this.selection.team === 'red' ? 'active' : ''}">Red</button>
            </div>
          </div>
          <button class="btn primary wide big" data-start>Start 5v5 match</button>
          <p class="setup-note">You will be joined by four allied bots against five enemy bots on the Menagerie Rift.</p>
        </section>
      </div>
    `;

    const grid = body.querySelector<HTMLElement>('[data-hero-grid]')!;
    for (const h of HEROES) {
      const owned = this.ownsHero(h.id);
      const card = document.createElement('button');
      card.className = `hero-card ${this.selection.heroId === h.id ? 'selected' : ''} ${owned ? '' : 'locked'}`;
      const canvas = document.createElement('canvas');
      canvas.width = 84;
      canvas.height = 84;
      card.appendChild(canvas);
      const label = document.createElement('span');
      label.innerHTML = `<b>${h.name}</b><small>${h.role}</small>`;
      card.appendChild(label);
      if (!owned) {
        const lock = document.createElement('i');
        lock.className = 'lock';
        lock.textContent = `${h.price}`;
        card.appendChild(lock);
      }
      card.addEventListener('click', () => {
        if (!owned) {
          this.tab = 'champions';
          this.render();
          return;
        }
        this.selection.heroId = h.id;
        if (!this.selection.skinId.startsWith(`${h.id}:`) || !this.ownsSkin(this.selection.skinId)) {
          this.selection.skinId = `${h.id}:default`;
        }
        this.cb.onSaveLoadout(this.selection);
        this.render();
      });
      grid.appendChild(card);
      const ctx = canvas.getContext('2d')!;
      drawPetPortrait(ctx, h.art, h.skins[0], 84, Math.random() * 10);
    }

    this.animatePortrait(body.querySelector<HTMLCanvasElement>('[data-stage]')!, hero, skin);

    const skinRow = body.querySelector<HTMLElement>('[data-skins]')!;
    for (const s of hero.skins) {
      const owned = this.ownsSkin(s.id);
      const btn = document.createElement('button');
      btn.className = `skin-chip ${s.rarity} ${this.selection.skinId === s.id ? 'active' : ''} ${owned ? '' : 'locked'}`;
      btn.innerHTML = `<span class="swatch" style="background:linear-gradient(135deg, ${s.palette.fur}, ${s.palette.accent})"></span><b>${s.name}</b><small>${owned ? s.rarity : `${s.price} ${s.currency}`}</small>`;
      btn.addEventListener('click', () => {
        if (!owned) {
          this.tab = 'champions';
          this.render();
          return;
        }
        this.selection.skinId = s.id;
        this.cb.onSaveLoadout(this.selection);
        this.render();
      });
      skinRow.appendChild(btn);
    }

    const abilities = body.querySelector<HTMLElement>('[data-abilities]')!;
    for (const def of hero.skills) {
      const card = document.createElement('div');
      card.className = 'ability-card';
      const icon = makeIcon(46, skin.spellColor, def.vfx);
      card.appendChild(icon);
      const text = document.createElement('div');
      text.innerHTML = `<b>${def.key} · ${def.name}</b><p>${def.description}</p>`;
      card.appendChild(text);
      abilities.appendChild(card);
    }

    const spellPicker = body.querySelector<HTMLElement>('[data-spells]')!;
    for (let slot = 0; slot < 2; slot++) {
      const wrap = document.createElement('div');
      wrap.className = 'spell-slot';
      for (const spell of SUMMONER_SPELLS) {
        const btn = document.createElement('button');
        btn.className = this.selection.spells[slot] === spell.id ? 'active' : '';
        btn.title = `${spell.name}: ${spell.description}`;
        btn.appendChild(makeIcon(34, spell.color, spell.icon));
        btn.addEventListener('click', () => {
          const other = this.selection.spells[1 - slot];
          if (other === spell.id) this.selection.spells[1 - slot] = this.selection.spells[slot];
          this.selection.spells[slot] = spell.id;
          this.cb.onSaveLoadout(this.selection);
          this.render();
        });
        wrap.appendChild(btn);
      }
      spellPicker.appendChild(wrap);
    }

    body.querySelectorAll<HTMLButtonElement>('[data-diff]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selection.difficulty = btn.dataset.diff as BotLevel;
        this.render();
      });
    });
    body.querySelectorAll<HTMLButtonElement>('[data-side]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selection.team = btn.dataset.side as 'blue' | 'red';
        this.render();
      });
    });
    body.querySelector('[data-start]')?.addEventListener('click', () => this.cb.onStart({ ...this.selection }));
  }

  private renderChampions(body: HTMLElement) {
    body.innerHTML = `
      <div class="collection">
        <div class="collection-head">
          <h3>Collection</h3>
          <p>Own <b>${this.ownedHeroes().length}</b> of ${HEROES.length} pets and <b>${this.state.unlocks.filter((u) => u.kind === 'skin').length}</b> skins.</p>
        </div>
        <div class="collection-list" data-collection></div>
      </div>
    `;
    const list = body.querySelector<HTMLElement>('[data-collection]')!;

    for (const hero of HEROES) {
      const owned = this.ownsHero(hero.id);
      const block = document.createElement('article');
      block.className = 'collection-hero';
      block.innerHTML = `
        <div class="ch-head">
          <canvas width="86" height="86"></canvas>
          <div>
            <h4>${hero.name} <small>${hero.title}</small></h4>
            <span>${hero.role} · ${hero.species}</span>
          </div>
          ${owned ? '<span class="owned-tag">Owned</span>' : `<button class="btn small" data-buy-hero="${hero.id}">${hero.price} coins</button>`}
        </div>
        <div class="ch-skins"></div>
      `;
      const canvas = block.querySelector('canvas')!;
      drawPetPortrait(canvas.getContext('2d')!, hero.art, hero.skins[0], 86, Math.random() * 10);

      const skins = block.querySelector<HTMLElement>('.ch-skins')!;
      for (const s of hero.skins) {
        const ownedSkin = this.ownsSkin(s.id);
        const card = document.createElement('div');
        card.className = `skin-card ${s.rarity} ${ownedSkin ? 'owned' : ''}`;
        const sc = document.createElement('canvas');
        sc.width = 110;
        sc.height = 110;
        card.appendChild(sc);
        drawPetPortrait(sc.getContext('2d')!, hero.art, s, 110, Math.random() * 10);
        const info = document.createElement('div');
        info.className = 'skin-info';
        info.innerHTML = `<b>${s.name}</b><em>${s.rarity}</em><p>${s.blurb}</p>`;
        card.appendChild(info);
        if (ownedSkin) {
          const tag = document.createElement('span');
          tag.className = 'owned-tag';
          tag.textContent = 'Owned';
          card.appendChild(tag);
        } else {
          const buy = document.createElement('button');
          buy.className = 'btn small';
          buy.textContent = `${s.price} ${s.currency}`;
          buy.addEventListener('click', async () => {
            buy.disabled = true;
            await this.cb.onPurchase('skin', s.id, hero.id, s.price, s.currency);
            buy.disabled = false;
          });
          card.appendChild(buy);
        }
        skins.appendChild(card);
      }

      block.querySelector<HTMLButtonElement>('[data-buy-hero]')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.disabled = true;
        await this.cb.onPurchase('hero', hero.id, hero.id, hero.price, 'coins');
        btn.disabled = false;
      });

      list.appendChild(block);
    }
  }

  private renderProfile(body: HTMLElement) {
    const p = this.state.profile;
    const winRate = p.wins + p.losses > 0 ? ((p.wins / (p.wins + p.losses)) * 100).toFixed(1) : '0.0';
    const history = this.state.history;

    body.innerHTML = `
      <div class="profile">
        <div class="stat-cards">
          <div class="stat-card"><b>${p.games_played}</b><span>Matches</span></div>
          <div class="stat-card"><b>${p.wins}</b><span>Wins</span></div>
          <div class="stat-card"><b>${winRate}%</b><span>Win rate</span></div>
          <div class="stat-card"><b>${TIER_LABEL[p.tier]}</b><span>${p.rank_points} RP</span></div>
        </div>

        <h3>Pet mastery</h3>
        <div class="mastery-grid">
          ${
            this.state.mastery.length === 0
              ? '<p class="empty">Play a match to start earning mastery.</p>'
              : this.state.mastery
                  .slice()
                  .sort((a, b) => b.points - a.points)
                  .map((m) => {
                    const hero = getHero(m.hero_id);
                    return `<div class="mastery-card"><b>${hero.name}</b><span>Mastery ${m.mastery_level}</span><small>${m.games} games · ${m.wins} wins · best KDA ${m.best_kda}</small></div>`;
                  })
                  .join('')
          }
        </div>

        <h3>Recent matches</h3>
        <div class="history">
          ${
            history.length === 0
              ? '<p class="empty">No matches recorded yet.</p>'
              : history
                  .map((h) => {
                    const self = h.self;
                    const win = self && self.team === h.winner;
                    const hero = self ? getHero(self.hero_id) : null;
                    const mins = Math.floor(h.duration_seconds / 60);
                    const secs = h.duration_seconds % 60;
                    return `<div class="history-row ${win ? 'win' : 'loss'}">
                      <span class="result">${win ? 'Victory' : 'Defeat'}</span>
                      <span class="hero">${hero ? hero.name : 'Unknown'}</span>
                      <span class="kda">${self ? `${self.kills} / ${self.deaths} / ${self.assists}` : '-'}</span>
                      <span class="cs">${self ? `${self.creep_score} CS` : ''}</span>
                      <span class="dur">${mins}:${String(secs).padStart(2, '0')}</span>
                      <span class="diff">${h.bot_difficulty}</span>
                    </div>`;
                  })
                  .join('')
          }
        </div>
      </div>
    `;
  }

  private renderLeaderboard(body: HTMLElement) {
    const rows = this.state.leaderboard;
    body.innerHTML = `
      <div class="leaderboard">
        <h3>Top summoners</h3>
        <table>
          <thead><tr><th>#</th><th>Summoner</th><th>Tier</th><th>RP</th><th>W / L</th><th>Win rate</th></tr></thead>
          <tbody>
            ${rows
              .map(
                (r, i) => `<tr class="${r.id === this.state.profile.id ? 'you' : ''}">
                  <td>${i + 1}</td>
                  <td>${r.display_name || r.username}</td>
                  <td>${TIER_LABEL[r.tier]}</td>
                  <td>${r.rank_points}</td>
                  <td>${r.wins} / ${r.losses}</td>
                  <td>${r.win_rate}%</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
        ${rows.length === 0 ? '<p class="empty">No ranked players yet. Be the first.</p>' : ''}
      </div>
    `;
  }

  private renderSettings(body: HTMLElement) {
    const s = this.state.settings;
    body.innerHTML = `
      <div class="settings-view">
        <h3>Controls</h3>
        <div class="setting-row">
          <div><span>Control scheme</span><small>Auto picks League-style mouse controls on PC and a joystick on touch devices.</small></div>
          <select data-set="control_scheme">
            <option value="auto">Auto detect</option>
            <option value="desktop">PC (mouse and keyboard)</option>
            <option value="mobile">Touch (joystick)</option>
          </select>
        </div>
        ${this.toggleRow('quick_cast', 'Quick cast', 'Abilities fire instantly at the cursor instead of showing a range indicator.')}
        ${this.toggleRow('camera_locked', 'Lock camera to hero', 'Keeps the camera centred on your pet.')}
        ${this.toggleRow('show_all_heroes_on_map', 'Show all heroes on minimap', 'Reveals every hero position on the map, allies and enemies.')}
        ${this.toggleRow('show_damage_numbers', 'Floating damage numbers', 'Shows combat text above units.')}

        <h3>Graphics and audio</h3>
        <div class="setting-row">
          <div><span>Graphics quality</span><small>Lower this on older phones for a smoother frame rate.</small></div>
          <select data-set="graphics_quality">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="ultra">Ultra</option>
          </select>
        </div>
        <div class="setting-row">
          <div><span>HUD scale</span><small>Make the buttons bigger or smaller.</small></div>
          <input type="range" min="0.8" max="1.4" step="0.05" value="${s.hud_scale}" data-set="hud_scale" />
        </div>
        <div class="setting-row">
          <div><span>Sound effects</span><small></small></div>
          <input type="range" min="0" max="1" step="0.05" value="${s.sfx_volume}" data-set="sfx_volume" />
        </div>
        <div class="setting-row">
          <div><span>Music</span><small></small></div>
          <input type="range" min="0" max="1" step="0.05" value="${s.music_volume}" data-set="music_volume" />
        </div>
      </div>
    `;

    body.querySelectorAll<HTMLSelectElement>('select[data-set]').forEach((el) => {
      const key = el.dataset.set as keyof GameSettings;
      el.value = String(s[key]);
      el.addEventListener('change', () => {
        (this.state.settings as unknown as Record<string, unknown>)[key] = el.value;
        this.cb.onSettings(this.state.settings);
      });
    });
    body.querySelectorAll<HTMLInputElement>('input[data-set]').forEach((el) => {
      const key = el.dataset.set as keyof GameSettings;
      el.addEventListener('change', () => {
        const value = el.type === 'checkbox' ? el.checked : Number(el.value);
        (this.state.settings as unknown as Record<string, unknown>)[key] = value;
        this.cb.onSettings(this.state.settings);
      });
    });
  }

  private toggleRow(key: keyof GameSettings, label: string, hint: string): string {
    return `
      <div class="setting-row">
        <div><span>${label}</span><small>${hint}</small></div>
        <input type="checkbox" data-set="${key}" ${this.state.settings[key] ? 'checked' : ''} />
      </div>
    `;
  }
}
