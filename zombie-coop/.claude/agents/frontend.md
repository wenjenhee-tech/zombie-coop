# Frontend Agent

## Scope — chỉ làm việc với:
- `game-client/src/components/*.vue`
- `game-client/src/game/entities/` (Player.js, PlayerClasses.js, Zombie.js)
- `game-client/src/game/scenes/GameScene.js`
- `game-client/src/store.js`
- `game-client/src/App.vue`

## Stack
- Vue 3 (Composition API, `<script setup>`)
- Phaser 4 (arcade physics, không có sprite sheets — entities dùng `Phaser.Graphics` procedural)
- Socket.io-client
- Vite (bundler)

---

## State Management

`store.js` export một object `reactive()` duy nhất — **không dùng Pinia**. Cũng giữ socket instance (`store.socket`). Mọi shared state đi qua `store.js`. Không tạo store mới.

Key fields:
- `store.playerStats` — hp, maxHp, kills, score, isAlive, primaryCDReadyRatio, secondaryCDReadyRatio
- `store.currentRoomDetails` — id, difficulty, isHost, players[]
- `store.voteData` — wave, class, winner, options[], activeBuffs[]
- `store.currentScreen` — điều khiển màn hình hiện tại

---

## Screen Flow

```
login → lobby → room_waiting → game (→ vote overlay / spectator overlay) → summary → leaderboard → lobby
```
`App.vue` dùng `v-if` theo `store.currentScreen`. Sau leaderboard, "Chơi ngay" trả về `lobby` (không về login — user vẫn logged in).

---

## Phaser ↔ Vue Integration

- `GameComponent.vue` mount Phaser vào `#phaser-container` qua `onMounted`
- Vue UI (`pointer-events: none`) nằm absolute phía trên canvas — clicks pass-through xuống Phaser
- `GameScene.update()` ghi vào `store.playerStats` mỗi frame: hp, maxHp, primaryCDReadyRatio, secondaryCDReadyRatio
- **HUD**: health bar (bottom-left) + 2 skill buttons (bên dưới health bar) hiển thị skill name, fill bar từ CDRatio, seconds remaining

---

## Skill Keybindings

```
Q → primarySkill   → usePrimarySkill()   (với primaryCooldown guard)
E → secondarySkill → useSecondarySkill() (với secondaryCooldown guard)
WASD → movement
Mouse → aim + shoot (pointerdown)
```

Passive skills (Gunner Adrenaline Rush, Medic Auto-Defib) auto-trigger trong `passiveTick(time)` — không có key press.

---

## Class Visual Shapes

Mỗi subclass trong `PlayerClasses.js` override `drawPlayer()`:

| Class | Shape |
|---|---|
| Gunner | Blue circle + gun barrel |
| Tank | Red square 2 lớp (outer + inner) |
| Medic | Green circle + cross symbol |
| Trapper | Orange circle + X symbol |

Đừng dùng base class `drawPlayer()` (plain circle) cho subclasses.

---

## Other Player Rendering

Trong `GameScene.setupMultiplayerSync()`, `player_moved` event render other players là **circles** theo class color:

```js
const CLASS_COLORS = { Gunner: 0xe67e22, Tank: 0x2980b9, Medic: 0x27ae60, Trapper: 0xf1c40f };
// Lookup: store.currentRoomDetails.players.find(p => p.id === data.id)?.class
```

---

## Socket Listeners trong GameScene

Tất cả được đăng ký **một lần** trong `setupMultiplayerSync()` — không đăng ký lại trong callbacks:

| Event | Xử lý |
|---|---|
| `zombie_spawned` | Non-host: tạo Zombie object, add vào group |
| `zombie_updated` | Non-host: `setPosition` (không dùng velocity) |
| `zombie_took_damage` | Non-host: `zombie.takeDamage()` |
| `mine_placed` | Render mine graphic tại vị trí |
| `mine_exploded` | Destroy mine graphic |
| `intermission_start` | `isWaveActive = false`; non-host clear zombies group; → vote screen |
| `next_wave_started` | `isWaveActive = true`; update `waveText`; host gọi `startWave()` |
| `difficulty_update` | Update `this.difficultyParams` |
| `you_are_host` | `store.currentRoomDetails.isHost = true`; nếu wave active → `startWave()` |
| `heal_aoe` | Non-source: `player.heal()` |
| `taunt_active` | Host: set taunt fields trên zombies gần tankId |
| `player_revived` | Gọi `Player.respawn(x, y, hp)`; về game screen |

---

## Wave Sync (Non-host)

Non-host **không** gọi `startWave()`. Thay vào đó:
- Khi game bắt đầu: `isWaveActive = true` từ đầu (có thể bắn ngay)
- Khi wave mới: `next_wave_started` event set `isWaveActive = true` + update `waveText`
- `shoot()` check `if (!this.isWaveActive) return` — nên non-host phải có flag này true

---

## Zombie Sync (Non-host)

- `intermission_start`: `this.zombies.clear(true, true)` — xóa zombies wave cũ
- `startWave()` (host): cũng gọi `this.zombies.clear(true, true)` ở đầu

---

## Không động vào
- `game-server/`
- `game-server/database/`
