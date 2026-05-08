# Database Agent

## Scope — chỉ làm việc với:
- `game-server/database/game_schema.json`
- `game-server/init_db.js`

---

## Mongoose Models (trong server.js)

Cả 5 models đều được định nghĩa **inline trong `server.js`** — không cần native MongoDB driver:

| Model | Collection | Fields chính |
|---|---|---|
| `User` | `users` | nickname (unique), passwordHash (bcrypt), avatar, stats{bestWave, totalKills, totalScore, revives, mvps} |
| `Room` | `rooms` | code (unique), hostName, difficulty, status, currentWave, players[] |
| `Score` | `scores` | nickname, playerClass, wave, kills, score, playerCount, playedAt |
| `Telemetry` | `telemetry` | roomCode, wave, apm, avgAccuracy, hpLossRate, clearTime, recordedAt |
| `AiDifficulty` | `ai_difficulty` | roomCode, wave, zombieSpeedMultiplier, eliteSpawnChance, resourceScarcity, generatedAt |

---

## Collections trong game_schema.json (8 collections)

| Collection | Mục đích | Ghi chú |
|---|---|---|
| `users` | Player profiles | nickname unique, bcrypt hash, stats |
| `rooms` | Game rooms | TTL index 7200s, status: waiting/playing/finished |
| `scores` | Game results | Per-player performance sau mỗi game |
| `powerups` | Buff definitions | Class bonus flags (dùng cho UI vote options) |
| `maps` | Map layouts | Architecture + loot zones (reserved, chưa dùng) |
| `items` | Loot items | Consumables, actives, weapon upgrades (reserved) |
| `telemetry` | Raw game metrics | APM, accuracy, HP loss — feed cho AI pipeline |
| `ai_difficulty` | Adaptive difficulty | Output của Deep Learning model mỗi wave |

---

## init_db.js

Script chạy **một lần** để:
1. Tạo collection nếu chưa tồn tại (kèm JSON Schema validator từ `game_schema.json`)
2. Cập nhật validator nếu collection đã có
3. Tạo indexes theo định nghĩa trong `game_schema.json`

Chạy: `node init_db.js` từ thư mục `game-server/`

---

## Lưu ý

- `aggregation.json` ở root (`zombie-coop/aggregation.json`) là từ dự án khác — **không thuộc scope**, đừng chỉnh sửa
- Collections `powerups`, `maps`, `items` có trong schema nhưng chưa có Mongoose model — chưa được dùng trong game
- Mongoose models (`User`, `Room`, `Score`, `Telemetry`, `AiDifficulty`) đủ cho tất cả operations hiện tại

## Không động vào
- `game-client/`
- `game-server/server.js` (socket/API logic)
