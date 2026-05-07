# Game Logic Agent

## Scope — chỉ làm việc với:
- `game-client/src/game/entities/Player.js`
- `game-client/src/game/entities/PlayerClasses.js`
- `game-client/src/game/entities/Zombie.js`
- `game-client/src/game/scenes/GameScene.js`
- `game-client/src/game/scenes/UIScene.js`

## Player Classes (kế thừa từ Player.js)

| Class | Color | HP | Speed | Damage | Primary Skill | Passive |
|---|---|---|---|---|---|---|
| Gunner | Blue | 80 | 210 | 35 | Rain of Bullets (piercing + 2× speed, 3s) | Adrenaline Rush (auto khi HP ≤ 30%, +40% fire rate, 5s) |
| Tank | Red | 150 | 150 | 20 | Shield Wall (60% dmg reduce, 5s) | Block mọi hit thứ 5; Taunt (secondary, redirect zombies) |
| Medic | Green | 90 | 230 | 15 | Emergency Kit (heal 30 HP, AoE 130px) | Auto-Defibrillator (auto khi HP ≤ 10%, heal 30 HP) |
| Trapper | Orange | 85 | 230 | 15 | Mine Field (5 AoE mines, 50 dmg + slow) | Freeze Trap (secondary, 3s freeze) |

Input: WASD movement, mouse aim/shoot, SPACE = primary skill, Q = secondary skill.

## Zombie Types (định nghĩa trong Zombie.js:setupStats())

| Type | Speed | HP | Damage | Size |
|---|---|---|---|---|
| walker | 100 | 30 | 10 | 32px |
| runner | 180 | 20 | 5 | 24px |
| brute | 80 | 200 | 25 | 48px |
| spitter | 100 | 30 | 10 | 32px |
| hordeking | 90 | 500 | 30 | 64px (boss) |

Thêm zombie type mới: tạo case mới trong `setupStats()`, thêm vào `waveTypes` array trong `getWaveConfig()`.

## Wave Config (GameScene.getWaveConfig(wave))
Hardcoded thresholds, chưa có dynamic scaling:
- Wave 1–2: chỉ walker
- Wave 3–4: walker + runner
- Wave 5: 1 brute (boss wave)
- Wave 6–9: walker + runner + spitter
- Wave 10: 1 hordeking (boss wave)
- Wave 11+: tất cả types

## Buff System
Buff là string ID lưu trong `player.activeBuffs[]` (array).
- `player.addBuff(id)` — thêm nếu chưa có
- `player.hasBuff(id)` — check trong movement, damage, shoot inline

Buff IDs đang dùng: `Speed_Boost`, `Iron_Skin`, `Fire_Ammo`, `Rain_Of_Bullets`, `Adrenaline_Rush`, `Shield_Wall`, `Taunt`.

Buff **không** phân per-class tier — tất cả là team-wide và được áp dụng sau vote. Không có hệ thống "3 tier upgrade" riêng theo class.

## Zombie Effects
`zombie.applyEffect(name, durationMs)` — lưu trong `zombie.activeEffects[]`.
- `slow`: giảm speed × 0.5 trong `Zombie.update()`
- `freeze`: chưa implement đầy đủ (Trapper đang gọi nhưng Zombie.update chưa check)
- `burn`: damage over time (xử lý bên `GameScene.handleBulletHitZombie`)

## Không động vào
- `game-server/`
- Vue components (`game-client/src/components/`)
- `store.js` (chỉ đọc, không viết trực tiếp từ entities — ngoại trừ GameScene.update() sync HP)
