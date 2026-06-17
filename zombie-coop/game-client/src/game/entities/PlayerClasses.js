import Player from './Player';
import Phaser from 'phaser';
import { store } from '../../store';

export class Ranged extends Player {
  constructor(scene, x, y) {
    super(scene, x, y, 'player_ranged');
    this.className      = 'Ranged';
    this.playerClass    = 'ranged';
    this.color          = 0x3498db;
    this.speed          = 200;
    this.maxHp          = 85;
    this.hp             = this.maxHp;
    this.damage         = 20;
    this.fireRate       = 165;
    this.primaryCooldown   = 18000;
    this.secondaryCooldown = 25000;
    this.tertiaryCooldown  = 14000;
    this.piercingShots  = false;
    this.bulletSpeedMult = 1;
    this.critChance     = 0.15; // Nội tại "Sát Thủ": 15% chí mạng ×2 dmg

    // Sprite Gunner redesign ở 48px → hitbox khớp thân nhìn thấy (rộng 24, cao 34),
    // tự canh giữa frame. Chỉ đổi vùng va chạm, KHÔNG đổi speed/hp/damage.
    this.body.setSize(24, 34);
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
    const isLowHp = this.hp <= this.maxHp * 0.3;
    const isReady = time > this.lastSecondaryUsed + this.secondaryCooldown;

    if (isLowHp && isReady && !this.hasBuff('Adrenaline_Rush')) {
      this.lastSecondaryUsed = time;
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
    super(scene, x, y, 'player_melee');
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

    // Sprite redesign 48px (to nặng) → hitbox khớp thân. Chỉ vùng va chạm.
    this.body.setSize(28, 34);
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
    super(scene, x, y, 'player_scientist');
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

    this.body.setSize(24, 34); // sprite 48px → hitbox khớp thân
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
      radius: 150, vulnMs: 5000, poisonDps: 5, poisonMs: 5000
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
    super(scene, x, y, 'player_engineer');
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

    this.body.setSize(24, 34); // sprite 48px → hitbox khớp thân
  }

  usePrimarySkill() {
    for (let i = 0; i < 5; i++) {
      store.socket.emit('mine_placed', {
        roomCode: store.playerStats.roomCode,
        x: this.x + Phaser.Math.Between(-160, 160),
        y: this.y + Phaser.Math.Between(-160, 160),
        isFreeze: false
      });
    }
  }

  useSecondarySkill() {
    store.socket.emit('mine_placed', {
      roomCode: store.playerStats.roomCode,
      x: this.x, y: this.y,
      isFreeze: true
    });
  }

  // Active "Súng Lưới" (R) — bắn lưới (tầm tối đa 320) đóng băng zombie vùng 120 trong 3s + 20 dmg.
  useTertiarySkill() {
    const p = this.scene.input.activePointer;
    const ang = Phaser.Math.Angle.Between(this.x, this.y, p.worldX, p.worldY);
    const range = Math.min(Phaser.Math.Distance.Between(this.x, this.y, p.worldX, p.worldY), 320);
    const tx = this.x + Math.cos(ang) * range;
    const ty = this.y + Math.sin(ang) * range;
    const net = this.scene.add.graphics({ x: this.x, y: this.y });
    net.lineStyle(2, 0xecf0f1, 1);
    net.strokeCircle(0, 0, 6);
    this.scene.tweens.add({
      targets: net, x: tx, y: ty, duration: 350,
      onComplete: () => {
        net.destroy();
        store.socket.emit('skill_burst', {
          roomCode: store.playerStats.roomCode,
          x: tx, y: ty, radius: 120, damage: 20, effect: 'freeze', fx: 'net'
        });
      }
    });
  }

  passiveTick(time) {
    // Nội tại "Đinh Tán" — tự rải mìn mỗi 6s khi đang di chuyển
    const moving = Math.abs(this.body.velocity.x) > 10 || Math.abs(this.body.velocity.y) > 10;
    if (moving && time > (this._lastCaltrop || 0) + 6000) {
      this._lastCaltrop = time;
      store.socket.emit('mine_placed', {
        roomCode: store.playerStats.roomCode,
        x: this.x, y: this.y,
        isFreeze: false
      });
    }
  }
}
