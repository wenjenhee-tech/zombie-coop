import Phaser from 'phaser';
import { store } from '../../store';

export default class Zombie extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, type = 'walker') {
    super(scene, x, y, 'zombie');

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    
    // Stats based on type
    this.type = type;
    this.setupStats();

    this.body.setSize(this.size, this.size);

    // Graphics
    this.graphics = scene.add.graphics();
    this.drawZombie();

    this.target = null;
    
    // Buff effects
    this.activeEffects = [];
  }

  setupStats() {
    switch (this.type) {
      case 'runner':
        this.speed = 180;
        this.maxHp = 20;
        this.damage = 5;
        this.size = 24;
        this.color = 0x8B0000;
        break;
      case 'brute':
        this.speed = 80;
        this.maxHp = 200;
        this.damage = 25;
        this.size = 48;
        this.color = 0x3e2723;
        break;
      case 'spitter':
        this.speed = 100;
        this.maxHp = 30;
        this.damage = 10;
        this.size = 32;
        this.color = 0x1b5e20;
        this.spitCooldown = 3000;
        this.lastSpitTime = 0;
        this.spitRange = 300;
        break;
      case 'hordeking':
        this.speed = 90;
        this.maxHp = 500;
        this.damage = 30;
        this.size = 64;
        this.color = 0x000000;
        this.hasScreamed = false;
        this.screamCooldown = 20000;
        this.lastScreamTime = 0;
        break;
      case 'screamer':
        this.speed = 150;
        this.maxHp = 15;
        this.damage = 0;
        this.size = 28;
        this.color = 0xf1c40f; // Yellow
        break;
      case 'exploder':
        this.speed = 60;
        this.maxHp = 40;
        this.damage = 0;
        this.size = 40;
        this.color = 0x8e44ad; // Purple
        this.explodeRange = 70;
        this.explodeDamage = 25;
        break;
      case 'walker':
      default:
        this.speed = 100;
        this.maxHp = 30;
        this.damage = 10;
        this.size = 32;
        this.color = 0x550000;
        break;
    }
    this.hp = this.maxHp;
    this.speedMultiplier = 1;
  }

  drawZombie() {
    this.graphics.clear();
    switch (this.type) {
      case 'runner':    this._drawRunner();    break;
      case 'brute':     this._drawBrute();     break;
      case 'spitter':   this._drawSpitter();   break;
      case 'screamer':  this._drawScreamer();  break;
      case 'exploder':  this._drawExploder();  break;
      case 'hordeking': this._drawHordeking(); break;
      default:          this._drawWalker();    break;
    }
  }

  _drawWalker() {
    const g = this.graphics;
    const h = this.size / 2;
    g.fillStyle(0x550000, 1);
    g.fillRect(-h, -h, this.size, this.size);
    g.lineStyle(2, 0x2c0000, 1);
    g.strokeRect(-h, -h, this.size, this.size);
    // Eyes
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(-5, -4, 4);
    g.fillCircle(5, -4, 4);
    g.fillStyle(0x000000, 1);
    g.fillCircle(-5, -4, 2);
    g.fillCircle(5, -4, 2);
    // Jagged mouth
    g.lineStyle(1.5, 0x8b0000, 1);
    g.lineBetween(-6, 4, -3, 6);
    g.lineBetween(-3, 6, 0, 3);
    g.lineBetween(0, 3, 3, 6);
    g.lineBetween(3, 6, 6, 4);
  }

  _drawRunner() {
    const g = this.graphics;
    const h = this.size / 2;
    g.fillStyle(0x8b0000, 1);
    g.fillRect(-h, -h, this.size, this.size);
    g.lineStyle(1.5, 0x4a0000, 1);
    g.strokeRect(-h, -h, this.size, this.size);
    // Speed blur lines (behind = left)
    g.lineStyle(1, 0xff3333, 0.5);
    g.lineBetween(-h - 3, -4, -h - 8, -4);
    g.lineBetween(-h - 2, 0, -h - 7, 0);
    g.lineBetween(-h - 3, 4, -h - 8, 4);
    // Angular red eyes
    g.fillStyle(0xff4444, 0.95);
    g.fillRect(-4, -4, 3, 3);
    g.fillRect(2, -4, 3, 3);
  }

  _drawBrute() {
    const g = this.graphics;
    const h = this.size / 2;
    g.fillStyle(0x3e2723, 1);
    g.fillRect(-h, -h, this.size, this.size);
    // Muscle ridges
    g.lineStyle(2, 0x4e342e, 1);
    for (let x = -h + 8; x < h; x += 9) {
      g.lineBetween(x, -h, x, h);
    }
    // Thick border
    g.lineStyle(3, 0x1a0a08, 1);
    g.strokeRect(-h, -h, this.size, this.size);
    // Glowing red eyes
    g.fillStyle(0xff2200, 1);
    g.fillCircle(-8, -6, 5);
    g.fillCircle(8, -6, 5);
    g.fillStyle(0xff8800, 0.7);
    g.fillCircle(-8, -6, 2.5);
    g.fillCircle(8, -6, 2.5);
  }

  _drawSpitter() {
    const g = this.graphics;
    const h = this.size / 2;
    g.fillStyle(0x1b5e20, 1);
    g.fillRect(-h, -h, this.size, this.size);
    g.lineStyle(2, 0x33691e, 1);
    g.strokeRect(-h, -h, this.size, this.size);
    // Toxic glow drops around body
    g.fillStyle(0x76ff03, 0.7);
    g.fillCircle(-h - 3, 0, 3);
    g.fillCircle(0, -h - 3, 2.5);
    g.fillCircle(h + 3, 0, 3);
    // Eyes
    g.fillStyle(0x76ff03, 1);
    g.fillCircle(-4, -3, 3);
    g.fillCircle(4, -3, 3);
    // Open maw (goo)
    g.fillStyle(0x003300, 1);
    g.fillRect(-5, 2, 10, 6);
    g.fillStyle(0x76ff03, 0.5);
    g.fillCircle(0, 5, 4);
  }

  _drawScreamer() {
    const g = this.graphics;
    const h = this.size / 2;
    // Spiky star body
    const pts = [];
    const spikes = 8;
    for (let i = 0; i < spikes; i++) {
      const outerA = (i / spikes) * Math.PI * 2 - Math.PI / 2;
      const innerA = ((i + 0.5) / spikes) * Math.PI * 2 - Math.PI / 2;
      pts.push({ x: Math.cos(outerA) * h, y: Math.sin(outerA) * h });
      pts.push({ x: Math.cos(innerA) * (h * 0.48), y: Math.sin(innerA) * (h * 0.48) });
    }
    g.fillStyle(0xf1c40f, 1);
    g.fillPoints(pts, true);
    g.lineStyle(1.5, 0xf39c12, 1);
    g.strokePoints(pts, true);
    // Screaming mouth (O)
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(0, 3, 5);
    // Eyes (slanted)
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(-7, -6, 5, 3);
    g.fillRect(2, -6, 5, 3);
  }

  _drawExploder() {
    const g = this.graphics;
    const h = this.size / 2;
    // Round body
    g.fillStyle(0x8e44ad, 1);
    g.fillCircle(0, 0, h);
    g.lineStyle(2, 0xd2b4de, 0.6);
    g.strokeCircle(0, 0, h);
    // Radiating danger lines
    g.lineStyle(2, 0xff6b00, 0.85);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      g.lineBetween(
        Math.cos(angle) * (h * 0.6), Math.sin(angle) * (h * 0.6),
        Math.cos(angle) * (h + 5),   Math.sin(angle) * (h + 5)
      );
    }
    // Skull-ish eyes
    g.fillStyle(0x4a235a, 1);
    g.fillCircle(-6, -3, 4);
    g.fillCircle(6, -3, 4);
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(-6, -3, 2.5);
    g.fillCircle(6, -3, 2.5);
    // Grimace
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(-5, 4, 10, 3);
  }

  _drawHordeking() {
    const g = this.graphics;
    const h = this.size / 2;
    // Dark aura
    g.fillStyle(0x1a0000, 0.35);
    g.fillCircle(0, 0, h + 10);
    // Main body
    g.fillStyle(0x111111, 1);
    g.fillRect(-h, -h, this.size, this.size);
    // Crown spikes (gold)
    g.fillStyle(0xd4ac0d, 1);
    g.fillTriangle(-h, -h, -h + 10, -h - 14, -h + 20, -h);
    g.fillTriangle(h - 20, -h, h - 10, -h - 14, h, -h);
    g.fillTriangle(-h + 14, -h, -h + 24, -h - 18, -h + 34, -h);
    // Border
    g.lineStyle(3, 0x4a0000, 1);
    g.strokeRect(-h, -h, this.size, this.size);
    // Large glowing eyes
    g.fillStyle(0xff0000, 1);
    g.fillCircle(-10, -5, 8);
    g.fillCircle(10, -5, 8);
    g.fillStyle(0xff8800, 0.8);
    g.fillCircle(-10, -5, 4);
    g.fillCircle(10, -5, 4);
    // Menacing mouth
    g.lineStyle(2, 0xcc0000, 1);
    g.lineBetween(-14, 8, -8, 13);
    g.lineBetween(-8, 13, -2, 9);
    g.lineBetween(-2, 9, 2, 9);
    g.lineBetween(2, 9, 8, 13);
    g.lineBetween(8, 13, 14, 8);
  }

  setTarget(target) {
    this.target = target;
  }

  update(time, _delta) {
    if (!this.active) return;

    this.updateGraphicsPosition();

    // Determine move target (taunt overrides normal target)
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
      this.setRotation(angle);
      this.graphics.setRotation(angle);

      if (this.hasEffect('freeze')) {
        this.setVelocity(0, 0);
      } else {
        let currentSpeed = this.speed * (this.speedMultiplier || 1);
        if (this.hasEffect('slow')) currentSpeed *= 0.5;
        this.scene.physics.velocityFromRotation(angle, currentSpeed, this.body.velocity);
      }

      // Spitter: shoot projectile from range
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
    }
  }

  shootSpit(angle) {
    // Chỉ host fire để tránh mỗi client bắn 1 spit (4-player = 4× damage).
    // Damage chỉ áp lên host's player; hi sinh fairness multi-player để đổi
    // lấy đúng đắn — sau này có thể chuyển hẳn sang server-authoritative.
    if (!store.currentRoomDetails || !store.currentRoomDetails.isHost) return;

    const spit = this.scene.add.graphics({ x: this.x, y: this.y });
    spit.fillStyle(0x00cc00, 1);
    spit.fillCircle(0, 0, 5);
    this.scene.physics.add.existing(spit);
    this.scene.physics.velocityFromRotation(angle, 200, spit.body.velocity);
    spit.damage = 8;

    // Overlap with player
    this.scene.physics.add.overlap(spit, this.target, (proj, player) => {
      if (!spit.active) return;
      spit.destroy();
      player.takeDamage(proj.damage);
    });

    this.scene.time.delayedCall(1500, () => { if (spit.active) spit.destroy(); });
  }

  doScream() {
    // Visual effect
    const ring = this.scene.add.graphics();
    ring.lineStyle(3, 0xff0000, 1);
    ring.strokeCircle(this.x, this.y, 200);
    this.scene.time.delayedCall(400, () => ring.destroy());

    // Push nearby players back
    if (this.target && this.target.active) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
      if (dist < 200) {
        const pushAngle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
        this.scene.physics.velocityFromRotation(pushAngle, 400, this.target.body.velocity);
        this.hasScreamed = false; // Allow scream again after cooldown
      }
    }
  }

  updateGraphicsPosition() {
    this.graphics.setPosition(this.x, this.y);
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.die();
    } else {
      const g = this.graphics;
      g.clear();
      g.fillStyle(0xffffff, 1);
      const h = this.size / 2;
      if (this.type === 'exploder' || this.type === 'screamer') {
        g.fillCircle(0, 0, h);
      } else {
        g.fillRect(-h, -h, this.size, this.size);
      }
      this.scene.time.delayedCall(100, () => {
        if (this.active) this.drawZombie();
      });
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

  hasEffect(effectName) {
    return this.activeEffects.includes(effectName);
  }

  die() {
    this.graphics.destroy();
    this.destroy();
  }
}
