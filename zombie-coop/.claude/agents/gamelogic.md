# Game Logic Agent

## Scope — chỉ làm việc với:
- `game-client/src/game/entities/Player.js`
- `game-client/src/game/entities/PlayerClasses.js`
- `game-client/src/game/entities/Zombie.js`
- `game-client/src/game/scenes/GameScene.js`

---

## Player Classes (kế thừa từ Player.js)

| Class | Visual | HP | Speed | Damage | Q (Primary) | E (Secondary/Passive) |
|---|---|---|---|---|---|---|
| Gunner | Blue circle + barrel | 80 | 210 | 35 | Rain of Bullets (piercing + 2× speed, 3s) | Passive: Adrenaline Rush (auto ≤30% HP, +40% fire rate, 5s) |
| Tank | Red square 2-layer | 150 | 150 | 20 | Shield Wall (60% dmg reduce, 5s) | Taunt (redirect zombies 8s) |
| Medic | Green circle + cross | 90 | 230 | 15 | Emergency Kit (heal 30 HP AoE 130px) | Passive: Auto-Defib (auto ≤10% HP, heal 30 HP) |
| Trapper | Orange circle + X | 85 | 230 | 15 | Mine Field (5 mines, 50 dmg + slow) | Freeze Trap (3s freeze) |

**Keybindings**: Q = primary, E = secondary. WASD movement. Mouse aim + shoot (pointerdown).

Passive skills auto-trigger trong `passiveTick(time)`. `secondaryCooldown` tracks auto-trigger cooldown.

---

## Zombie Types (Zombie.js setupStats() + draw methods)

| Type | Visual | Speed | HP | Damage | Behavior đặc biệt |
|---|---|---|---|---|---|
| walker | Dark-red rect, eyes, jagged mouth | 100 | 30 | 10 | Default chaser |
| runner | Maroon rect, speed blur lines | 180 | 20 | 5 | Fast, low HP |
| brute | Dark-brown large rect, muscle ridges | 80 | 200 | 25 | Slow, high HP |
| spitter | Green rect, toxic drops | 100 | 30 | 10 | Ranged spit — fires trên host |
| screamer | Yellow 8-point star, O-mouth | 120 | 15 | 0 | Khi chết: server split thành 3 walkers tại vị trí |
| exploder | Purple circle, radiating lines | 60 | 40 | 0 | Không tấn công; AoE suicide khi đến gần player |
| hordeking | Black rect, gold crown, red eyes, aura | 90 | 500 | 30 | Boss wave 10 |

HP phải khớp giữa `Zombie.setupStats` (client) và `HP_TABLE` (server, ~line 543).

Mỗi type có draw method riêng: `_drawWalker`, `_drawRunner`, `_drawBrute`, `_drawSpitter`, `_drawScreamer`, `_drawExploder`, `_drawHordeking` — gọi bởi `drawZombie()` dispatcher.

---

## Wave Config (GameScene.getWaveConfig)

**Dynamic scaling** (không phải hardcode):
```js
count = Math.floor(8 + wave * 2.5 + wave * wave * 0.3)
```

Type pool mở rộng dần:
- Wave 1–2: `[walker, walker]`
- Wave 3+: thêm runner
- Wave 4+: thêm runner thứ 2
- Wave 5: **boss** — `{ count: 1, types: ['brute'] }`
- Wave 6+: thêm spitter, screamer
- Wave 8+: thêm exploder
- Wave 10: **boss** — `{ count: 1, types: ['hordeking'] }`
- Wave 11+: thêm brute vào pool

---

## Buff System

Buff = string ID trong `player.activeBuffs[]`:
- `player.addBuff(id)` — idempotent (không duplicate)
- `player.hasBuff(id)` — check inline trong movement, damage, shoot

Buff IDs: `Speed Boost`, `Iron Skin`, `Fire Ammo`, `Rain of Bullets`, `Adrenaline Rush`, `Shield Wall`

Vote buff áp dụng trong `next_wave_started` listener của GameScene.

---

## Server-Side Zombie Authority

**Clients không drive zombie movement.** Chỉ server (setInterval 50ms) spawn và update zombie positions.

Client responsibilities:
- Render từ `zombie_spawned` (tạo Zombie object) và `zombie_updated` (`setPosition` — không dùng velocity)
- Emit `zombie_damaged` khi bullet hit → server validate + broadcast

**Pitfall**: Đừng gọi `zombie.takeDamage()` từ AoE skill hay mine overlap client-side — server không biết. Route qua `zombie_damaged`.

---

## Zombie Effects

Effects phải apply **server-side** trong pathing loop:
- `freeze`: velocity = 0 trong setInterval tick
- `slow`: velocity × 0.5 trong setInterval tick

Client-side `zombie.effects` chỉ dùng cho visual (color tint). Setting velocity client-side bị override ngay bởi `zombie_updated` tiếp theo.

---

## Mine System (Client-side)

Trapper emit `mine_placed` → server validate + broadcast → client render mine graphic.
Server detect zombie overlap → broadcast `mine_exploded` → client destroy graphic.
**Client không tự detect mine overlap.**

---

## Death & Revive

`Player.die()` → disable sprite (active=false, visible=false, body.enable=false). Không destroy.

Auto-revive: server emit `player_revived { id, x, y, hp: 50, reviverId: null }` khi wave clear và còn ≥1 alive player. Client gọi `Player.respawn(x, y, hp)` → re-enable sprite.

Manual revive (hold E) đã bị xóa. Không re-add E key listener trong GameScene.

---

## Không động vào
- `game-server/`
- Vue components (`game-client/src/components/`)
- `store.js` (chỉ đọc; ngoại trừ `GameScene.update()` sync HP/CD ratios)
