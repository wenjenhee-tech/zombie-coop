# Các Phase Chưa Hoàn Thành

Phase 1 (Việt hóa) đã xong. Còn lại Phase 2 và Phase 3.

---

## PHASE 2 — Âm thanh + Nút tắt tiếng

### Bước 2.1 — Copy file nhạc nền mới (thao tác file hệ thống)

Chạy lệnh PowerShell:
```powershell
Copy-Item "f:\DemoCode_NCKH\Iron_Underfoot.mp3" "f:\DemoCode_NCKH\zombie-coop\game-client\public\audio\Iron_Underfoot.mp3"
```

### Bước 2.2 — `App.vue` — Đổi BGM + thêm nút mute toàn cục

**File:** `zombie-coop/game-client/src/App.vue`

**Template:** Thay thế toàn bộ khối `<audio>` và thêm nút mute:
```html
<!-- Đổi source từ Perimeter_Breach.mp3 sang Iron_Underfoot.mp3 -->
<!-- Thêm :muted="store.isMuted" để Vue control trực tiếp -->
<audio ref="bgAudio" loop :muted="store.isMuted">
  <source src="/audio/Iron_Underfoot.mp3" type="audio/mpeg">
</audio>

<!-- Thêm nút này vào trong <div class="app-container">, trước LoginScreen -->
<button class="global-mute-btn" @click="store.isMuted = !store.isMuted" title="Tắt/Bật tiếng">
  {{ store.isMuted ? '🔇' : '🔊' }}
</button>
```

**Script:** Thêm `watch` vào phần `<script setup>` (đã có `watch` import sẵn ở line 33):
```js
// Thêm vào sau watch(() => store.currentScreen, ...) hiện có (line 67-69)
watch(() => store.isMuted, (muted) => {
  if (!bgAudio.value) return;
  bgAudio.value.muted = muted;
  if (!muted) updateAudioPlayback(store.currentScreen);
});
```

**Style:** Thêm vào cuối `<style scoped>`:
```css
.global-mute-btn {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid #555;
  color: white;
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
  transition: background 0.2s;
}
.global-mute-btn:hover {
  background: rgba(0, 0, 0, 0.8);
}
```

---

### Bước 2.3 — `GameScene.js` — Zombie hit SFX + bullet tune + đọc trạng thái mute

**File:** `zombie-coop/game-client/src/game/scenes/GameScene.js`

**A. Preload thêm zombie hit sound** (trong hàm `preload()`, ngay sau dòng load `zombie_die`):
```js
this.load.audio('zombie_hit', '/audio/sfx/zombie.wav');
```

**B. Tune bullet SFX** — Tìm dòng `this.sound.play('shoot', { volume: 0.3 })` và thay thành:
```js
this.sound.play('shoot', { volume: 0.25, detune: Phaser.Math.Between(-100, 100) });
```

**C. Zombie hit SFX khi trúng đạn** — Trong socket handler `zombie_took_damage`, tìm block xử lý zombie bị damage. Thêm đoạn này TRƯỚC block kiểm tra `isDead`:
```js
// Rate-limit để tránh spam âm thanh khi nhiều người bắn cùng lúc
if (this.time.now > (this._lastHitSfx || 0) + 80) {
  this.sound.play('zombie_hit', { volume: 0.12, detune: Phaser.Math.Between(-300, 300) });
  this._lastHitSfx = this.time.now;
}
```

**D. Đọc trạng thái mute khi scene khởi động** — Thêm vào cuối hàm `create()`:
```js
if (store.isMuted) this.sound.setVolume(0);
```

**E. Sync mute realtime** — Trong hàm `update()`, thêm 1 dòng ở đầu hàm:
```js
this.sound.setVolume(store.isMuted ? 0 : 1);
```
*(Phaser cache kết quả, gọi mỗi frame không ảnh hưởng hiệu năng đáng kể)*

---

## PHASE 3 — Bản đồ: Nền cỏ + Trang trí Pixel Art

### Bước 3.1 — `PixelArtTextures.js` — Thêm 4 hàm vẽ texture mới

**File:** `zombie-coop/game-client/src/game/PixelArtTextures.js`

