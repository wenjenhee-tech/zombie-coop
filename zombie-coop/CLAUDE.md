# CLAUDE.md

Guidance for Claude Code working in this repo. `zombie-coop` is a real-time multiplayer top-down zombie survival game (Vue + Phaser client, Node + Socket.io + MongoDB server).

## Running

Two processes, both required:
- **Server** (`game-server/`): `node server.js` — port 5000, needs MongoDB at `mongodb://127.0.0.1:27017/zombie_coop`.
- **Client** (`game-client/`): `npm run dev` / `npm run build`.
- **First-time DB**: `node init_db.js` (applies `database/game_schema.json`).

No test suite (`npm test` is a placeholder).

## Architecture

- **`game-client/src/store.js`** — single global state: a Vue `reactive()` object that also holds the live socket (`store.socket`, connects to `localhost:5000` on import). All Vue components and Phaser scenes read/write it. Screen flow via `store.currentScreen`: `login → lobby → room_waiting → game (→ vote/spectator overlays) → summary → leaderboard → lobby`.
- **Vue + Phaser**: `GameComponent.vue` mounts Phaser into `#phaser-container`; Vue HUD overlays the canvas (`pointer-events: none`). `GameScene.update()` writes cooldown ratios (`primaryCDReadyRatio` etc.) to the store every frame for the HUD skill buttons.
- **Server-authoritative loop**: a `setInterval(…, 50)` in `server.js` is the single source of truth for zombie spawning (boss waves 5/10 spawn exactly 1), pathing (chase nearest alive player; honors `tauntActive` and per-zombie `effects.freeze`/`slow`), mine triggers, wave-clear detection, and **auto-revive on wave clear** (revives all dead via `player_revived` hp=50 if any player alive, before `intermission_start` — replaces old manual revive). Clients only render zombies from broadcasts and emit `zombie_damaged` on bullet hits.
- **Room state**: in-memory `activeRooms` is authoritative during play; MongoDB `rooms` is written async for persistence and may lag.
- **Host role** (first player): `host_ready_to_spawn`, `start_next_wave`, `finalize_vote`.

## Entities

- **Players**: base `Player.js` (extends Arcade.Sprite); 4 classes in `PlayerClasses.js` (Gunner/Tank/Medic/Trapper) override stats + skills. Keybinds: `Q`→`usePrimarySkill`, `E`→`useSecondarySkill`, `R`→`useTertiarySkill` (each cooldown-guarded), WASD move. Passives (Gunner Adrenaline, Medic Auto-Defib) auto-fire in `passiveTick()`.
- **Zombies**: types + stats in `Zombie.js` `setupStats()` (walker/runner/brute/spitter/screamer/exploder/hordeking). Behavior notes: spitter ranged-spits on host only; screamer splits into 3 walkers on server death; exploder suicide-AoEs; hordeking is the wave-10 boss (500 HP). **HP must stay in sync** between `Zombie.setupStats` (client) and the server `HP_TABLE`.
- **Rendering** is texture-atlas based (no per-frame Phaser.Graphics): all sprites use 48px atlases generated in `PixelArtTextures.js` (`player_<class>` / `zombie_<type>` keys, walk anims `<key>_walk_<dir>`). Zombies scale via `setScale(size/48)`. To restyle a model, edit its `draw*` function there.
- **Buffs**: string IDs in `player.activeBuffs[]` via `hasBuff`/`addBuff` (idempotent), checked inline in movement/damage/shoot. Powerup vote → winning buff applied in `next_wave_started` listener (GameScene.js). Server guards: `voteResolved` (rejects late `cast_vote`), `start_next_wave` no-op if `isWaveActive`.

## Socket contract (non-obvious validations)

- `zombie_damaged` — server validates with `isDead` flag (idempotent across clients); screamer death triggers the 3-walker split here.
- `heal_aoe` / `mine_placed` — sender class must be Medic / Trapper respectively, else dropped.
- `taunt_active` — sets `room.tauntActive` (pathing override) + relays.
- `player_died` — records `deathTime/deathX/deathY`, broadcasts position, fires `game_over` only when **all** players dead.
- `zombie_spawn`/`zombie_update` and `revive_request` are **removed/empty stubs** — do not rely on them.

## MongoDB collections

`users` (nickname unique, passwordHash, stats), `rooms` (code, host, difficulty, status, currentWave, players), `scores` (per-game, written on `game_over`), `telemetry` (per-wave APM/accuracy → AI difficulty service `localhost:8000/predict`), `ai_difficulty` (service response).

## Common Pitfalls

- **Client-side zombie mutations are silently lost.** Don't call `zombie.takeDamage()` from a client script — the server's `room.zombies` won't know. Route through `zombie_damaged` or add an authoritative server handler.
- **freeze/slow must be enforced server-side.** Setting velocity 0 in `Zombie.update()` is overwritten by the next `zombie_updated` broadcast. Add to `zombie.effects` server-side and check it in the pathing loop.
- **Boss waves are special-cased in two places** (`start_next_wave` and `host_ready_to_spawn`) — update both when changing the wave-count formula.
- **Player HP is purely client-side** (server stores only nickname/class/isAlive/x/y/kills/score/death-info). Only sync point is `player_died` at hp ≤ 0.
- **E is secondary skill, not revive** — revive is automatic on wave clear. Don't re-add an E listener in GameScene without removing it from Player's `addKeys`.
- **Auto-revive runs every 50ms tick** while wave-clear holds; it's safe because `isAlive=true` is set before emitting. Resetting `isAlive` server-side mid-intermission would re-fire `player_revived`.
- **Zombies ignore `wallData` server-side** (pathing doesn't reference it) — they clip through walls/props; `wallData` only blocks players client-side. Fixing this is a deferred gameplay feature.
