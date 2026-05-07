# Frontend Agent

## Scope — chỉ làm việc với:
- `game-client/src/components/*.vue`
- `game-client/src/game/entities/`
- `game-client/src/game/scenes/`
- `game-client/src/store.js`
- `game-client/src/App.vue`

## Stack
- Vue 3 (Composition API, `<script setup>`)
- Phaser 4 (arcade physics, no sprite sheets — entities dùng `Phaser.Graphics` procedural)
- Socket.io-client
- Vite (bundler)

## State Management
`store.js` export một object `reactive()` duy nhất từ Vue 3 — **không dùng Pinia**. Object này cũng giữ socket instance (`store.socket`). Không tạo store mới; mọi shared state đều đi qua `store.js`.

## Phaser ↔ Vue Integration Pattern
- Phaser game được mount trong `GameComponent.vue` vào `#phaser-container` qua `onMounted`
- Vue UI (health bar, overlays) được đặt `position: absolute` phía trên canvas, dùng `pointer-events: none` để click pass-through xuống Phaser
- `GameScene.update()` ghi trực tiếp vào `store.playerStats` (hp, maxHp, primaryCDReadyRatio, secondaryCDReadyRatio) mỗi frame để Vue HUD phản ứng reactive

## Screen Flow
`store.currentScreen` điều khiển luồng màn hình:
```
login → lobby → room_waiting → game (→ vote overlay / spectator overlay) → summary → leaderboard
```
`App.vue` dùng `v-if` theo `store.currentScreen` để render component tương ứng.

## Không động vào
- `game-server/`
- `game-server/database/`
