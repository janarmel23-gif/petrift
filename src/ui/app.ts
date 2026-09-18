import { auth, type SessionUser } from '../lib/auth';
import { db } from '../lib/db';
import { DEFAULT_SETTINGS } from '../lib/local-store';
import type { GameSettings, MatchPayload, Profile } from '../lib/types';
import { GameController } from '../game/controller';
import { HEROES } from '../game/data/heroes';
import type { HeroPick, MatchConfig } from '../game/sim/world';
import { renderAuthView } from './auth-view';
import { LobbyView, type LobbySelection } from './menu-view';

const BOT_NAMES = [
  'Pouncey',
  'BiscuitK9',
  'NoodleTail',
  'SirWhiskers',
  'ByteNibbler',
  'MossyPaws',
  'CaptainYip',
  'ThunderNub',
  'PixelSnout',
  'GrumpyFluff',
  'LilMenace',
  'SnackBandit',
  'ZoomerPrime',
  'VelvetClaw',
  'DuchessPaw'
];

const SPELL_SETS: Record<string, [string, string]> = {
  Marksman: ['flash', 'heal'],
  Assassin: ['flash', 'ignite'],
  Mage: ['flash', 'barrier'],
  Tank: ['flash', 'teleport'],
  Fighter: ['flash', 'ignite'],
  Support: ['flash', 'heal']
};

