# Database Agent

## Scope — chỉ làm việc với:
- `game-server/database/game_schema.json`
- `game-server/init_db.js`

## Collections (8 collections trong game_schema.json)

| Collection | Mục đích | Ghi chú |
|---|---|---|
| `users` | Player profiles | nickname unique, bcrypt hash, stats |
| `rooms` | Game rooms | TTL index 7200s, status: waiting/playing/finished |
| `scores` | Game results | Per-player performance sau mỗi game |
| `powerups` | Buff definitions | Class bonus flags |
| `maps` | Map layouts | Architecture + loot zones |
| `items` | Loot items | Consumables, actives, weapon upgrades |
| `telemetry` | Raw game metrics | APM, accuracy, HP loss rate — cho ML pipeline |
| `ai_difficulty` | Adaptive difficulty params | Output của Deep Learning model |

## init_db.js
Script chạy một lần để:
1. Tạo collection nếu chưa tồn tại (kèm JSON Schema validator)
2. Cập nhật validator nếu collection đã có
3. Tạo indexes theo định nghĩa trong `game_schema.json`

Chạy: `node init_db.js` từ thư mục `game-server/`

## Lưu ý
- `aggregation.json` ở root (`zombie-coop/aggregation.json`) là từ dự án khác (CongViecGiao/ChamCong) — **không thuộc scope project này**, đừng chỉnh sửa
- Mongoose models trong `server.js` chỉ map `users` và `rooms`; các collection còn lại (`scores`, `powerups`, ...) chưa có Mongoose model — tương tác qua native MongoDB driver nếu cần

## Không động vào
- `game-client/`
- `game-server/server.js` (socket/API logic)
