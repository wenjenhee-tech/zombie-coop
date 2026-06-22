import Player from './Player';
import Phaser from 'phaser';
import { store } from '../../store';

export class Ranged extends Player {
  constructor(scene, x, y) {
    super(scene, x, y, 'ranged_sprite');   // sprite tĩnh vẽ tay (Soul Knight), giữ layer súng
    this.className      = 'Ranged';
    this.playerClass    = 'ranged';
    this.color          = 0x3498db;
    this.speed          = 200;
    this.maxHp          = 85;
    this.hp             = this.maxHp;
    this.damage         = 20;
    this.fireRate       = 165;
    this.primaryCooldown   = 18000;
    this.secondaryCooldown = 6000;  // E "Lăn Né"
    this.tertiaryCooldown  = 14000;
    this.piercingShots  = false;
    this.bulletSpeedMult = 1;
    this.critChance     = 0.15; // Nội tại "Sát Thủ": 15% chí mạng ×2 dmg

    // Soul Knight: sprite tĩnh nhìn chính diện + lật theo chuột; KHÔNG ẩn súng (sprite không có súng).
    this.useSpriteAnim = true;
    this.spriteIdle    = null;     // tĩnh 1 frame
    this.hideWeapon    = false;    // vẫn vẽ súng xoay theo chuột
    this.setScale(0.7);            // ~45px hiển thị
    this.body.setSize(34, 44);     // hitbox khớp thân (toạ độ frame 63×64, tự scale)
  }

  usePrimarySkill() {
    this.addBuff('Rain_Of_Bullets');
    this.piercingShots   = true;
    this.bulletSpeedMult = 2;

    this.setTint(0x85c1e9);

    this.scene.time.delayedCall(3000, () => {
      this.removeBuff('Rain_Of_Bullets');
      this.piercingShots   = false;
      this.bulletSpeedMult = 1;
      if (this.active) this.clearTint();
    });
  }

  // Active "Lăn Né" (E) — lăn nhanh theo hướng đang đi (hoặc hướng ngắm nếu đứng yên),
  // bất tử khung hình suốt cú lăn + thêm chút đệm. Cơ động thuần, không sát thương.
  useSecondarySkill() {
    if (this._rolling) return;
    const c = this.cursors;
    let dx = 0, dy = 0;
    if (c.left.isDown) dx = -1; else if (c.right.isDown) dx = 1;
    if (c.up.isDown)   dy = -1; else if (c.down.isDown)  dy = 1;
    if (dx === 0 && dy === 0) { dx = Math.cos(this.aimAngle || 0); dy = Math.sin(this.aimAngle || 0); }
    const v = new Phaser.Math.Vector2(dx, dy).normalize();

    const ROLL_SPEED = 620, ROLL_MS = 220, IFRAME_PAD = 90;
    this._rolling = true;
    this._invuln  = true;
    this._rollVx  = v.x * ROLL_SPEED;
    this._rollVy  = v.y * ROLL_SPEED;
    this.setAlpha(0.55);

    this.scene.time.delayedCall(ROLL_MS, () => {
      this._rolling = false; this._rollVx = 0; this._rollVy = 0;
    });
    this.scene.time.delayedCall(ROLL_MS + IFRAME_PAD, () => {
      this._invuln = false;
      if (this.active) this.setAlpha(1);
    });
  }

  // Active "Lựu Đạn Cụm" (R) — ném lựu đạn về phía chuột, nổ AoE bán kính 140, 60 dmg.
  useTertiarySkill() {
    const p = this.scene.input.activePointer;
    const tx = p.worldX, ty = p.worldY;
    const g = this.scene.add.graphics({ x: this.x, y: this.y });
    g.fillStyle(0x2c3e50, 1); g.fillCircle(0, 0, 5);
    g.fillStyle(0x27ae60, 1); g.fillCircle(0, 0, 2);
    this.scene.tweens.add({
      targets: g, x: tx, y: ty, duration: 500,
      onComplete: () => {
        g.destroy();
        store.socket.emit('skill_burst', {
          roomCode: store.playerStats.roomCode,
          x: tx, y: ty, radius: 140, damage: 60, effect: null, fx: 'grenade'
        });
      }
    });
  }