export class App {
  private root: HTMLElement;
  private user: SessionUser | null = null;
  private profile: Profile | null = null;
  private settings: GameSettings = { ...DEFAULT_SETTINGS };
  private lobby: LobbyView | null = null;
  private game: GameController | null = null;
  private lastSelection: LobbySelection | null = null;
  private installPrompt: Event | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPrompt = e;
      this.lobby?.setInstallAvailable(true);
    });
    auth.onChange((user) => {
      if (!user && this.user && !this.user.guest) this.showAuth();
    });
  }

  async boot() {
    this.user = await auth.currentUser();
    if (this.user) await this.showLobby();
    else this.showAuth();
    document.getElementById('boot')?.classList.add('done');
  }

  private showAuth() {
    this.game?.destroy();
    this.game = null;
    this.lobby = null;
    this.user = null;
    this.profile = null;
    renderAuthView(this.root, async () => {
      this.user = await auth.currentUser();
      await this.showLobby();
    });
  }

  private async loadState() {
    if (!this.user) return;
    const [profile, unlocks, mastery, settings, history, leaderboard] = await Promise.all([
      db.loadProfile(this.user.id),
      db.loadUnlocks(this.user.id),
      db.loadMastery(this.user.id),
      db.loadSettings(this.user.id),
      db.matchHistory(this.user.id),
      db.leaderboard()
    ]);
    this.profile = profile;
    this.settings = settings;
    return { profile, unlocks, mastery, settings, history, leaderboard };
  }

  private async showLobby() {
    if (!this.user) {
      this.showAuth();
      return;
    }
    this.game?.destroy();
    this.game = null;
    this.root.innerHTML = '<div class="loading">Loading your den...</div>';

    let state;
    try {
      state = await this.loadState();
    } catch (error) {
      this.root.innerHTML = `<div class="error-screen"><h2>Could not load your profile</h2><p>${(error as Error).message}</p><button class="btn" id="retry">Retry</button></div>`;
      document.getElementById('retry')?.addEventListener('click', () => this.showLobby());
      return;
    }

    if (!state?.profile) {
      this.root.innerHTML = `<div class="error-screen"><h2>Profile missing</h2><p>Your account has no profile row yet. Sign out and back in, or run the Supabase schema.</p><button class="btn" id="out">Sign out</button></div>`;
      document.getElementById('out')?.addEventListener('click', async () => {
        await auth.logout();
        this.showAuth();
      });
      return;
    }

    this.root.innerHTML = '';
    this.lobby = new LobbyView(
      this.root,
      {
        profile: state.profile,
        unlocks: state.unlocks,
        mastery: state.mastery,
        settings: state.settings,
        history: state.history,
        leaderboard: state.leaderboard,
        guest: this.user.guest
      },
      {
        onStart: (selection) => this.startMatch(selection),
        onLogout: async () => {
          await auth.logout();
          this.showAuth();
        },
        onPurchase: async (kind, contentId, heroId, price, currency) => {
          try {
            const updated = await db.purchase(kind, contentId, heroId, price, currency);
            if (updated) this.profile = updated;
            const fresh = await this.loadState();
            if (fresh) {
              this.lobby?.updateState({
                profile: fresh.profile ?? undefined,
                unlocks: fresh.unlocks,
                mastery: fresh.mastery,
                history: fresh.history,
                leaderboard: fresh.leaderboard
              });
            }
          } catch (error) {
            window.alert((error as Error).message);
          }
        },
        onSettings: async (settings) => {
          this.settings = settings;
          if (this.user) await db.saveSettings(this.user.id, settings);
        },
        onSaveLoadout: async (selection) => {
          this.lastSelection = selection;
          if (!this.user) return;
          await db.saveLoadout(this.user.id, {
            hero_id: selection.heroId,
            skin_id: selection.skinId,
            spell_one: selection.spells[0],
            spell_two: selection.spells[1],
            item_build: []
          });
        },
        onInstall: async () => {
          const prompt = this.installPrompt as unknown as { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } | null;
          if (!prompt) {
            window.alert('On iPhone or iPad use the Share menu and choose "Add to Home Screen".');
            return;
          }
          await prompt.prompt();
          await prompt.userChoice;
          this.installPrompt = null;
          this.lobby?.setInstallAvailable(false);
        }
      }
    );
    this.lobby.setInstallAvailable(Boolean(this.installPrompt));
  }

  private buildMatchConfig(selection: LobbySelection): MatchConfig {
    const pool = HEROES.map((h) => h.id).filter((id) => id !== selection.heroId);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);

    const makeBot = (index: number): HeroPick => {
      const heroId = pool[index % pool.length];
      const hero = HEROES.find((h) => h.id === heroId)!;
      return {
        heroId,
        skinId: `${heroId}:default`,
        name: names[index % names.length],
        isBot: true,
        spells: SPELL_SETS[hero.role] ?? ['flash', 'ignite']
      };
    };

    const playerPick: HeroPick = {
      heroId: selection.heroId,
      skinId: selection.skinId,
      name: this.profile?.display_name || this.profile?.username || 'You',
      isBot: false,
      spells: selection.spells
    };

    const allies: HeroPick[] = [playerPick, ...[0, 1, 2, 3].map((i) => makeBot(i))];
    const enemies: HeroPick[] = [4, 5, 6, 7, 8].map((i) => makeBot(i));

    return {
      playerTeam: selection.team,
      difficulty: selection.difficulty,
      blue: selection.team === 'blue' ? allies : enemies,
      red: selection.team === 'blue' ? enemies : allies,
      seed: (Date.now() ^ Math.floor(Math.random() * 0xffffff)) >>> 0
    };
  }

  private startMatch(selection: LobbySelection) {
    this.lastSelection = selection;
    this.root.innerHTML = '<div class="game-shell"></div>';
    const shell = this.root.querySelector<HTMLElement>('.game-shell')!;
    const config = this.buildMatchConfig(selection);

    this.game = new GameController(shell, config, this.settings, {
      onFinish: (payload) => this.recordMatch(payload),
      onExit: () => {
        this.game?.destroy();
        this.game = null;
        void this.showLobby();
      },
      onRestart: () => {
        this.game?.destroy();
        this.game = null;
        this.startMatch(selection);
      },
      onSettingChange: async (settings) => {
        this.settings = settings;
        if (this.user) await db.saveSettings(this.user.id, settings);
      }
    });
    this.game.start();

    if (document.documentElement.requestFullscreen && window.matchMedia('(pointer: coarse)').matches) {
      document.documentElement.requestFullscreen().catch(() => undefined);
      const orientation = (screen as unknown as { orientation?: { lock?: (o: string) => Promise<void> } }).orientation;
      orientation?.lock?.('landscape').catch(() => undefined);
    }
  }

  private async recordMatch(payload: MatchPayload) {
    try {
      await db.recordMatch(payload);
    } catch (error) {
      console.warn('Match not recorded:', (error as Error).message);
    }
  }
}
