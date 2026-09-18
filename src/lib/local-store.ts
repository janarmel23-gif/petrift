import type { GameSettings, LeaderboardRow, LoadoutRow, MasteryRow, MatchHistoryEntry, MatchPayload, Profile, UnlockRow } from './types';

const KEY = 'petrift.local.v1';

export interface LocalVault {
  profile: Profile;
  unlocks: UnlockRow[];
  mastery: MasteryRow[];
  loadouts: LoadoutRow[];
  matches: MatchHistoryEntry[];
  settings: GameSettings;
}

export const DEFAULT_SETTINGS: GameSettings = {
  control_scheme: 'auto',
  camera_locked: true,
  quick_cast: false,
  show_damage_numbers: true,
  show_all_heroes_on_map: true,
  music_volume: 0.55,
  sfx_volume: 0.8,
  graphics_quality: 'high',
  hud_scale: 1
};

const STARTER_HEROES = ['bolt', 'mochi', 'bruno', 'nimbus'];

function freshVault(username: string): LocalVault {
  return {
    profile: {
      id: 'guest-' + Math.random().toString(36).slice(2, 10),
      username,
      display_name: username,
      avatar_hero: 'bolt',
      account_level: 1,
      account_xp: 0,
      coins: 6500,
      gems: 150,
      rank_points: 0,
      tier: 'warren',
      wins: 0,
      losses: 0,
      games_played: 0
    },
    unlocks: [
      ...STARTER_HEROES.map((h) => ({ kind: 'hero' as const, content_id: h, hero_id: h })),
      ...STARTER_HEROES.map((h) => ({ kind: 'skin' as const, content_id: `${h}:default`, hero_id: h }))
    ],
    mastery: [],
    loadouts: [],
    matches: [],
    settings: { ...DEFAULT_SETTINGS }
  };
}

function read(): LocalVault | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalVault;
    if (!parsed.profile) return null;
    parsed.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
    return parsed;
  } catch {
    return null;
  }
}

function write(vault: LocalVault) {
  try {
    localStorage.setItem(KEY, JSON.stringify(vault));
  } catch {
    return;
  }
}

export const localVault = {
  exists(): boolean {
    return read() !== null;
  },
  create(username: string): LocalVault {
    const vault = freshVault(username);
    write(vault);
    return vault;
  },
  load(): LocalVault | null {
    return read();
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      return;
    }
  },
  save(vault: LocalVault) {
    write(vault);
  },
  patchProfile(patch: Partial<Profile>): Profile | null {
    const vault = read();
    if (!vault) return null;
    vault.profile = { ...vault.profile, ...patch };
    write(vault);
    return vault.profile;
  },
  saveSettings(settings: GameSettings) {
    const vault = read();
    if (!vault) return;
    vault.settings = settings;
    write(vault);
  },
  saveLoadout(row: LoadoutRow) {
    const vault = read();
    if (!vault) return;
    const idx = vault.loadouts.findIndex((l) => l.hero_id === row.hero_id);
    if (idx >= 0) vault.loadouts[idx] = row;
    else vault.loadouts.push(row);
    write(vault);
  },
  addUnlock(row: UnlockRow, price: number, currency: 'coins' | 'gems'): Profile | null {
    const vault = read();
    if (!vault) return null;
    if (vault.unlocks.some((u) => u.kind === row.kind && u.content_id === row.content_id)) return vault.profile;
    const balance = currency === 'gems' ? vault.profile.gems : vault.profile.coins;
    if (balance < price) throw new Error('Not enough currency.');
    if (currency === 'gems') vault.profile.gems -= price;
    else vault.profile.coins -= price;
    vault.unlocks.push(row);
    write(vault);
    return vault.profile;
  },
  recordMatch(payload: MatchPayload): void {
    const vault = read();
    if (!vault) return;
    const self = payload.players.find((p) => !p.is_bot) ?? null;
    const won = self !== null && self.team === payload.winner;
    vault.profile.games_played += 1;
    vault.profile.wins += won ? 1 : 0;
    vault.profile.losses += won ? 0 : 1;
    vault.profile.rank_points = Math.max(0, vault.profile.rank_points + (won ? 24 : -16));
    vault.profile.account_xp += payload.account_xp;
    vault.profile.coins += payload.coins_earned;
    vault.profile.account_level = Math.max(vault.profile.account_level, 1 + Math.floor(vault.profile.account_xp / 1000));
    vault.profile.tier = tierFor(vault.profile.rank_points);
    if (self) {
      const entry = vault.mastery.find((m) => m.hero_id === self.hero_id);
      const kda = (self.kills + self.assists) / Math.max(1, self.deaths);
      if (entry) {
        entry.points += won ? 320 : 140;
        entry.games += 1;
        entry.wins += won ? 1 : 0;
        entry.best_kda = Math.max(entry.best_kda, Number(kda.toFixed(2)));
        entry.mastery_level = Math.min(10, 1 + Math.floor(entry.points / 1800));
      } else {
        vault.mastery.push({
          hero_id: self.hero_id,
          points: won ? 320 : 140,
          games: 1,
          wins: won ? 1 : 0,
          best_kda: Number(kda.toFixed(2)),
          mastery_level: 1
        });
      }
    }
    vault.matches.unshift({
      id: 'local-' + Date.now().toString(36),
      created_at: new Date().toISOString(),
      duration_seconds: payload.duration_seconds,
      winner: payload.winner,
      bot_difficulty: payload.bot_difficulty,
      self
    });
    vault.matches = vault.matches.slice(0, 40);
    write(vault);
  },
  leaderboard(): LeaderboardRow[] {
    const vault = read();
    const names = ['ShadowPounce', 'MeowMercy', 'BarkStorm', 'TinyTitan', 'FeatherFang', 'QuillQueen', 'ZoomiesGG', 'PawsOfFate', 'SnoutSniper', 'WhiskerWar'];
    const rows: LeaderboardRow[] = names.map((n, i) => ({
      id: 'ai-' + i,
      username: n.toLowerCase(),
      display_name: n,
      avatar_hero: ['bolt', 'mochi', 'bruno', 'nimbus', 'blaze', 'rex', 'hammer', 'shelly', 'vex', 'luna'][i % 10],
      tier: tierFor(2900 - i * 210),
      rank_points: 2900 - i * 210,
      wins: 180 - i * 9,
      losses: 60 + i * 5,
      account_level: 120 - i * 6,
      win_rate: Number(((180 - i * 9) / (240 - i * 4) * 100).toFixed(1))
    }));
    if (vault && vault.profile.games_played > 0) {
      rows.push({
        id: vault.profile.id,
        username: vault.profile.username,
        display_name: vault.profile.display_name,
        avatar_hero: vault.profile.avatar_hero,
        tier: vault.profile.tier,
        rank_points: vault.profile.rank_points,
        wins: vault.profile.wins,
        losses: vault.profile.losses,
        account_level: vault.profile.account_level,
        win_rate: Number(((vault.profile.wins / Math.max(1, vault.profile.wins + vault.profile.losses)) * 100).toFixed(1))
      });
    }
    return rows.sort((a, b) => b.rank_points - a.rank_points);
  }
};

export function tierFor(rp: number): Profile['tier'] {
  if (rp >= 2600) return 'legend';
  if (rp >= 2100) return 'mythic';
  if (rp >= 1650) return 'diamond';
  if (rp >= 1200) return 'platinum';
  if (rp >= 800) return 'gold';
  if (rp >= 450) return 'silver';
  if (rp >= 180) return 'bronze';
  return 'warren';
}
