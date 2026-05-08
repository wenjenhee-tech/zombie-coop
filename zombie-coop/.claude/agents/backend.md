# Backend Agent

## Scope — chỉ làm việc với:
- `game-server/server.js` (toàn bộ API + socket logic + game loop)
- `game-server/init_db.js`

## Stack
- Node.js (CommonJS), Express 5, Socket.io 4, Mongoose 9, bcryptjs

---

## Kiến trúc: Server-Authoritative Game Loop

Server chạy một `setInterval(..., 50ms)` là **nguồn sự thật duy nhất** cho:
- Zombie spawning (per-wave count + type pool, boss waves 5/10 spawn đúng 1 zombie)
- Zombie pathing (chase nearest alive player; check `tauntActive` override và per-zombie `effects.freeze` / `effects.slow`)
- Mine triggers (Trapper mines lưu trong `room.mines`, server detect overlap, apply damage + effect)
- Wave clear detection (`zombiesSpawned >= zombiesToSpawn && Object.keys(room.zombies).length === 0`)
- Auto-revive: ngay trước khi emit `intermission_start`, server revive tất cả dead players nếu `alivePlayers.length > 0` — emit `player_revived { reviverId: null, hp: 50 }` cho từng người

**Clients chỉ render** — không chạy zombie logic. `zombie_spawn` / `zombie_update` events từ client là **empty stubs**, retained cho legacy.

---

## Host Authority & Security

```js
room.hostSocketId   // socket.id của người tạo phòng / người kế nhiệm
room.spawnCount     // reset 0 mỗi wave; rate limit 200 spawns/wave
```

Chỉ `socket.id === room.hostSocketId` mới được:
- `start_game` (cũng cần `room.players.length >= 2`)
- `start_next_wave`
- `finalize_vote`
- `zombie_spawn` / `zombie_update` (stubs, nhưng có auth check)

Khi host disconnect/leave: `room.hostSocketId = room.players[0].id` + emit `you_are_host` đến client mới.

---

## Dual State: In-Memory vs MongoDB

- `activeRooms` (in-memory) là **authoritative** trong gameplay — dùng cho socket broadcasting
- MongoDB ghi async, có thể lag; không query realtime game state từ DB

---

## Mongoose Models (tất cả inline trong server.js)

| Model | Collection | Ghi chú |
|---|---|---|
| `User` | `users` | nickname unique, passwordHash bcrypt, stats aggregate |
| `Room` | `rooms` | code unique, status: waiting/playing/finished |
| `Score` | `scores` | per-game record: nickname, playerClass, wave, kills, score, playerCount |
| `Telemetry` | `telemetry` | per-wave: roomCode, wave, apm, avgAccuracy, hpLossRate, clearTime |
| `AiDifficulty` | `ai_difficulty` | output AI: zombieSpeedMultiplier, eliteSpawnChance, resourceScarcity |

---

## Mine System

1. Client (Trapper) emit `mine_placed { roomCode, mineId, x, y }`
2. Server validate: sender phải là Trapper (`room.players[i].class === 'Trapper'`)
3. Lưu vào `room.mines[mineId]`; broadcast `mine_placed` cho visual render
4. setInterval detect zombie overlap → apply damage + effect → emit `mine_exploded { mineId }` → clients destroy graphic

---

## REST API

- `POST /api/auth/register` — tạo user, bcrypt hash
- `POST /api/auth/login` — verify, update `lastLoginAt`
- `POST /api/scores` — lưu Score + update User lifetime stats
- `GET /api/leaderboard` — aggregate Score by nickname, sort by bestWave/totalScore

---

## Socket Events — Client → Server

| Event | Auth check | Mô tả |
|---|---|---|
| `create_room` | — | Tạo room, set `hostSocketId` |
| `join_room` | — | Thêm player vào room đang waiting |
| `leave_room` | — | Remove player; transfer host nếu cần |
| `start_game` | hostSocketId + ≥2 players | Chuyển status → playing |
| `host_ready_to_spawn` | hostSocketId | Host's GameScene đã sẵn sàng → setInterval bắt đầu spawn |
| `player_move` | — | Relay đến peers; lưu `p.x/p.y` |
| `player_shoot` | — | Relay đến peers |
| `zombie_damaged` | — | Validate `isDead` flag, apply damage, broadcast. Screamer death → 3-walker split server-side |
| `zombie_spawn` / `zombie_update` | hostSocketId | **Stubs rỗng** — legacy only |
| `end_wave` | — | Trigger intermission |
| `start_next_wave` | hostSocketId | Advance wave (no-op nếu `room.isWaveActive`) |
| `wave_telemetry` | — | Lưu Telemetry + gọi AI service → emit `difficulty_update` |
| `cast_vote` | alive player in room | Tally vote; tự resolve khi all alive voted |
| `finalize_vote` | hostSocketId | Force-resolve vote countdown |
| `heal_aoe` | class === Medic | Relay đến peers |
| `shield_wall_active` | — | Relay đến peers |
| `taunt_active` | — | Set `room.tauntActive` + relay |
| `mine_placed` | class === Trapper | Validate, store, broadcast |
| `player_died` | — | Record death info; check allDead → `game_over` |

## Socket Events — Server → Client

| Event | Mô tả |
|---|---|
| `zombie_spawned`, `zombie_updated` | Authoritative zombie state từ setInterval |
| `zombie_took_damage` | Broadcast sau `zombie_damaged` |
| `mine_placed`, `mine_exploded` | Trapper mine visuals |
| `intermission_start` | Wave clear → auto-revive trước, rồi vote screen |
| `next_wave_started` | Wave mới; client apply voted buff |
| `difficulty_update` | AI difficulty params cho wave tiếp theo |
| `player_revived` | `{ id, x, y, hp: 50, reviverId: null }` |
| `you_are_host` | Thông báo client mới là host |
| `game_over` | All dead → final stats |

---

## Common Pitfalls

- **Client-side zombie mutation bị ignore.** Đừng gọi `zombie.takeDamage()` từ AoE skill client-side — server `room.zombies` không biết. Route qua `zombie_damaged`.
- **Effects phải server-side.** `zombie_updated` broadcast override mọi velocity change client-side. Thêm entry vào `zombie.effects` server-side, check trong pathing loop.
- **Boss waves special-cased ở 2 nơi**: `start_next_wave` và `host_ready_to_spawn`. Khi sửa wave formula, update cả hai.
- **Auto-revive loop-safe**: `dead.isAlive = true` set trước khi emit → các tick tiếp theo không fire lại.

## Không động vào
- `game-client/`
- `game-server/database/game_schema.json` (thuộc scope database agent)
