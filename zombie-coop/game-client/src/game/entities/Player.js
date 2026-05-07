import Phaser from 'phaser';

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, texture = 'player') {
    super(scene, x, y, texture);
    
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.body.setSize(32, 32);

    // Default Stats (to be overridden by subclasses)
    this.className = 'Base';
    this.speed = 200;
    this.maxHp = 100;
    this.hp = this.maxHp;
    this.damage = 15;
    this.fireRate = 150; // ms
    this.color = 0x00ff00;

    // Buffs
    this.activeBuffs = [];

    // Graphics
    this.graphics = scene.add.graphics();
    this.drawPlayer();
    
    // Setup input
    this.cursors = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      primarySkill: Phaser.Input.Keyboard.KeyCodes.Q,
      secondarySkill: Phaser.Input.Keyboard.KeyCodes.E
    });
    
    // Skill cooldown tracking
    this.lastPrimaryUsed = 0;
    this.primaryCooldown = 5000; // ms
    this.lastSecondaryUsed = 0;
    this.secondaryCooldown = 5000; // ms
  }

  drawPlayer() {
    this.graphics.clear();
    this.graphics.fillStyle(this.color, 1);
    this.graphics.fillCircle(0, 0, 16);
    this.graphics.lineStyle(2, 0xffffff, 1);
    this.graphics.strokeCircle(0, 0, 16);
  }

  update(time, delta) {
    if (!this.active) return;
    this.handleMovement();
    this.updateGraphicsPosition();
    this.handleRotation();
    
    // Passive skill ticks (if any)
    this.passiveTick(time);
    
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
    let velocityX = 0;
    let velocityY = 0;

    if (this.cursors.left.isDown) velocityX = -1;
    else if (this.cursors.right.isDown) velocityX = 1;

    if (this.cursors.up.isDown) velocityY = -1;
    else if (this.cursors.down.isDown) velocityY = 1;

    const vector = new Phaser.Math.Vector2(velocityX, velocityY).normalize();
    // Apply speed multipliers from buffs if any
    let currentSpeed = this.speed;
    if (this.hasBuff('Speed Boost')) currentSpeed *= 1.2;

    this.setVelocity(vector.x * currentSpeed, vector.y * currentSpeed);
  }

  handleRotation() {
    const pointer = this.scene.input.activePointer;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, pointer.worldX, pointer.worldY);
    this.setRotation(angle);
    this.graphics.setRotation(angle);
  }

  updateGraphicsPosition() {
    this.graphics.setPosition(this.x, this.y);
  }

  takeDamage(amount) {
    if (this.hasBuff('Iron Skin')) amount *= 0.75; // 25% reduction
    
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
      return; // Không flash effect nữa, graphics đã bị destroy
    }
    
    this.graphics.clear();
    this.graphics.fillStyle(0xff0000, 1);
    this.graphics.fillCircle(0, 0, 16);
    
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.drawPlayer();
    });
  }
  
  heal(amount) {
    this.hp = Math.min(this.hp + amount, this.maxHp);
  }

  die() {
    console.log(`${this.className} Died!`);
    // Disable thay vì destroy để có thể respawn (revive)
    this.setActive(false);
    this.setVisible(false);
    if (this.graphics) this.graphics.setVisible(false);
    if (this.body) {
      this.body.setVelocity(0, 0);
      this.body.enable = false;
    }
  }

  respawn(x, y, hp) {
    this.hp = hp;
    this.setActive(true);
    this.setVisible(true);
    if (this.graphics) this.graphics.setVisible(true);
    if (this.body) {
      this.body.enable = true;
      this.body.reset(x, y);
    } else {
      this.setPosition(x, y);
    }
    this.drawPlayer();
    this.lastHit = 0;
  }

  usePrimarySkill() {
    console.log(`${this.className} used primary skill!`);
  }
  
  useSecondarySkill() {
    console.log(`${this.className} used secondary skill!`);
  }

  passiveTick(time) {
    // Override in subclasses
  }

  addBuff(buffId) {
    if (!this.activeBuffs.includes(buffId)) {
      this.activeBuffs.push(buffId);
    }
  }

  hasBuff(buffId) {
    return this.activeBuffs.includes(buffId);
  }
}
