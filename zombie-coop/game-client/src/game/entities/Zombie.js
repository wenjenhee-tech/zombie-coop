import Phaser from 'phaser';
import { store } from '../../store';

export default class Zombie extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, type = 'walker') {
    super(scene, x, y, `zombie_${type}`);

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);

    this.type = type;
    this.setupStats();

    this.body.setSize(this.size, this.size);

    // Scale up large zombies to match their logical size
    if (this.size > 32) this.setScale(this.size / 32);

    this.target = null;
    this.activeEffects = [];
  }

  setupStats() {
    switch (this.type) {
      case 'runner':
        this.speed = 180; this.maxHp = 20; this.damage = 5;
        this.size = 24; this.color = 0x8B0000; break;
      case 'brute':
        this.speed = 80; this.maxHp = 200; this.damage = 25;
        this.size = 48; this.color = 0x3e2723; break;
      case 'spitter':
        this.speed = 100; this.maxHp = 30; this.damage = 10;
        this.size = 32; this.color = 0x1b5e20;
        this.spitCooldown = 3000; this.lastSpitTime = 0; this.spitRange = 300; break;
      case 'hordeking':
        this.speed = 90; this.maxHp = 500; this.damage = 30;
        this.size = 64; this.color = 0x000000;
        this.hasScreamed = false; this.screamCooldown = 20000; this.lastScreamTime = 0; break;
      case 'screamer':
        this.speed = 150; this.maxHp = 15; this.damage = 0;
        this.size = 28; this.color = 0xf1c40f; break;
      case 'exploder':
        this.speed = 60; this.maxHp = 40; this.damage = 0;
        this.size = 40; this.color = 0x8e44ad;
        this.explodeRange = 70; this.explodeDamage = 25; break;
      case 'walker':
      default:
        this.speed = 100; this.maxHp = 30; this.damage = 10;
        this.size = 32; this.color = 0x550000; break;
    }
    this.hp = this.maxHp;
    this.speedMultiplier = 1;
  }

  setTarget(target) { this.target = target; }

  update(time, _delta) {
    if (!this.active) return;

    let targetX, targetY;
    if (this.tauntUntil && time < this.tauntUntil) {
      targetX = this.tauntTargetX;
      targetY = this.tauntTargetY;
    } else if (this.target && this.target.active) {
      targetX = this.target.x;
      targetY = this.target.y;
    }

    if (targetX !== undefined) {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);

      if (this.hasEffect('freeze')) {
        this.setVelocity(0, 0);
      } else {
        let spd = this.speed * (this.speedMultiplier || 1);
        if (this.hasEffect('slow')) spd *= 0.5;
        this.scene.physics.velocityFromRotation(angle, spd, this.body.velocity);
      }

      this._updateFacingAnim();

      // Spitter: ranged spit
      if (this.type === 'spitter' && this.target && this.target.active) {
        const dist = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
        if (dist < this.spitRange && time > this.lastSpitTime + this.spitCooldown) {
          this.lastSpitTime = time;
          this.shootSpit(angle);
        }
      }

      // Hordeking: AoE scream at 50% HP
      if (this.type === 'hordeking' && this.hp < this.maxHp * 0.5 && !this.hasScreamed) {
        if (time > this.lastScreamTime + this.screamCooldown) {
          this.lastScreamTime = time;
          this.hasScreamed = true;
          this.doScream();
        }
      }

    } else {
      this.setVelocity(0, 0);
      this.anims.stop();
    }
  }

  _updateFacingAnim() {
    const vx = this.body.velocity.x;
    const vy = this.body.velocity.y;
    if (Math.abs(vx) < 5 && Math.abs(vy) < 5) { this.anims.stop(); return; }

    const dir = Math.abs(vx) > Math.abs(vy)
      ? (vx > 0 ? 'right' : 'left')
      : (vy > 0 ? 'down'  : 'up');

    const key = `zombie_${this.type}_walk_${dir}`;
    if (this.anims.currentAnim?.key !== key) this.play(key);
  }

  shootSpit(angle) {
    if (!store.currentRoomDetails || !store.currentRoomDetails.isHost) return;

    const spit = this.scene.add.graphics({ x: this.x, y: this.y });
    spit.fillStyle(0x00cc00, 1);
    spit.fillCircle(0, 0, 5);
    this.scene.physics.add.existing(spit);
    this.scene.physics.velocityFromRotation(angle, 200, spit.body.velocity);
    spit.damage = 8;

    this.scene.physics.add.overlap(spit, this.target, (proj, player) => {
      if (!spit.active) return;
      spit.destroy();
      player.takeDamage(proj.damage);
    });
    this.scene.time.delayedCall(1500, () => { if (spit.active) spit.destroy(); });
  }

  doScream() {
    const ring = this.scene.add.graphics();
    ring.lineStyle(3, 0xff0000, 1);
    ring.strokeCircle(this.x, this.y, 200);
    this.scene.time.delayedCall(400, () => ring.destroy());

    if (this.target && this.target.active) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
      if (dist < 200) {
        const pushAngle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
        this.scene.physics.velocityFromRotation(pushAngle, 400, this.target.body.velocity);
        this.hasScreamed = false;
      }
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.die();
    } else {
      this.setTint(0xffffff);
      this.scene.time.delayedCall(100, () => { if (this.active) this.clearTint(); });
    }
  }

  applyEffect(effectName, duration) {
    if (!this.activeEffects.includes(effectName)) {
      this.activeEffects.push(effectName);
      this.scene.time.delayedCall(duration, () => {
        this.activeEffects = this.activeEffects.filter(e => e !== effectName);
      });
    }
  }

  hasEffect(effectName) { return this.activeEffects.includes(effectName); }

  die() { this.destroy(); }
}
