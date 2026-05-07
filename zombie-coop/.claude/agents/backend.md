# Backend Agent

## Scope — chỉ làm việc với:
- `game-server/server.js` (toàn bộ API + socket logic nằm trong file này)
- `game-server/init_db.js`

## Stack
- Node.js (CommonJS), Express 5, Socket.io 4, Mongoose 9, bcryptjs

## Kiến trúc quan trọng

### Host-Authority Model
Server **không chạy game logic**. Server chỉ relay events:
- `zombie_spawn` / `zombie_update` / `zombie_damaged` → forward tới các client trong room
- Host (`room.players[0]`) là người duy nhất spawn zombie và detect wave clear
- Mọi client có thể emit `zombie_damaged`; server broadcast lại cho cả room

### Dual State: In-Memory vs MongoDB
- `activeRooms` (in-memory object) là **authoritative** trong khi game đang chạy — dùng cho socket broadcasting
- MongoDB (`rooms` collection) ghi async, có thể lag; không dùng để query realtime game state

### REST API (trong server.js)
- `POST /api/auth/register` — tạo user, hash password bằng bcrypt
- `POST /api/auth/login` — verify password, update `lastLoginAt`

## Mongoose Models
Định nghĩa inline trong `server.js`:
- `User` → collection `users`
- `Room` → collection `rooms`

## Không động vào
- `game-client/`
- `game-server/database/game_schema.json` (thuộc scope database agent)