Thêm 4 hàm sau vào cuối file, TRƯỚC dòng `export function generateAllTextures`:

#### `drawGrass(ctx, frame)` — 4 biến thể cỏ 32×32px
```js
function drawGrass(ctx, frame) {
  // Màu nền theo frame
  const bases = ['#4a7a3a', '#5a8a4a', '#3a6020', '#4f7d40'];
  fr(ctx, 0, 0, 32, 32, bases[frame]);

  // Pixel tối tạo bóng cỏ
  const darks = '#3a6020';
  const lights = '#6aaa5a';

  if (frame === 0) {
    fr(ctx, 4, 6, 3, 2, darks); fr(ctx, 14, 3, 2, 3, darks);
    fr(ctx, 22, 10, 3, 2, darks); fr(ctx, 8, 18, 2, 3, darks);
    fr(ctx, 26, 20, 3, 2, darks); fr(ctx, 3, 26, 4, 2, darks);
  } else if (frame === 1) {
    fr(ctx, 6, 4, 3, 2, lights); fr(ctx, 18, 8, 2, 3, lights);
    fr(ctx, 10, 16, 3, 2, lights); fr(ctx, 24, 22, 4, 2, lights);
    fr(ctx, 2, 24, 3, 2, darks); fr(ctx, 20, 2, 2, 3, darks);
  } else if (frame === 2) {
    fr(ctx, 5, 8, 4, 2, lights); fr(ctx, 20, 5, 2, 4, lights);
    fr(ctx, 12, 20, 3, 2, lights); fr(ctx, 27, 14, 3, 2, darks);
    fr(ctx, 8, 27, 4, 2, darks);
  } else {
    fr(ctx, 10, 5, 3, 2, darks); fr(ctx, 3, 14, 2, 3, darks);
    fr(ctx, 22, 18, 3, 2, darks); fr(ctx, 15, 25, 4, 2, lights);
    fr(ctx, 28, 6, 2, 3, lights);
  }
}
```

#### `drawTree(ctx, frame)` — Cây top-down 48×48px
```js
function drawTree(ctx, frame) {
  // Bóng mờ
  ctx.globalAlpha = 0.3;
  fc(ctx, 26, 26, 19, '#000000');
  ctx.globalAlpha = 1;

  // Tán cây ngoài (tối)
  fc(ctx, 24, 24, 20, '#1a4a0a');
  // Tán cây trong (trung)
  fc(ctx, 24, 24, 15, '#2a6a1a');
  // Highlight trên-trái
  fc(ctx, 18, 18, 7, '#4a9a3a');
  fc(ctx, 16, 16, 3, '#6ab84a');

  // Gốc cây nhỏ ở giữa
  fc(ctx, 24, 24, 4, '#5a3010');
  fc(ctx, 23, 23, 2, '#7a4820');

  // Pixel lá lẻ rải quanh viền tán để tạo cảm giác xù xì
  const leafColor = '#2a6a1a';
  fr(ctx, 5, 14, 2, 2, leafColor); fr(ctx, 40, 12, 2, 2, leafColor);
  fr(ctx, 8, 36, 2, 2, leafColor); fr(ctx, 38, 38, 2, 2, leafColor);
  fr(ctx, 4, 22, 2, 3, '#1a4a0a'); fr(ctx, 42, 20, 2, 3, '#1a4a0a');
}
```

#### `drawRock(ctx, frame)` — Tảng đá 32×32px
```js
function drawRock(ctx, frame) {
  // Thân đá
  fr(ctx, 4, 10, 24, 16, '#6a6a6a');
  // Bo góc
  fr(ctx, 6, 8, 20, 18, '#7a7a7a');
  fr(ctx, 8, 7, 16, 19, '#7a7a7a');

  // Highlight trên
  fr(ctx, 8, 8, 16, 3, '#aaaaaa');
  fr(ctx, 6, 11, 4, 2, '#999999');

  // Bóng dưới-phải
  fr(ctx, 8, 23, 16, 3, '#4a4a4a');
  fr(ctx, 22, 12, 4, 10, '#555555');

  // Vết nứt nhỏ
  fr(ctx, 13, 13, 1, 5, '#444444');
  fr(ctx, 14, 17, 3, 1, '#444444');
  fr(ctx, 20, 11, 1, 4, '#555555');
}
```

