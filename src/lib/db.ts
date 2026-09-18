import { isSupabaseConfigured, supabase } from './supabase';
import { DEFAULT_SETTINGS, localVault } from './local-store';
import type {
  GameSettings,
  LeaderboardRow,
  LoadoutRow,
  MasteryRow,
  MatchHistoryEntry,
  MatchPayload,
  Profile,
  UnlockKind,
  UnlockRow
} from './types';

function online(): boolean {
  return isSupabaseConfigured && supabase !== null && localStorage.getItem('petrift.guest') !== '1';
}

export const db = {
  async loadProfile(userId: string): Promise<Profile | null> {
    if (!online()) {
      const vault = localVault.load();
      return vault?.profile ?? null;
    }
    const { data, error } = await supabase!.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    return (data as Profile) ?? null;
  },

  async updateProfile(userId: string, patch: Partial<Profile>): Promise<Profile | null> {
    if (!online()) return localVault.patchProfile(patch);
    const { data, error } = await supabase!.from('profiles').update(patch).eq('id', userId).select('*').single();
    if (error) throw error;
    return data as Profile;
  },

  async loadUnlocks(userId: string): Promise<UnlockRow[]> {
    if (!online()) return localVault.load()?.unlocks ?? [];
    const { data, error } = await supabase!.from('unlocks').select('kind, content_id, hero_id').eq('profile_id', userId);
    if (error) throw error;
    return (data as UnlockRow[]) ?? [];
  },

  async loadMastery(userId: string): Promise<MasteryRow[]> {
    if (!online()) return localVault.load()?.mastery ?? [];
    const { data, error } = await supabase!
      .from('hero_mastery')
      .select('hero_id, points, mastery_level, games, wins, best_kda')
      .eq('profile_id', userId);
    if (error) throw error;
    return (data as MasteryRow[]) ?? [];
  },

  async loadLoadouts(userId: string): Promise<LoadoutRow[]> {
    if (!online()) return localVault.load()?.loadouts ?? [];
    const { data, error } = await supabase!
      .from('loadouts')
      .select('hero_id, skin_id, spell_one, spell_two, item_build')
      .eq('profile_id', userId);
    if (error) throw error;
    return (data as LoadoutRow[]) ?? [];
  },

  async saveLoadout(userId: string, row: LoadoutRow): Promise<void> {
    if (!online()) {
      localVault.saveLoadout(row);
      return;
    }
    const { error } = await supabase!.from('loadouts').upsert({ profile_id: userId, ...row });
    if (error) throw error;
  },

  async loadSettings(userId: string): Promise<GameSettings> {
    if (!online()) return localVault.load()?.settings ?? { ...DEFAULT_SETTINGS };
    const { data, error } = await supabase!
      .from('settings')
      .select('control_scheme, camera_locked, quick_cast, show_damage_numbers, show_all_heroes_on_map, music_volume, sfx_volume, graphics_quality, hud_scale')
      .eq('profile_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(data as Partial<GameSettings>) } as GameSettings;
  },

  async saveSettings(userId: string, settings: GameSettings): Promise<void> {
    localVault.saveSettings(settings);
    if (!online()) return;
    const { error } = await supabase!.from('settings').upsert({ profile_id: userId, ...settings });
    if (error) throw error;
  },

  async purchase(kind: UnlockKind, contentId: string, heroId: string, price: number, currency: 'coins' | 'gems'): Promise<Profile | null> {
    if (!online()) return localVault.addUnlock({ kind, content_id: contentId, hero_id: heroId }, price, currency);
    const { data, error } = await supabase!.rpc('purchase_content', {
      p_kind: kind,
      p_content_id: contentId,
      p_hero_id: heroId,
      p_price: price,
      p_currency: currency
    });
    if (error) throw new Error(error.message.includes('insufficient') ? 'Not enough currency.' : error.message);
    return data as Profile;
  },

  async recordMatch(payload: MatchPayload): Promise<void> {
    localVault.recordMatch(payload);
    if (!online()) return;
    const { error } = await supabase!.rpc('record_match', { payload });
    if (error) throw error;
  },

  async matchHistory(userId: string, limit = 12): Promise<MatchHistoryEntry[]> {
    if (!online()) return (localVault.load()?.matches ?? []).slice(0, limit);
    const { data, error } = await supabase!
      .from('matches')
      .select('id, created_at, duration_seconds, winner, bot_difficulty, match_players(*)')
      .eq('host_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return ((data as unknown as Array<Record<string, unknown>>) ?? []).map((m) => {
      const players = (m.match_players as Array<Record<string, unknown>>) ?? [];
      const self = players.find((p) => p.profile_id === userId) ?? null;
      return {
        id: m.id as string,
        created_at: m.created_at as string,
        duration_seconds: m.duration_seconds as number,
        winner: m.winner as MatchHistoryEntry['winner'],
        bot_difficulty: m.bot_difficulty as MatchHistoryEntry['bot_difficulty'],
        self: self as unknown as MatchHistoryEntry['self']
      };
    });
  },

  async leaderboard(): Promise<LeaderboardRow[]> {
    if (!online()) return localVault.leaderboard();
    const { data, error } = await supabase!.from('leaderboard').select('*').limit(50);
    if (error) throw error;
    return (data as LeaderboardRow[]) ?? [];
  }
};