  passiveTick(time) {
    // Nội tại "Adrenaline" — máu ≤30% tự buff tốc bắn. Cooldown RIÊNG (không còn dùng
    // chung slot E vì E giờ là "Lăn Né").
    const isLowHp = this.hp <= this.maxHp * 0.3;
    const isReady = time > (this._lastAdrenaline || 0) + 25000;

    if (isLowHp && isReady && !this.hasBuff('Adrenaline_Rush')) {
      this._lastAdrenaline = time;
      this.addBuff('Adrenaline_Rush');
      const orig = this.fireRate;
      this.fireRate = orig * 0.6;
      this.scene.time.delayedCall(5000, () => {
        this.removeBuff('Adrenaline_Rush');
        this.fireRate = orig;
      });
    }
  }
}

export class Melee extends Player {
  constructor(scene, x, y) {
    super(scene, x, y, 'melee_sprite');   // sprite tĩnh vẽ tay (Soul Knight)
    this.className      = 'Melee';
    this.playerClass    = 'melee';
    this.color          = 0xe74c3c;
    this.speed          = 155;
    this.maxHp          = 160;
    this.hp             = this.maxHp;
    this.damage         = 22;
    this.fireRate       = 200;
    this.primaryCooldown   = 22000;
    this.secondaryCooldown = 16000;
    this.tertiaryCooldown  = 16000;
    this.hitCount = 0;
    this.thornsRatio = 0.3; // Nội tại "Phản Đòn": dội 30% dmg về zombie tấn công

    // P1b-2: Melee THUẦN cận chiến — chém vòng cung (cleave) + hút máu, KHÔNG bắn đạn.
    // (số liệu mirror balance-sim STATS.melee.cleave)
    this.isMelee     = true;
    this.meleeDamage = 48;   // sát thương mỗi nhát
    this.meleeRate   = 500;  // ms giữa hai nhát
    this.meleeRange  = 84;   // tầm với (px)
    this.meleeArcDeg = 120;  // bề rộng vòng cung quét
    this.lifesteal   = 0.25; // hồi máu = 25% sát thương gây ra (cap 2 mục tiêu/nhát)

    // Sprite sheet 64×56: dùng chế độ Soul Knight (luôn nhìn chính diện + lật trái/phải),
    // không dùng walk_<dir>. Idle/bounce luôn chạy; vũ khí đã nằm trong sprite nên ẩn layer súng.
    this.useSpriteAnim = true;
    this.spriteIdle    = null;                        // sprite tĩnh 1 frame
    this.hideWeapon    = true;                        // cảm giác chém thể hiện qua slash-arc
    this.setScale(0.72);                              // ~43px hiển thị
    this.body.setSize(36, 46);                        // hitbox khớp thân (frame 59×64, tự scale)
    this.weaponGraphics.setVisible(false);
  }

  usePrimarySkill() {
    this.addBuff('Shield_Wall');
    this.setTint(0xf5b7b1);

    store.socket.emit('shield_wall_active', {
      roomCode: store.playerStats.roomCode,
      tankId:   store.socket.id,
      x: this.x, y: this.y,
      radius: 300, duration: 5000
    });

    this.scene.time.delayedCall(5000, () => {
      this.removeBuff('Shield_Wall');
      if (this.active) this.clearTint();
    });
  }

  useSecondarySkill() {
    this.addBuff('Taunt');
    this.scene.zombies.getChildren().forEach(z => {
      if (Phaser.Math.Distance.Between(this.x, this.y, z.x, z.y) <= 160) z.setTarget(this);
    });
    store.socket.emit('taunt_active', {
      roomCode: store.playerStats.roomCode,
      duration: 8000,
      tankId: store.socket.id,
      x: this.x, y: this.y
    });
    this.scene.time.delayedCall(8000, () => {
      this.removeBuff('Taunt');
    });
  }