#### `drawWater(ctx, frame)` — Hồ nước 48×48px, 2 frames shimmer
```js
function drawWater(ctx, frame) {
  ctx.globalAlpha = 0.75;

  // Viền nước
  ctx.fillStyle = '#1a3a7a';
  ctx.beginPath();
  ctx.ellipse(24, 24, 22, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Thân nước
  ctx.fillStyle = '#2255aa';
  ctx.beginPath();
  ctx.ellipse(24, 24, 19, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ánh sáng phản chiếu (shimmer dịch theo frame)
  const shimmerX = frame === 0 ? 14 : 16;
  ctx.globalAlpha = 0.9;
  fr(ctx, shimmerX, 18, 5, 2, '#88aaff');
  fr(ctx, shimmerX + 8, 22, 3, 2, '#aaccff');
  fr(ctx, shimmerX - 2, 24, 2, 1, '#aaccff');

  ctx.globalAlpha = 1;
}
```

#### Đăng ký các texture mới trong `generateAllTextures(scene)`

Thêm vào **cuối hàm** `generateAllTextures`, sau dòng `makeAtlas(scene, 'zombie_hordeking', ...)`:

```js
// ─── Decorations ──────────────────────────────────────────────────────────────

// Cỏ — 4 frames, dùng makeAtlas bình thường (32×32)
makeAtlas(scene, 'grass', 4, drawGrass);

// Đá — 1 frame, 32×32 (dùng makeAtlas được)
makeAtlas(scene, 'rock', 1, drawRock);

// Cây — 48×48, tạo thủ công (khác kích thước FW/FH)
const treeCt = scene.textures.createCanvas('tree', 48, 48);
drawTree(treeCt.getContext('2d'), 0);
treeCt.refresh();

// Nước — 48×48, 2 frames shimmer
const waterCt = scene.textures.createCanvas('water', 96, 48);
const wCtx = waterCt.getContext('2d');
wCtx.clearRect(0, 0, 96, 48);
[0, 1].forEach(i => {
  wCtx.save();
  wCtx.translate(i * 48, 0);
  drawWater(wCtx, i);
  wCtx.restore();
  waterCt.add(i, 0, i * 48, 0, 48, 48);
});
waterCt.refresh();
```

---

### Bước 3.2 — `GameScene.js` — Thay grid bằng cỏ + thêm decorations

**File:** `zombie-coop/game-client/src/game/scenes/GameScene.js`

#### A. Xóa hàm `addGrid()` cũ (lines ~409-423)

Xóa toàn bộ method:
```js
addGrid() {
  const graphics = this.add.graphics();
  // ... (xóa hết)
}
```

#### B. Sửa thứ tự gọi trong `create()`

Tìm dòng `this.addGrid();` và thay bằng:
```js
this.addGrassBackground();
```

Sau đó, tìm dòng `this.addObstacles(wallData);` và thêm dòng mới **ngay phía sau**:
```js
this.addDecorations();
```

> ⚠️ `addDecorations()` phải gọi SAU khi `this.obstacles` đã được khởi tạo (dòng `this.obstacles = this.physics.add.staticGroup()`).

#### C. Thêm method `addGrassBackground()`

```js
addGrassBackground() {
  // Base layer — tileSprite phủ toàn bản đồ (GPU efficient)
  this.add.tileSprite(800, 800, 1600, 1600, 'grass', 0).setDepth(-3);

  // 250 patch biến thể phủ lên để phá vỡ monotone
  let seed = 42;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0x100000000;
  };
  for (let i = 0; i < 250; i++) {
    const x = rng() * 1600;
    const y = rng() * 1600;
    const frame = 1 + Math.floor(rng() * 3); // frames 1-3 là biến thể
    this.add.image(x, y, 'grass', frame).setDepth(-2).setAlpha(0.55);
  }
}
```

#### D. Thêm method `addDecorations()`

