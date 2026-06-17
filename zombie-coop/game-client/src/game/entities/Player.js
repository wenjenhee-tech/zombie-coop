import Phaser from 'phaser';
import { drawWeapon } from '../weapons';

const BUFF_INCREMENTS = {
  'Speed Boost': [0.20, 0.10, 0.05],
  'Iron Skin':   [0.25, 0.15, 0.05],
  'Fire Ammo':   [1, 1, 1],
  'Regen Aura':  [1.0, 0.5, 0.25],   // HP/s per stack
  'Rapid Fire':  [0.25, 0.15, 0.10],  // fire-rate multiplier per stack
  'Medkit Surge':[20,   15,   10],     // immediate HP per stack
  'Combat Stim': [0.20]                // +20% tốc chạy (Medic Liều Kích Thích)
};

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, texture = 'player_ranged') {
    super(scene, x, y, texture);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.body.setSize(28, 28);

    // Default Stats (overridden by subclasses)
    this.className = 'Base';
    this.playerClass = 'ranged';
    this.speed = 200;
    this.maxHp = 100;
    this.hp = this.maxHp;
    this.damage = 15;
    this.fireRate = 150;
    this.color = 0x00ff00;

    // Buffs
    this.activeBuffs = {};
    this.buffValues = {};

    // Nội tại (passive) — subclass override; mặc định tắt
    this.critChance  = 0; // Gunner: tỉ lệ chí mạng ×2 dmg
    this.thornsRatio = 0; // Tank: tỉ lệ dmg dội ngược về zombie tấn công

    // Weapon graphics layer (rotates toward mouse, drawn on top)
    this.weaponGraphics = scene.add.graphics();
    this._recoil = 0;        // độ giật nòng hiện tại (px), hồi dần về 0
    this._muzzleUntil = 0;   // thời điểm tắt chớp lửa đầu nòng
    this._redrawWeapon();

    // Setup input
    this.cursors = scene.input.keyboard.addKeys({
      up:             Phaser.Input.Keyboard.KeyCodes.W,
      down:           Phaser.Input.Keyboard.KeyCodes.S,
      left:           Phaser.Input.Keyboard.KeyCodes.A,
      right:          Phaser.Input.Keyboard.KeyCodes.D,
      primarySkill:   Phaser.Input.Keyboard.KeyCodes.Q,
      secondarySkill: Phaser.Input.Keyboard.KeyCodes.E,
      tertiarySkill:  Phaser.Input.Keyboard.KeyCodes.R
    });

    // Skill cooldown tracking
    this.lastPrimaryUsed   = 0;
    this.primaryCooldown   = 5000;
    this.lastSecondaryUsed = 0;
    this.secondaryCooldown = 5000;
    this.lastTertiaryUsed  = 0;
    this.tertiaryCooldown  = 5000;
  }

  // Vẽ vũ khí theo class (dùng chung với người chơi khác qua weapons.js).
  // Subclasses không cần override nữa — drawWeapon tự phân loại theo playerClass.
  _redrawWeapon() {
    drawWeapon(this.weaponGraphics, this.playerClass, {
      active: this.hasBuff('Rain_Of_Bullets'),         // gunner: sáng lên
      muzzle: this.scene.time.now < this._muzzleUntil, // chớp lửa vài frame sau bắn
    });
  }

  // Gọi từ GameScene.shoot() khi player bắn — kích recoil + chớp lửa đầu nòng.
  fireFx() {
    this._recoil = 5;
    this._muzzleUntil = this.scene.time.now + 55;
  }

  // Melee: kích animation vung vũ khí theo cung (gọi từ GameScene.meleeSwing()).
  swingFx() { this._swingUntil = this.scene.time.now + 160; }

  update(time, delta) {
    if (!this.active) return;
    this.handleMovement();
    this._updateFacingAnim();
    this.handleRotation();

    this.passiveTick(time);
    this._basePassive(time);

    if (Phaser.Input.Keyboard.JustDown(this.cursors.primarySkill)) {
      if (time > this.lastPrimaryUsed + this.primaryCooldown) {
        this.usePrimarySkill();
        this.lastPrimaryUsed = time;
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.secondarySkill)) {
      if (time > this.lastSecondaryUsed + this.secondaryCooldown) {
        this.useSecondarySkill();
        this.lastSecondaryUsed = time;
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.tertiarySkill)) {
      if (time > this.lastTertiaryUsed + this.tertiaryCooldown) {
        this.useTertiarySkill();
        this.lastTertiaryUsed = time;
      }
    }
  }

  handleMovement() {
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown)  vx = -1;
    else if (this.cursors.right.isDown) vx = 1;
    if (this.cursors.up.isDown)    vy = -1;
    else if (this.cursors.down.isDown)  vy = 1;

    const vec = new Phaser.Math.Vector2(vx, vy).normalize();
    let spd = this.speed;
    spd *= (1 + this.getBuffValue('Speed Boost') + this.getBuffValue('Combat Stim'));
    this.setVelocity(vec.x * spd, vec.y * spd);
  }

  _updateFacingAnim() {
    const vx = this.body.velocity.x;
    const vy = this.body.velocity.y;
    const moving = Math.abs(vx) > 10 || Math.abs(vy) > 10;

    if (!moving) {
      this.anims.stop();
      return;
    }

    const dir = Math.abs(vx) > Math.abs(vy)
      ? (vx > 0 ? 'right' : 'left')
      : (vy > 0 ? 'down'  : 'up');

    const key = `player_${this.playerClass}_walk_${dir}`;
    if (this.anims.currentAnim?.key !== key) this.play(key);
  }

  handleRotation() {
    const pointer = this.scene.input.activePointer;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, pointer.worldX, pointer.worldY);
    this.aimAngle = angle; // góc ngắm (thân không xoay) — gửi qua player_move cho đồng đội
    // Recoil: nòng giật lùi theo hướng ngắm rồi hồi dần
    this._recoil = this._recoil > 0.3 ? this._recoil * 0.7 : 0;
    const rc = this._recoil;
    // Body does NOT rotate — only weapon layer tracks the mouse
    this.weaponGraphics.setPosition(this.x - Math.cos(angle) * rc, this.y - Math.sin(angle) * rc);
    // Melee: trong lúc chém, quét vũ khí theo cung (-0.8 → +0.8 rad) quanh hướng ngắm
    let drawAngle = angle;
    if (this.isMelee && this.scene.time.now < (this._swingUntil || 0)) {
      const t = 1 - (this._swingUntil - this.scene.time.now) / 160;
      drawAngle = angle - 0.8 + 1.6 * t;
    }
    this.weaponGraphics.setRotation(drawAngle);
    // Ngắm sang trái → lật dọc để súng không bị lộn ngược (4 hướng hợp lý)
    this.weaponGraphics.scaleY = Math.abs(angle) > Math.PI / 2 ? -1 : 1;
    this._redrawWeapon();
  }

  takeDamage(amount) {
    amount *= (1 - this.getBuffValue('Iron Skin'));

    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
      return;
    }

    this.setTint(0xff5555);
    this.scene.time.delayedCall(100, () => { if (this.active) this.clearTint(); });
  }

  heal(amount) {
    this.hp = Math.min(this.hp + amount, this.maxHp);
  }

  die() {
    console.log(`${this.className} Died!`);
    this.setActive(false);
    this.setVisible(false);
    this.weaponGraphics.setVisible(false);
    if (this.body) {
      this.body.setVelocity(0, 0);
      this.body.enable = false;
    }
  }

  respawn(x, y, hp) {
    this.hp = hp;
    this.setActive(true);
    this.setVisible(true);
    this.clearTint();
    this.weaponGraphics.setVisible(true);
    if (this.body) {
      this.body.enable = true;
      this.body.reset(x, y);
    } else {
      this.setPosition(x, y);
    }
    this.lastHit = 0;
  }

  usePrimarySkill()   { console.log(`${this.className} used primary skill!`); }
  useSecondarySkill() { console.log(`${this.className} used secondary skill!`); }
  useTertiarySkill()  { console.log(`${this.className} used tertiary skill!`); }
  passiveTick(_time)  {}

  // Liều Kích Thích (Medic) — buff +40% tốc bắn, +20% tốc chạy trong `duration`ms.
  // Áp cho chính người gọi và cho mỗi đồng đội qua event team_stim.
  applyStim(duration = 6000) {
    if (this._stimActive) return;
    this._stimActive = true;
    this.addBuff('Combat Stim');
    const origFireRate = this.fireRate;
    this.fireRate = Math.round(origFireRate * 0.6);
    const origMelee = this.meleeRate;
    if (this.isMelee) this.meleeRate = Math.round(origMelee * 0.6); // stim cũng tăng tốc chém
    this.setTint(0xffe066);
    this.scene.time.delayedCall(duration, () => {
      this.removeBuff('Combat Stim');
      this.fireRate = origFireRate;
      if (this.isMelee) this.meleeRate = origMelee;
      this._stimActive = false;
      if (this.active) this.clearTint();
    });
  }

  _basePassive(time) {
    if (this.hasBuff('Regen Aura') && time > (this.lastHit || 0) + 5000) {
      if (!this._lastRegen || time > this._lastRegen + 1000) {
        this._lastRegen = time;
        this.heal(this.getBuffValue('Regen Aura'));
      }
    }
  }

  addBuff(buffId) {
    const current = this.activeBuffs[buffId] || 0;
    const inc = BUFF_INCREMENTS[buffId];
    if (!inc) {
      this.activeBuffs[buffId] = 1;
      return;
    }
    if (current >= inc.length) return;
    const value = inc[current];
    this.activeBuffs[buffId] = current + 1;
    this.buffValues[buffId]  = (this.buffValues[buffId] || 0) + value;
    if (buffId === 'Medkit Surge') this.heal(value); // immediate heal
  }

  removeBuff(buffId) {
    if (!this.activeBuffs[buffId]) return;
    const inc = BUFF_INCREMENTS[buffId];
    if (!inc) {
      delete this.activeBuffs[buffId];
      return;
    }
    const current = this.activeBuffs[buffId];
    if (current > 0) {
      const value = inc[current - 1];
      this.activeBuffs[buffId] = current - 1;
      this.buffValues[buffId] = (this.buffValues[buffId] || 0) - value;
      if (this.activeBuffs[buffId] <= 0) {
        delete this.activeBuffs[buffId];
      }
    }
  }

  hasBuff(buffId) { return (this.activeBuffs[buffId] || 0) > 0; }
  getBuffValue(buffId) { return this.buffValues[buffId] || 0; }
}
