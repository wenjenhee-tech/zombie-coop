import Player from './Player';
import Phaser from 'phaser';
import { store } from '../../store';

export class Gunner extends Player {
  constructor(scene, x, y) {
    super(scene, x, y);
    this.className = 'Gunner';
    this.color = 0x3498db; // Blue
    this.speed = 210;
    this.maxHp = 80;
    this.hp = this.maxHp;
    this.damage = 35;
    this.fireRate = 150;
    this.primaryCooldown = 18000;
    this.secondaryCooldown = 25000; // Passive CD
    this.piercingShots = false;
    this.bulletSpeedMult = 1;
    this.drawPlayer();
  }

  drawPlayer() {
    const g = this.graphics;
    g.clear();
    // Body circle
    g.fillStyle(0x3498db, 1);
    g.fillCircle(0, 0, 13);
    // Armor highlight ring
    g.lineStyle(2, 0xaed6f1, 0.85);
    g.strokeCircle(0, 0, 13);
    // Gun barrel (forward = right)
    g.fillStyle(0x1a5276, 1);
    g.fillRect(8, -3, 14, 6);
    // Muzzle tip
    g.fillStyle(0x0e2f44, 1);
    g.fillRect(20, -4, 4, 8);
    // Head dot
    g.fillStyle(0xd6eaf8, 1);
    g.fillCircle(0, 0, 4);
  }

  usePrimarySkill() {
    // Rain of Bullets
    this.addBuff('Rain_Of_Bullets');
    this.piercingShots = true;
    this.bulletSpeedMult = 2; // +100% projectile speed
    this.color = 0x85c1e9;
    // Glow version while active
    const g = this.graphics;
    g.clear();
    g.fillStyle(0x85c1e9, 1);
    g.fillCircle(0, 0, 13);
    g.lineStyle(2, 0xffffff, 1);
    g.strokeCircle(0, 0, 13);
    g.fillStyle(0x1a5276, 1);
    g.fillRect(8, -3, 14, 6);
    g.fillRect(20, -4, 4, 8);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(0, 0, 4);
    
    this.scene.time.delayedCall(3000, () => {
      this.activeBuffs = this.activeBuffs.filter(b => b !== 'Rain_Of_Bullets');
      this.piercingShots = false;
      this.bulletSpeedMult = 1;
      this.color = 0x3498db;
      if (this.active) this.drawPlayer();
    });
  }

  passiveTick(time) {
    // Adrenaline Rush (Passive)
    const isLowHp = this.hp <= this.maxHp * 0.3;
    const isReady = time > this.lastSecondaryUsed + this.secondaryCooldown;
    
    if (isLowHp && isReady && !this.hasBuff('Adrenaline_Rush')) {
      this.lastSecondaryUsed = time;
      this.addBuff('Adrenaline_Rush');
      const originalFireRate = this.fireRate;
      this.fireRate = originalFireRate * 0.6; // +40% fire rate (reduced delay)
      
      this.scene.time.delayedCall(5000, () => {
        this.activeBuffs = this.activeBuffs.filter(b => b !== 'Adrenaline_Rush');
        this.fireRate = originalFireRate;
      });
    }
  }
}

export class Tank extends Player {
  constructor(scene, x, y) {
    super(scene, x, y);
    this.className = 'Tank';
    this.color = 0xe74c3c; // Red
    this.speed = 150;
    this.maxHp = 150;
    this.hp = this.maxHp;
    this.damage = 20;
    this.fireRate = 200;
    this.primaryCooldown = 22000;
    this.secondaryCooldown = 16000;

    this.hitCount = 0;
    this.drawPlayer();
  }

  drawPlayer() {
    const g = this.graphics;
    g.clear();
    // Heavy armor body (square)
    g.fillStyle(0xe74c3c, 1);
    g.fillRect(-14, -14, 28, 28);
    // Inner plate
    g.fillStyle(0xc0392b, 1);
    g.fillRect(-9, -9, 18, 18);
    // Thick border
    g.lineStyle(3, 0xf1948a, 0.9);
    g.strokeRect(-14, -14, 28, 28);
    // Gun barrel (thick, short)
    g.fillStyle(0x7b241c, 1);
    g.fillRect(10, -4, 12, 8);
    // Visor eyes
    g.fillStyle(0xf9ebea, 0.9);
    g.fillCircle(-4, -2, 3);
    g.fillCircle(4, -2, 3);
  }

  usePrimarySkill() {
    // Shield Wall — local buff + broadcast to teammates in range
    this.addBuff('Shield_Wall');
    // Shield active: bright glow variant
    const g = this.graphics;
    g.clear();
    g.fillStyle(0xf5b7b1, 1);
    g.fillRect(-14, -14, 28, 28);
    g.fillStyle(0xf1948a, 1);
    g.fillRect(-9, -9, 18, 18);
    g.lineStyle(3, 0xffffff, 1);
    g.strokeRect(-14, -14, 28, 28);
    g.fillStyle(0x7b241c, 1);
    g.fillRect(10, -4, 12, 8);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(-4, -2, 3);
    g.fillCircle(4, -2, 3);

    store.socket.emit('shield_wall_active', {
      roomCode: store.playerStats.roomCode,
      tankId: store.socket.id,
      x: this.x,
      y: this.y,
      radius: 300,
      duration: 5000
    });

    this.scene.time.delayedCall(5000, () => {
      this.activeBuffs = this.activeBuffs.filter(b => b !== 'Shield_Wall');
      this.color = 0xe74c3c;
      if (this.active) this.drawPlayer();
    });
  }

