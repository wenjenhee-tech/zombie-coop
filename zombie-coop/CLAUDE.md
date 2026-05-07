# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`zombie-coop` is a real-time multiplayer top-down zombie survival game. Players join rooms and cooperate to survive wave-based zombie attacks.

## Running the Project

Two processes must run simultaneously:

**Backend (game-server/):**
```bash
cd game-server
node server.js
```
Runs on port 5000. Requires MongoDB running locally at `mongodb://127.0.0.1:27017/zombie_coop`.

**Frontend (game-client/):**
```bash
cd game-client
npm run dev    # Vite dev server
npm run build  # Production build
```

**Database setup (first time only):**
```bash
cd game-server
node init_db.js
```
Reads schema from `game-server/database/game_schema.json` and applies MongoDB validation rules and indexes.

There is no test suite. `npm test` in `game-server` is a placeholder.

## Architecture

### State Management & Socket Connection

`game-client/src/store.js` is the single global state for the entire frontend — a Vue `reactive()` object that also holds the live Socket.io socket instance (`store.socket`). All Vue components and Phaser scenes read/write from this store. The socket connects to `http://localhost:5000` on module import.

Screen flow is controlled by `store.currentScreen`:
```
login → lobby → room_waiting → game (→ vote overlay) (→ spectator overlay) → summary → leaderboard → lobby
```
After `summary`, "Chơi lại" returns to `lobby`. From `leaderboard`, "Chơi ngay" also returns to `lobby` (not login — the user stays logged in).

### Vue + Phaser Integration

`GameComponent.vue` mounts a Phaser game into `#phaser-container` via `onMounted`. Vue UI sits absolutely positioned on top of the Phaser canvas using `pointer-events: none`. The HUD includes:
- **Health bar** (bottom-left)
- **Skill cooldown buttons** (below health bar) — two buttons (Q / E or Q / Passive) showing skill name, a fill bar reflecting `store.playerStats.primaryCDReadyRatio` / `secondaryCDReadyRatio`, and seconds remaining. These ratios + raw cooldown durations (`primaryCooldownMs`, `secondaryCooldownMs`) are written to the store every frame from `GameScene.update()`.

### Server-Authoritative Game Loop

A `setInterval(..., 50)` in `server.js` is the single source of truth for:
- Zombie spawning (per-wave count + type pool, boss waves 5/10 spawn exactly 1 zombie)
- Zombie pathing (chase nearest alive player; honors `tauntActive` override and per-zombie `effects.freeze` / `effects.slow`)
- Mine triggers (Trapper mines stored in `room.mines`, server detects overlap and applies damage + effect)
- Wave clear detection (`zombiesSpawned >= zombiesToSpawn && Object.keys(room.zombies).length === 0`)
- **Auto-revive on wave clear**: immediately before emitting `intermission_start`, server revives all dead players if `alivePlayers.length > 0`. Each dead player is broadcast via `player_revived` (with `reviverId: null`, `hp: 50`). This replaces the old manual hold-E revive system.

The legacy `zombie_spawn` / `zombie_update` socket events are **empty stubs** — clients no longer drive zombies. Clients only:
- Render zombies from `zombie_spawned` / `zombie_updated` broadcasts (set position via `setPosition`, ignoring local velocity).
- Emit `zombie_damaged` when their bullet hits a zombie; server validates with `isDead` flag (idempotent — multiple clients can send for the same zombie without double-counting).

