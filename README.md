# PetRift: Legends of the Menagerie

A modern 5v5 MOBA built for the browser where every champion is a pet. Procedurally drawn and animated heroes, animated abilities, a full three-lane map with jungle and objectives, an item shop, skins, bots on three difficulties, and a Supabase backend for accounts, progression and match history.

It runs on PC with League-of-Legends style mouse controls, and on tablets and phones with a Mobile-Legends style joystick and skill wheel. It installs to the home screen as a PWA on Android, iOS and desktop.

---

## Features

**Gameplay**
- 5v5 matches on the Menagerie Rift: three lanes, full jungle, river, brush, drake and ancient objectives
- 13 pet champions, each with a passive plus four abilities (Q, W, E, R) with animated visual effects
- 52 items across starter, boots, attack, magic, defense, support, jungle and consumable categories, with build paths, unique passives and actives
- 52 skins with unique palettes, weapons, auras and particle effects
- 8 summoner spells, minion waves, super minions, turret ramp-up damage, inhibitors and a nexus
- Fog of war, brush stealth, wards, gold and experience, 18 hero levels, skill points
- Bots on easy, medium and hard with different reaction times, aim accuracy, aggression, awareness, ability usage and item builds

**Controls**
- PC: right-click to move and attack, `Q W E R` abilities, `D F` summoner spells, `1-7` items, `B` recall, `P` shop, `Tab` scoreboard, `A` attack-move, `S` stop, `Y` camera lock, `Space` centre camera, `Ctrl+Q/W/E/R` to level abilities, mouse wheel to zoom, screen-edge panning
- Touch: analog joystick, large attack button, radial skill buttons that you drag to aim and release to fire, tap to auto-target
- Control scheme auto-detects, and can be forced to PC or touch in Settings

**Minimap**
- Live minimap with terrain, structures, wards, minions and every hero position (the "show all heroes" option is on by default)
- Click to move the camera, right-click or shift-click to command your hero, ctrl-click to ping

**Accounts and data**
- Email and password sign in and registration with validation and password strength
- Guest play without an account (progress stays on that device)
- Profiles, currencies, hero and skin unlocks, per-hero mastery, loadouts, settings sync, match history and a leaderboard

---

## Quick start

You need **Node.js 18 or newer**. It is not currently installed on this machine, so install it first from https://nodejs.org (LTS), then reopen your terminal.

```bash
npm install
```

```bash
npm run dev
```

Open the printed URL. The dev server binds to your network too, so you can open the same URL on your phone or tablet to test touch controls.

To build and preview a production bundle:

```bash
npm run build
```

```bash
npm run preview
```

---

## Supabase setup

1. Create a project at https://supabase.com.
2. In the dashboard open **SQL Editor**, paste the contents of `supabase/schema.sql` and run it. This creates the tables, row level security policies, the new-user trigger, the `record_match` and `purchase_content` functions and the leaderboard view.
3. In **Authentication → Sign In / Providers**, make sure **Email** is enabled. It is the only sign-in method the game uses.
4. Copy `.env.example` to `.env` and fill in the two values from **Project Settings → API**:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

5. Restart the dev server.

If `.env` is missing, registration and sign-in are disabled and only guest play works. Guest progress is stored in the browser on that device.

The static content catalogue (heroes, abilities, skins, items, the map) lives in code under `src/game/data` so matches run with no network round trips. Supabase stores player state only: profiles, settings, unlocks, mastery, loadouts, matches and match players.

---

## Installing on a phone or tablet

The app ships a web manifest and a service worker, so it installs like a native app.

- **Android / Chrome / Edge**: open the site, then use the "Install app" button in the lobby header, or the browser's "Install app" menu item.
- **iOS / Safari**: open the site, tap Share, then "Add to Home Screen". iOS does not fire the install prompt event, so the button explains this.
- **Desktop Chrome / Edge**: the install icon appears in the address bar.

Once installed it launches fullscreen in landscape and works offline for everything except Supabase sync.

---

## Deploying to GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and publishes the game on every push to `main`.

1. **Settings → Pages**: set **Source** to **GitHub Actions**.
2. **Settings → Secrets and variables → Actions**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. If either is missing, the run shows a "Supabase not connected" warning and the site runs in offline guest mode.
3. Push to `main`, or run **Actions → Deploy to GitHub Pages → Run workflow**.
4. In Supabase **Authentication → URL Configuration**, add `https://<you>.github.io/<repo>/**` to **Redirect URLs** so confirmation and password-reset emails land on the game.

The site is served at `https://<you>.github.io/<repo>/`. `vite.config.ts` uses `base: './'`, so the same `dist/` also works on Vercel or Netlify (build command `npm run build`, output `dist`, with the two variables set as environment variables).

A service worker caches the app shell, so after deploying an update players get an in-app "new version ready" prompt.

---

## Project layout

```
index.html                   app shell and boot screen
scripts/gen-icons.mjs        generates PWA PNG icons with zero dependencies
supabase/schema.sql          tables, RLS policies, triggers, RPCs, leaderboard view
src/
  main.ts                    entry point, service worker registration
  lib/                       supabase client, auth, database access, local fallback vault
  ui/                        app router, login and register screen, lobby
  styles/                    global, auth, lobby and HUD stylesheets
  game/
    core/                    math, RNG, input, A* pathfinding
    data/                    heroes and abilities, items, skins, map generation
    sim/                     units, world simulation, abilities, combat, bot AI
    render/                  camera, procedural pet renderer, terrain, effects, minimap, icons
    ui/hud.ts                in-game HUD, shop, scoreboard, touch controls
    controller.ts            game loop and input binding
```

---

## Champion roster

| Pet | Species | Role | Notes |
| --- | --- | --- | --- |
| Bolt | Corgi | Marksman | Piercing shots, thunder cone ultimate |
| Mochi | Cat | Assassin | Stealth, pounce reset on takedown |
| Bruno | Bulldog | Tank | Knock-up, taunt barrier, team shield roar |
| Nimbus | Rabbit | Support | Passive team regen, heals, team-wide moonfall |
| Blaze | Fox | Mage | Burn on every ability, nine-tails inferno |
| Rex | Parrot | Marksman | Blind squall, long-range feather barrage |
| Hammer | Hamster | Fighter | Stores damage taken, giant ball ultimate |
| Shelly | Turtle | Tank | Reflect shell, tidal dome that protects allies |
| Vex | Ferret | Assassin | Bleed slashes, invisibility, missing-health execute |
| Luna | Owl | Mage | Piercing beam, silence, eclipse root |
| Quill | Hedgehog | Fighter | Thorns, spike field, whirling quill storm |
| Koi | Axolotl | Support | Healing spring, carries an ally on her dash |
| Tank | Pug | Tank | Headbutt stun, chomp root, living wall ultimate |

---

## Notes and limits

- Matches are single-player against bots. There is no real-time multiplayer netcode; adding it would mean an authoritative server, which this project does not include.
- Audio settings exist in the UI and are stored, but no audio assets are bundled.
- Art is drawn procedurally on canvas rather than from sprite sheets, which keeps the bundle small and lets skins recolour every pet part, but it is stylised rather than photoreal.