```js
addDecorations() {
  const WORLD = 1600;
  const CENTER = 800;
  const SAFE_R = 230; // bán kính vùng spawn trung tâm — không đặt vật gì ở đây

  let seed = 1337;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0x100000000;
  };

  const placed = [];

  const isSafe = (x, y, r) => {
    // Không đặt trong vùng spawn trung tâm
    const dx = x - CENTER, dy = y - CENTER;
    if (Math.sqrt(dx * dx + dy * dy) < SAFE_R) return false;
    // Không đặt quá sát viền map
    if (x < 70 || x > WORLD - 70 || y < 70 || y > WORLD - 70) return false;
    // Không đặt chồng lên vật đã đặt trước
    return placed.every(p => {
      const ddx = p.x - x, ddy = p.y - y;
      return Math.sqrt(ddx * ddx + ddy * ddy) >= p.r + r + 10;
    });
  };

  const tryPlace = (count, r, fn) => {
    let placed_count = 0, attempts = 0;
    while (placed_count < count && attempts++ < count * 40) {
      const x = 70 + rng() * (WORLD - 140);
      const y = 70 + rng() * (WORLD - 140);
      if (isSafe(x, y, r)) {
        fn(x, y);
        placed.push({ x, y, r });
        placed_count++;
      }
    }
  };

  // --- Cây (18 cây, collidable) ---
  tryPlace(18, 26, (x, y) => {
    this.add.image(x, y, 'tree').setDepth(1);

    const body = this.physics.add.staticImage(x, y, null);
    body.setVisible(false).setActive(true);
    body.body.setSize(28, 28);
    body.refreshBody();
    this.obstacles.add(body);
  });

  // --- Đá (10 tảng, collidable) ---
  tryPlace(10, 18, (x, y) => {
    this.add.image(x, y, 'rock').setDepth(1);

    const body = this.physics.add.staticImage(x, y, null);
    body.setVisible(false).setActive(true);
    body.body.setSize(22, 16);
    body.refreshBody();
    this.obstacles.add(body);
  });

  // --- Hồ nước (5 hồ, decorative only — không có physics) ---
  tryPlace(5, 30, (x, y) => {
    const water = this.add.image(x, y, 'water', 0).setDepth(-1).setAlpha(0.8);
    let frame = 0;
    this.time.addEvent({
      delay: 1400 + Math.floor(rng() * 800),
      loop: true,
      callback: () => {
        frame = 1 - frame;
        water.setFrame(frame);
      }
    });
  });
}
```

#### E. Depth layering (để tham khảo)

| setDepth | Layer |
|----------|-------|
| -3 | Grass tileSprite (base) |
| -2 | Grass variation patches |
| -1 | Water pools |
| 0 | Player, Zombies (Phaser default) |
| 1 | Trees, Rocks, Wall obstacles |

---

## Checklist kiểm thử sau khi làm xong

### Phase 2
- [ ] Vào lobby → nhạc nền là `Iron_Underfoot.mp3` (nghe khác `Perimeter_Breach`)
- [ ] Nút 🔊 hiện ở góc trên-phải trên tất cả màn hình (login, lobby, in-game)
- [ ] Click 🔊 → tắt tiếng, icon đổi 🔇; BGM và SFX đều im
- [ ] Click 🔇 → bật lại, nhạc nền resume, SFX hoạt động
- [ ] Bắn zombie → tiếng đạn có độ biến thiên nhỏ (không đều đặn y hệt)
- [ ] Zombie bị bắn nhưng chưa chết → nghe tiếng hit nhỏ; zombie chết → tiếng lớn hơn

### Phase 3
- [ ] Vào game → nền xanh cỏ thay vì lưới xám tối
- [ ] Thấy cây/đá rải rác trên bản đồ, tránh vùng trung tâm
- [ ] Thấy 5 hồ nước có hiệu ứng shimmer (đổi frame chậm)
- [ ] Đi vào cây → bị chặn (collision hoạt động)
- [ ] Đi vào hồ nước → đi xuyên qua (decorative)
- [ ] Zombie cũng bị cây/đá chặn (cùng `obstacles` group)
- [ ] FPS không giảm đáng kể (kiểm tra bằng Phaser debug hoặc browser DevTools)