The "host" still exists for a few things: `host_ready_to_spawn` (signals server to start spawning when host's GameScene is ready), `start_next_wave` (only host can advance the wave after intermission), and `finalize_vote` (only host can force-resolve a vote countdown).

### Server-Side Room State

`server.js` maintains an in-memory `activeRooms` object for real-time socket operations. MongoDB (`rooms` collection) is written to asynchronously for persistence but is **not** the authoritative source during gameplay — the in-memory object is. Room state written to MongoDB may lag behind.

### Player Class System

`Player.js` is the base class (extends `Phaser.Physics.Arcade.Sprite`). The four classes in `PlayerClasses.js` override stats, implement skills, and each override `drawPlayer()` for a distinct visual shape:

| Class   | Role    | Visual shape         | Key bindings                        |
|---------|---------|----------------------|-------------------------------------|
| Gunner  | DPS     | Blue circle + barrel | Q = Rain of Bullets / Passive = Adrenaline Rush |
| Tank    | Tank    | Red square (2-layer) | Q = Shield Wall / E = Taunt         |
| Medic   | Support | Green circle + cross | Q = Emergency Kit / Passive = Auto-Defib |
| Trapper | Control | Orange circle + X    | Q = Mine Field / E = Freeze Trap    |

**Skill keybindings (Player.js `addKeys`):**
- `Q` → `primarySkill` → `usePrimarySkill()` (with `primaryCooldown` guard)
- `E` → `secondarySkill` → `useSecondarySkill()` (with `secondaryCooldown` guard)
- WASD → movement

Passive skills (Gunner's Adrenaline Rush, Medic's Auto-Defib) are triggered automatically in `passiveTick(time)` — the `secondaryCooldown` tracks their auto-trigger cooldown, not a key press.

Player graphics are drawn procedurally with `Phaser.Graphics`. Each subclass in `PlayerClasses.js` overrides `drawPlayer()` — do not rely on the base class `drawPlayer()` (plain circle) for subclasses. The skill-active state redraws the player inline (e.g. Gunner's Rain of Bullets brightens the body; Tank's Shield Wall glows).

### Zombie Types

Defined in `Zombie.js` `setupStats()` + rendered in type-specific private draw methods (`_drawWalker`, `_drawRunner`, `_drawBrute`, `_drawSpitter`, `_drawScreamer`, `_drawExploder`, `_drawHordeking`) called by the public `drawZombie()` dispatcher:

| Type       | Visual          | Behavior notes |
|------------|-----------------|----------------|
| walker     | Dark-red rect, eyes, jagged mouth | Default chaser |
| runner     | Maroon rect, speed blur lines | Fast, low HP |
| brute      | Dark-brown large rect, muscle ridges, glow eyes | Slow, high HP |
| spitter    | Green rect, toxic drops around | Ranged spit — fires on host only |
| screamer   | Yellow 8-point star, O-mouth | Low HP; splits into 3 walkers on server death |
| exploder   | Purple circle, radiating lines | Suicide AoE when reaching player |
| hordeking  | Black rect, gold crown, large red eyes, aura | Boss wave 10, 500 HP |

HP must stay in sync between `Zombie.setupStats` (client) and `HP_TABLE` (server, ~line 543).

### Buff System

Buffs are string IDs stored in `player.activeBuffs[]`. `player.hasBuff(id)` and `player.addBuff(id)` manage them (addBuff is idempotent — won't duplicate). Active buffs are checked inline in movement (`Speed Boost`), damage (`Iron Skin`, `Fire Ammo`), and shooting logic. Powerup voting uses `store.voteData` and the `PowerupVote.vue` overlay; the winning buff is applied in the `next_wave_started` listener in `GameScene.js`. Server guards votes with `room.voteResolved` (rejects further `cast_vote` after a tally is sent) and `start_next_wave` is a no-op if `room.isWaveActive` (prevents click-spam from skipping waves).

### Death & Revive

When a player dies, `Player.die()` **disables** the sprite (sets `active=false, visible=false, body.enable=false`) — does not destroy. `handlePlayerDeath` emits `player_died`; server records `deathTime/deathX/deathY` and broadcasts position. The dying client switches to the `spectator` overlay.

**Revive is automatic** — manual hold-E revive has been removed. When the server's setInterval detects wave clear and `alivePlayers.length > 0`, it immediately revives all dead players via `player_revived` (hp=50, reviverId=null) before emitting `intermission_start`. The client's existing `player_revived` handler calls `Player.respawn(x, y, hp)` and switches screen back to `game`. Dead players will then receive `intermission_start` and switch to the vote screen.

Live teammates still see a gray death-marker circle at the death position (`GameScene.refreshDeathMarkers`) — useful for tactical awareness during the wave.

Game-over fires only when **all** players are dead (server's `player_died` handler checks `every(p => p.isAlive === false)`).

### Lobby UI

`LobbyScreen.vue` contains:
- **Class selection grid** (2×2): clicking a card sets `store.playerStats.class`
- **Class detail panel** (below the grid): shows the selected class's role badge, HP/Speed/DMG stat bars (animated, relative to class maxima), and skill list with Q/E/Passive key badges and descriptions. Driven by a `computed` `selectedClass` over the `classes` array (which includes full `stats` and `skills` data).

## Key Socket Events

| Emitted by Client | Server behavior |
|---|---|
| `create_room`, `join_room`, `leave_room`, `start_game` | Mutates `activeRooms` and broadcasts `room_update` / `room_list` |
| `player_move`, `player_shoot` | Stores `p.x/p.y` (move only) and relays to peers |
| `zombie_spawn`, `zombie_update` | **Stub — empty handlers**, retained only for legacy clients |
| `zombie_damaged` | Validates with `isDead` flag, applies damage, broadcasts `zombie_took_damage`. Screamer death triggers 3-walker split server-side here. |
| `host_ready_to_spawn` | Host signals server's setInterval to begin spawning (sets `isWaveActive=true`) |
| `start_next_wave` | Host advances wave (rejected if `room.isWaveActive`); resets `voteResolved` |
| `cast_vote`, `finalize_vote` | Tallies votes; rejected after `voteResolved=true` |
| `heal_aoe` | Validated: sender's `class` must be `Medic`, else dropped |
| `shield_wall_active` | Relayed to peers (client-side buff application) |
| `taunt_active` | Sets `room.tauntActive` for pathing override + relays to peers |
| `mine_placed` | Validated: sender must be Trapper. Stored in `room.mines`; broadcast for visual render. Server triggers + applies damage in setInterval. |
| `player_died` | Records `deathTime/deathX/deathY`; broadcasts with position; checks `allDead` for `game_over` |

> `revive_request` has been removed — revive is now server-initiated automatically on wave clear.

| Emitted by Server | Purpose |
|---|---|
| `zombie_spawned`, `zombie_updated`, `zombie_took_damage` | Authoritative zombie state |
| `mine_placed`, `mine_exploded` | Trapper mine visuals (server-driven) |
| `intermission_start` | Wave clear → triggers auto-revive of dead players first, then vote screen |
| `next_wave_started` | Wave advances; client applies voted buff |
| `player_revived` | Auto-revive on wave end (`reviverId: null`, `hp: 50`) or legacy manual path |
| `game_over` | All players dead → final stats |

## MongoDB Collections

- `users`: nickname (unique), passwordHash (bcrypt), avatar, stats (bestWave, totalKills, totalScore, revives, mvps)
- `rooms`: code (unique), hostName, difficulty (EASY/NORMAL/HARD), status (waiting/playing/finished), currentWave, players array
- `scores`: per-game record (nickname, playerClass, wave, kills, score, playerCount) — written on `game_over`
- `telemetry`: per-wave APM/accuracy/clear-time, fed to the AI difficulty service at `http://localhost:8000/predict`
- `ai_difficulty`: response from the AI service (zombieSpeedMultiplier, eliteSpawnChance, ...)

## Common Pitfalls

- **Client-side state mutations on zombies are silently lost.** Don't call `zombie.takeDamage()` from a client script (e.g. mine overlap, AoE skill); the server's `room.zombies` won't know. Always route through `zombie_damaged` (or extend the server with a new authoritative handler) so the `isDead` flag and wave-clear logic stay consistent.
- **Effects like freeze/slow must be enforced on the server.** Setting velocity to 0 in `Zombie.update()` is overridden by the next `zombie_updated` broadcast. Add an entry to `zombie.effects` server-side and check it in the pathing loop.
- **Boss waves are special-cased in two places** (`start_next_wave` and `host_ready_to_spawn`). When changing wave-count formula, update both.
- **Player HP is purely client-side** (server `players[i]` doesn't store hp during play; only nickname/class/isAlive/x/y/kills/score/death-info). Damage applied via `Player.takeDamage` is local; the only sync is `player_died` when hp ≤ 0.
- **E key is secondary skill**, not revive. `Player.js` binds `Q → primarySkill`, `E → secondarySkill`. The old revive key (E) and `updateReviveInteraction` have been removed from `GameScene.js`. Do not re-add an E key listener in GameScene without removing it from Player's `addKeys` first.
- **Auto-revive runs every 50ms tick** while wave-clear condition holds (until host calls `start_next_wave`). The loop is safe because `dead.isAlive = true` is set before emitting, so subsequent ticks find no dead players. But if you add logic that resets `isAlive` server-side mid-intermission, you could accidentally fire `player_revived` multiple times.