  // Active "Giậm Đất" (R) — giậm tại chỗ, bán kính 160: 35 dmg + làm chậm zombie 2s.
  useTertiarySkill() {
    store.socket.emit('skill_burst', {
      roomCode: store.playerStats.roomCode,
      x: this.x, y: this.y, radius: 160, damage: 35, effect: 'slow', fx: 'slam'
    });
  }

  takeDamage(amount) {
    this.hitCount++;
    if (this.hitCount % 5 === 0) {
      amount = 0;
      const text = this.scene.add.text(this.x, this.y - 20, 'BLOCKED', { fontSize: '12px', fill: '#00ff00' });
      this.scene.time.delayedCall(500, () => text.destroy());
    }
    if (this.hasBuff('Shield_Wall')) amount *= 0.4;
    super.takeDamage(amount);
  }
}

export class Scientist extends Player {
  constructor(scene, x, y) {
    super(scene, x, y, 'scientist_sprite');   // sprite tĩnh vẽ tay (Soul Knight)
    this.className      = 'Scientist';
    this.playerClass    = 'scientist';
    this.color          = 0x2ecc71;
    this.speed          = 215;
    this.maxHp          = 95;
    this.hp             = this.maxHp;
    this.damage         = 18;
    this.fireRate       = 160;
    this.primaryCooldown   = 20000;
    this.secondaryCooldown = 14000; // E "Vùng Suy Nhược"
    this.tertiaryCooldown  = 22000;

    this.useSpriteAnim = true;
    this.spriteIdle    = null;
    this.hideWeapon    = false;   // Scientist bắn đạn → giữ súng xoay theo chuột
    this.setScale(0.72);
    this.body.setSize(34, 40);    // hitbox khớp thân (frame 64×56, tự scale)
  }

  usePrimarySkill() {
    this.heal(30);
    store.socket.emit('heal_aoe', {
      roomCode:   store.playerStats.roomCode,
      healAmount: 30,
      sourceId:   store.socket.id
    });
    const effect = this.scene.add.graphics();
    effect.lineStyle(2, 0x2ecc71, 1);
    effect.strokeCircle(this.x, this.y, 130);
    this.scene.time.delayedCall(300, () => effect.destroy());
  }

  // Active "Vùng Suy Nhược" (E) — gieo vùng debuff tại chỗ (bán kính 150): zombie dính
  // +40% sát thương nhận (vuln) + nhiễm độc 5 dmg/s trong 5s. Server-authoritative.
  useSecondarySkill() {
    store.socket.emit('debuff_zone', {
      roomCode:  store.playerStats.roomCode,
      x: this.x, y: this.y,
      radius: 150 + this.getBuffValue('Plague Doctor'), // Plague Doctor: +50px/stack
      vulnMs: 5000, poisonDps: 5, poisonMs: 5000
    });
  }

  // Active "Liều Kích Thích" (R) — buff cả đội (gồm bản thân): +40% tốc bắn, +20% tốc chạy 6s.
  useTertiarySkill() {
    this.applyStim(6000);
    store.socket.emit('team_stim', {
      roomCode: store.playerStats.roomCode,
      duration: 6000,
      sourceId: store.socket.id
    });
    const fx = this.scene.add.graphics();
    fx.lineStyle(3, 0xffe066, 1);
    fx.strokeCircle(this.x, this.y, 90);
    this.scene.time.delayedCall(300, () => fx.destroy());
  }

  passiveTick(time) {
    // Nội tại "Hào Quang Hồi Phục" — hồi 2HP cho cả đội (gồm bản thân) mỗi 2s
    if (time > (this._lastAuraTick || 0) + 2000) {
      this._lastAuraTick = time;
      this.heal(2);
      store.socket.emit('heal_aoe', {
        roomCode:   store.playerStats.roomCode,
        healAmount: 2,
        sourceId:   store.socket.id
      });
    }

    // Auto-Defib — tự cứu khi máu ≤10%. Cooldown RIÊNG (không dùng chung slot E nữa,
    // vì E giờ là "Vùng Suy Nhược").
    if (this.hp <= this.maxHp * 0.1 && this.hp > 0 && time > (this._lastDefib || 0) + 30000) {
      this.heal(30);
      this._lastDefib = time;
      const text = this.scene.add.text(this.x, this.y - 20, '+30 HP', { fontSize: '14px', fill: '#00ff00', fontStyle: 'bold' });
      this.scene.time.delayedCall(800, () => text.destroy());
    }
  }
}

