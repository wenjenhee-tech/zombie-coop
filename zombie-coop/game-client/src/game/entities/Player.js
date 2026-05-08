import Phaser from 'phaser';

const BUFF_INCREMENTS = {
  'Speed Boost': [0.20, 0.10, 0.05],
  'Iron Skin':   [0.25, 0.15, 0.05],
  'Fire Ammo':   [1, 1, 1],
  'Regen Aura':  [1.0, 0.5, 0.25],   // HP/s per stack
  'Rapid Fire':  [0.25, 0.15, 0.10],  // fire-rate multiplier per stack
  'Medkit Surge':[20,   15,   10]      // immediate HP per stack
};

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, texture = 'player_gunner') {
    super(scene, x, y, texture);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.body.setSize(28, 28);

    // Default Stats (overridden by subclasses)
    this.className = 'Base';
    this.playerClass = 'gunner';
    this.speed = 200;
    this.maxHp = 100;
    this.hp = this.maxHp;
    this.damage = 15;
    this.fireRate = 150;
    this.color = 0x00ff00;

    // Buffs
    this.activeBuffs = {};
    this.buffValues = {};

    // Weapon graphics layer (rotates toward mouse, drawn on top)
    this.weaponGraphics = scene.add.graphics();
    this._redrawWeapon();

    // Setup input
    this.cursors = scene.input.keyboard.addKeys({
      up:             Phaser.Input.Keyboard.KeyCodes.W,
      down:           Phaser.Input.Keyboard.KeyCodes.S,
      left:           Phaser.Input.Keyboard.KeyCodes.A,
      right:          Phaser.Input.Keyboard.KeyCodes.D,
      primarySkill:   Phaser.Input.Keyboard.KeyCodes.Q,
      secondarySkill: Phaser.Input.Keyboard.KeyCodes.E
    });

    // Skill cooldown tracking
    this.lastPrimaryUsed   = 0;
    this.primaryCooldown   = 5000;
    this.lastSecondaryUsed = 0;
    this.secondaryCooldown = 5000;
  }

  // Subclasses override to draw their weapon shape
  _redrawWeapon() {
    const g = this.weaponGraphics;
    g.clear();
    // Default barrel (forward = right)
    g.fillStyle(0x444444, 1);
    g.fillRect(10, -3, 14, 6);
    g.fillStyle(0x222222, 1);
    g.fillRect(22, -4, 4, 8);
  }

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
  }

  handleMovement() {
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown)  vx = -1;
    else if (this.cursors.right.isDown) vx = 1;
    if (this.cursors.up.isDown)    vy = -1;
    else if (this.cursors.down.isDown)  vy = 1;

    const vec = new Phaser.Math.Vector2(vx, vy).normalize();
    let spd = this.speed;
    spd *= (1 + this.getBuffValue('Speed Boost'));
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
    // Body does NOT rotate — only weapon layer tracks the mouse
    this.weaponGraphics.setPosition(this.x, this.y);
    this.weaponGraphics.setRotation(angle);
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
  passiveTick(_time)  {}

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
