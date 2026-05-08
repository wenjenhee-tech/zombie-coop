import Player from './Player';
import Phaser from 'phaser';
import { store } from '../../store';

export class Gunner extends Player {
  constructor(scene, x, y) {
    super(scene, x, y, 'player_gunner');
    this.className      = 'Gunner';
    this.playerClass    = 'gunner';
    this.color          = 0x3498db;
    this.speed          = 210;
    this.maxHp          = 80;
    this.hp             = this.maxHp;
    this.damage         = 35;
    this.fireRate       = 150;
    this.primaryCooldown   = 18000;
    this.secondaryCooldown = 25000;
    this.piercingShots  = false;
    this.bulletSpeedMult = 1;
  }

  _redrawWeapon() {
    const g = this.weaponGraphics;
    g.clear();
    const isActive = this.hasBuff('Rain_Of_Bullets');
    g.fillStyle(isActive ? 0x1a8ad0 : 0x1a5276, 1);
    g.fillRect(10, -3, 14, 6);
    g.fillStyle(isActive ? 0x0e6090 : 0x0e2f44, 1);
    g.fillRect(22, -4, 4, 8);
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

export class Tank extends Player {
  constructor(scene, x, y) {
    super(scene, x, y, 'player_tank');
    this.className      = 'Tank';
    this.playerClass    = 'tank';
    this.color          = 0xe74c3c;
    this.speed          = 150;
    this.maxHp          = 150;
    this.hp             = this.maxHp;
    this.damage         = 20;
    this.fireRate       = 200;
    this.primaryCooldown   = 22000;
    this.secondaryCooldown = 16000;
    this.hitCount = 0;
  }

  _redrawWeapon() {
    const g = this.weaponGraphics;
    g.clear();
    g.fillStyle(0x7b241c, 1);
    g.fillRect(10, -5, 10, 10); // thick short barrel
    g.fillStyle(0x4a120c, 1);
    g.fillRect(18, -6, 4, 12);
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

export class Medic extends Player {
  constructor(scene, x, y) {
    super(scene, x, y, 'player_medic');
    this.className      = 'Medic';
    this.playerClass    = 'medic';
    this.color          = 0x2ecc71;
    this.speed          = 230;
    this.maxHp          = 90;
    this.hp             = this.maxHp;
    this.damage         = 15;
    this.fireRate       = 180;
    this.primaryCooldown   = 20000;
    this.secondaryCooldown = 30000;
  }

  _redrawWeapon() {
    const g = this.weaponGraphics;
    g.clear();
    // Syringe
    g.fillStyle(0x1d8348, 1);
    g.fillRect(10, -2, 13, 4);
    g.fillStyle(0xabebc6, 1);
    g.fillRect(10, -2, 4, 4); // plunger end
    g.fillStyle(0xabebc6, 0.7);
    g.fillRect(20, -1, 5, 2); // needle
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

  passiveTick(time) {
    const isReady = time > this.lastSecondaryUsed + this.secondaryCooldown;
    if (!isReady) return;
    if (this.hp <= this.maxHp * 0.1 && this.hp > 0) {
      this.heal(30);
      this.lastSecondaryUsed = time;
      const text = this.scene.add.text(this.x, this.y - 20, '+30 HP', { fontSize: '14px', fill: '#00ff00', fontStyle: 'bold' });
      this.scene.time.delayedCall(800, () => text.destroy());
    }
  }
}

export class Trapper extends Player {
  constructor(scene, x, y) {
    super(scene, x, y, 'player_trapper');
    this.className      = 'Trapper';
    this.playerClass    = 'trapper';
    this.color          = 0xf39c12;
    this.speed          = 230;
    this.maxHp          = 85;
    this.hp             = this.maxHp;
    this.damage         = 15;
    this.fireRate       = 150;
    this.primaryCooldown   = 20000;
    this.secondaryCooldown = 12000;
  }

  _redrawWeapon() {
    const g = this.weaponGraphics;
    g.clear();
    g.fillStyle(0x7d6608, 1);
    g.fillRect(10, -2, 12, 4);
    // Trap crosshair at muzzle
    g.lineStyle(1.5, 0xf39c12, 1);
    g.lineBetween(24, -4, 28, 0);
    g.lineBetween(28, 0, 24, 4);
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
}