export class Engineer extends Player {
  constructor(scene, x, y) {
    super(scene, x, y, 'engineer_sprite');   // sprite tĩnh vẽ tay (Soul Knight)
    this.className      = 'Engineer';
    this.playerClass    = 'engineer';
    this.color          = 0xf39c12;
    this.speed          = 210;
    this.maxHp          = 95;
    this.hp             = this.maxHp;
    this.damage         = 16;
    this.fireRate       = 150;
    this.primaryCooldown   = 20000;
    this.secondaryCooldown = 12000;
    this.tertiaryCooldown  = 15000;

    this.useSpriteAnim = true;
    this.spriteIdle    = null;
    this.hideWeapon    = false;   // Engineer bắn đạn → giữ súng xoay theo chuột
    this.setScale(0.72);
    this.body.setSize(36, 44);    // hitbox khớp thân (frame 64×64, tự scale)
  }

  // Active "Dựng Súng Máy" (Q) — đặt turret host-authority tại chỗ (cap 2, tự bắn 18dmg/0.6s,
  // sống 18s hoặc tới khi bị zombie vây bào hết HP). Server làm chủ toàn bộ.
  usePrimarySkill() {
    store.socket.emit('place_turret', {
      roomCode: store.playerStats.roomCode,
      x: this.x, y: this.y
    });
  }

  useSecondarySkill() {
    store.socket.emit('mine_placed', {
      roomCode: store.playerStats.roomCode,
      x: this.x, y: this.y,
      isFreeze: true
    });
  }

  // Active "Tháp Khuếch Đại" (R) — đặt pylon tại chỗ: đồng minh trong bán kính 280 nhận
  // +30% tốc bắn trong 8s. Server relay cho đồng đội; bản thân tự áp + tự vẽ tháp.
  useTertiarySkill() {
    const RADIUS = 280, DURATION = 8000;
    store.socket.emit('pylon_active', {
      roomCode: store.playerStats.roomCode,
      x: this.x, y: this.y, radius: RADIUS, duration: DURATION
    });
    // Caster tự nhận buff (server chỉ relay cho người khác)
    this.addBuff('Overcharge');
    this.scene.time.delayedCall(DURATION, () => this.removeBuff('Overcharge'));

    // Hình tháp + vòng aura tồn tại trong thời lượng buff
    const tower = this.scene.add.graphics({ x: this.x, y: this.y }).setDepth(8);
    tower.fillStyle(0xf39c12, 0.12); tower.fillCircle(0, 0, RADIUS);
    tower.lineStyle(2, 0xf6c453, 0.7); tower.strokeCircle(0, 0, RADIUS);
    tower.fillStyle(0x2c3e50, 1); tower.fillCircle(0, 0, 10);
    tower.fillStyle(0xf6c453, 1); tower.fillCircle(0, 0, 5);
    this.scene.tweens.add({ targets: tower, alpha: 0, duration: DURATION,
      onComplete: () => tower.destroy() });
  }

  passiveTick(time) {
    // Nội tại "Đinh Tán" — tự rải mìn mỗi 6s khi đang di chuyển
    const moving = Math.abs(this.body.velocity.x) > 10 || Math.abs(this.body.velocity.y) > 10;
    const mineInterval = 6000 * (1 - this.getBuffValue('Drone Protocol')); // Drone Protocol: -25%/stack
    if (moving && time > (this._lastCaltrop || 0) + mineInterval) {
      this._lastCaltrop = time;
      store.socket.emit('mine_placed', {
        roomCode: store.playerStats.roomCode,
        x: this.x, y: this.y,
        isFreeze: false
      });
    }
  }
}