  useSecondarySkill() {
    // Taunt — redirect nearby zombies to tank, broadcast to host
    this.addBuff('Taunt');

    this.scene.zombies.getChildren().forEach(z => {
      if (Phaser.Math.Distance.Between(this.x, this.y, z.x, z.y) <= 160) {
        z.setTarget(this);
      }
    });

    store.socket.emit('taunt_active', {
      roomCode: store.playerStats.roomCode,
      duration: 8000,
      tankId: store.socket.id,
      x: this.x,
      y: this.y
    });

    this.scene.time.delayedCall(8000, () => {
      this.activeBuffs = this.activeBuffs.filter(b => b !== 'Taunt');
    });
  }
  
  takeDamage(amount) {
    // Block every 5th hit (0 DMG)
    this.hitCount++;
    if (this.hitCount % 5 === 0) {
      amount = 0;
      // Show block text
      const text = this.scene.add.text(this.x, this.y - 20, 'BLOCKED', { fontSize: '12px', fill: '#00ff00' });
      this.scene.time.delayedCall(500, () => text.destroy());
    }

    if (this.hasBuff('Shield_Wall')) amount *= 0.4; // 60% reduction
    super.takeDamage(amount);
  }
}

export class Medic extends Player {
  constructor(scene, x, y) {
    super(scene, x, y);
    this.className = 'Medic';
    this.color = 0x2ecc71; // Green
    this.speed = 230;
    this.maxHp = 90;
    this.hp = this.maxHp;
    this.damage = 15;
    this.fireRate = 180;
    this.primaryCooldown = 20000;
    this.secondaryCooldown = 30000; // Passive CD for Auto-Defib
    this.drawPlayer();
  }

  drawPlayer() {
    const g = this.graphics;
    g.clear();
    // Body
    g.fillStyle(0x2ecc71, 1);
    g.fillCircle(0, 0, 13);
    g.lineStyle(2, 0x82e0aa, 0.85);
    g.strokeCircle(0, 0, 13);
    // White medical cross
    g.fillStyle(0xffffff, 0.92);
    g.fillRect(-2, -7, 4, 14);
    g.fillRect(-7, -2, 14, 4);
    // Syringe barrel (forward = right)
    g.fillStyle(0x1d8348, 1);
    g.fillRect(8, -2, 13, 4);
    g.fillStyle(0xabebc6, 1);
    g.fillRect(8, -2, 4, 4); // plunger end
  }

  usePrimarySkill() {
    // Emergency Kit — heal self then broadcast to teammates
    this.heal(30);
    store.socket.emit('heal_aoe', {
      roomCode: store.playerStats.roomCode,
      healAmount: 30,
      sourceId: store.socket.id
    });

    const effect = this.scene.add.graphics();
    effect.lineStyle(2, 0x2ecc71, 1);
    effect.strokeCircle(this.x, this.y, 130);
    this.scene.time.delayedCall(300, () => effect.destroy());
  }

  passiveTick(time) {
    // Auto-Defibrillator (Passive)
    // Heal 30HP if self or ally < 10% HP
    const isReady = time > this.lastSecondaryUsed + this.secondaryCooldown;
    if (!isReady) return;

    let trigger = false;
    if (this.hp <= this.maxHp * 0.1 && this.hp > 0) {
      this.heal(30);
      trigger = true;
    }
    
    // Assuming store.teammates has updated HP
    // Or check this.scene.otherPlayers if we had HP data, for now we heal self locally
    if (trigger) {
      this.lastSecondaryUsed = time;
      const text = this.scene.add.text(this.x, this.y - 20, '+30 HP', { fontSize: '14px', fill: '#00ff00', fontStyle: 'bold' });
      this.scene.time.delayedCall(800, () => text.destroy());
    }
  }
}

export class Trapper extends Player {
  constructor(scene, x, y) {
    super(scene, x, y);
    this.className = 'Trapper';
    this.color = 0xf39c12; // Orange
    this.speed = 230;
    this.maxHp = 85;
    this.hp = this.maxHp;
    this.damage = 15;
    this.fireRate = 150;
    this.primaryCooldown = 20000;
    this.secondaryCooldown = 12000;
    this.drawPlayer();
  }

  drawPlayer() {
    const g = this.graphics;
    g.clear();
    // Body
    g.fillStyle(0xf39c12, 1);
    g.fillCircle(0, 0, 13);
    g.lineStyle(2, 0xf8c471, 0.85);
    g.strokeCircle(0, 0, 13);
    // Trap X symbol (crossing lines)
    g.lineStyle(2.5, 0x7d6608, 1);
    g.lineBetween(-5, -5, 5, 5);
    g.lineBetween(5, -5, -5, 5);
    // Corner teeth/bolts
    g.fillStyle(0x7d6608, 1);
    g.fillCircle(-5, -5, 2);
    g.fillCircle(5, -5, 2);
    g.fillCircle(-5, 5, 2);
    g.fillCircle(5, 5, 2);
    // Gun barrel
    g.fillStyle(0x7d6608, 1);
    g.fillRect(8, -2, 13, 4);
  }

  usePrimarySkill() {
    // Mine Field — server-authoritative trigger, client chỉ gửi vị trí
    for (let i = 0; i < 5; i++) {
      const offsetX = Phaser.Math.Between(-160, 160);
      const offsetY = Phaser.Math.Between(-160, 160);
      store.socket.emit('mine_placed', {
        roomCode: store.playerStats.roomCode,
        x: this.x + offsetX,
        y: this.y + offsetY,
        isFreeze: false
      });
    }
  }

  useSecondarySkill() {
    // Freeze Trap (1 mine ngay vị trí, freeze 3s)
    store.socket.emit('mine_placed', {
      roomCode: store.playerStats.roomCode,
      x: this.x,
      y: this.y,
      isFreeze: true
    });
  }
}
