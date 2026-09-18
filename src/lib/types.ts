export type TeamSide = 'blue' | 'red';
export type BotLevel = 'easy' | 'medium' | 'hard';
export type UnlockKind = 'hero' | 'skin';
export type RankTier = 'warren' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'mythic' | 'legend';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_hero: string;
  account_level: number;
  account_xp: number;
  coins: number;
  gems: number;
  rank_points: number;
  tier: RankTier;
  wins: number;
  losses: number;
  games_played: number;
}

export interface UnlockRow {
  kind: UnlockKind;
  content_id: string;
  hero_id: string | null;
}

export interface MasteryRow {
  hero_id: string;
  points: number;
  mastery_level: number;
  games: number;
  wins: number;
  best_kda: number;
}

export interface LoadoutRow {
  hero_id: string;
  skin_id: string;
  spell_one: string;
  spell_two: string;
  item_build: string[];
}

export interface GameSettings {
  control_scheme: 'auto' | 'desktop' | 'mobile';
  camera_locked: boolean;
  quick_cast: boolean;
  show_damage_numbers: boolean;
  show_all_heroes_on_map: boolean;
  music_volume: number;
  sfx_volume: number;
  graphics_quality: 'low' | 'medium' | 'high' | 'ultra';
  hud_scale: number;
}

export interface LeaderboardRow {
  id: string;
  username: string;
  display_name: string;
  avatar_hero: string;
  tier: RankTier;
  rank_points: number;
  wins: number;
  losses: number;
  account_level: number;
  win_rate: number;
}

export interface MatchPlayerPayload {
  slot: number;
  team: TeamSide;
  hero_id: string;
  skin_id: string;
  display_name: string;
  is_bot: boolean;
  bot_difficulty: BotLevel | null;
  kills: number;
  deaths: number;
  assists: number;
  creep_score: number;
  gold_earned: number;
  hero_level: number;
  damage_dealt: number;
  damage_taken: number;
  healing_done: number;
  turrets_destroyed: number;
  largest_multikill: number;
  items: string[];
}

export interface MatchPayload {
  mode: string;
  bot_difficulty: BotLevel;
  map_id: string;
  duration_seconds: number;
  winner: TeamSide | null;
  surrendered: boolean;
  blue_kills: number;
  red_kills: number;
  account_xp: number;
  coins_earned: number;
  players: MatchPlayerPayload[];
}

export interface MatchHistoryEntry {
  id: string;
  created_at: string;
  duration_seconds: number;
  winner: TeamSide | null;
  bot_difficulty: BotLevel;
  self: MatchPlayerPayload | null;
}
