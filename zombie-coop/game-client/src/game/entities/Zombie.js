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

    // Mọi zombie giờ vẽ ở texture 48px → scale theo size để hiện đúng kích thước logic
    // (display = 48×scale = size; hitbox = 48×scale = size).
    const TEX = 48;
    this.body.setSize(TEX, TEX);
    this._baseScale = this.size / TEX;
    this.setScale(this._baseScale);

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

  // Elite: phình to + quầng sáng màu theo affix. Stat (hp/speed) do server đã scale sẵn.
  markElite(affix) {
    this.isElite = true;
    this.affix = affix;
    this._baseScale *= 1.18;
    this.setScale(this._baseScale);
    const AURA = { swift: 0x00e5ff, armored: 0x90a4ae, volatile: 0xff6e40 };
    this._auraColor = AURA[affix] || 0xffffff;
    this._eliteAura = this.scene.add.graphics().setDepth(0);
  }

  _drawAura(time) {
    if (!this._eliteAura) return;
    const r = (this.size / 2) * 1.3;
    const pulse = 0.5 + 0.3 * Math.sin(time / 170);
    this._eliteAura.clear();
    this._eliteAura.fillStyle(this._auraColor, pulse * 0.18);
    this._eliteAura.fillCircle(this.x, this.y, r);
    this._eliteAura.lineStyle(2.5, this._auraColor, 0.55 + pulse * 0.35);
    this._eliteAura.strokeCircle(this.x, this.y, r);
  }

  // Thanh máu nổi trên đầu — chỉ vẽ khi đã mất máu (giữ màn hình gọn lúc full HP).
  // Quái to/elite/boss luôn hiện ngay cả khi chưa trúng đòn để dễ "đọc" mối đe doạ.
  _drawHpBar() {
    const heavy = this.isElite || this.maxHp >= 150 || this.type === 'spitter';
    const show = this.hp > 0 && (this.hp < this.maxHp || heavy);
    if (!show) {
      if (this._hpBar) { this._hpBar.clear(); }
      return;
    }
    if (!this._hpBar) this._hpBar = this.scene.add.graphics().setDepth(45);
    const w = Math.max(24, this.size * 0.9);
    const h = 4;
    const x = this.x - w / 2;
    const y = this.y - this.displayHeight / 2 - 8;
    const frac = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    // xanh → vàng → đỏ theo % máu
    const col = frac > 0.5 ? 0x4caf50 : frac > 0.25 ? 0xffb300 : 0xe53935;
    this._hpBar.clear();
    this._hpBar.fillStyle(0x000000, 0.55);
    this._hpBar.fillRect(x - 1, y - 1, w + 2, h + 2);
    this._hpBar.fillStyle(col, 1);
    this._hpBar.fillRect(x, y, w * frac, h);
  }

  update(time, _delta) {
    if (!this.active) return;
    if (this._eliteAura) this._drawAura(time);
    this._drawHpBar();

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

      // Exploder telegraph: server cho nổ khi <70px tới mục tiêu. Nhấp nháy đỏ + phình nhẹ
      // từ 130px để người chơi kịp né (biến cái chết "bực" thành "fair").
      if (this.type === 'exploder' && this.target && this.target.active) {
        const d = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
        if (d < 130) {
          // càng gần càng nhấp nháy nhanh (180ms ở xa → 70ms ở sát)
          const period = 70 + (d / 130) * 110;
          const on = Math.floor(time / period) % 2 === 0;
          this.setTint(on ? 0xff2020 : 0xffd0d0);
          this.setScale(this._baseScale * (on ? 1.12 : 1.0));
          this._arming = true;
        } else if (this._arming) {
          this._arming = false;
          this.clearTint();
          this.setScale(this._baseScale);
        }
      }

      // Spitter (host-only): nạp 0.45s + telegraph chấm độc phình to TRƯỚC khi nhổ → kịp né.
      if (this.type === 'spitter' && this.target && this.target.active && store.currentRoomDetails?.isHost) {
        const dist = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
        if (this._spitChargeUntil) {
          const prog = 1 - Math.max(0, this._spitChargeUntil - time) / 450;
          if (!this._spitCharge) this._spitCharge = this.scene.add.graphics().setDepth(40);
          this._spitCharge.clear();
          this._spitCharge.fillStyle(0x33ff55, 0.85);
          this._spitCharge.fillCircle(this.x, this.y - this.size * 0.3, 2 + prog * 7);
          this.setTint(0x88ff88);
          if (time >= this._spitChargeUntil) {
            this._spitChargeUntil = 0;
            this._spitCharge.destroy(); this._spitCharge = null;
            this.clearTint();
            this.shootSpit(Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y));
          }
        } else if (dist < this.spitRange && time > this.lastSpitTime + this.spitCooldown) {
          this.lastSpitTime = time;
          this._spitChargeUntil = time + 450;
        }
      }

      // Hordeking: cú hét đẩy lùi — telegraph vòng đỏ nở 0.55s TRƯỚC khi đẩy, lặp theo cooldown.
      if (this.type === 'hordeking' && this.hp < this.maxHp * 0.5
          && time > this.lastScreamTime + this.screamCooldown && !this._screaming) {
        this._screaming = true;
        this.lastScreamTime = time;
        this._telegraphScream();
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

  // Cảnh báo cú hét: vòng đỏ nở dần trong 0.55s; hết thì mới thực sự đẩy lùi (_applyScream).
  _telegraphScream() {
    const ring = this.scene.add.graphics().setDepth(40);
    this.scene.tweens.addCounter({
      from: 0, to: 1, duration: 550,
      onUpdate: (tw) => {
        if (!this.active) return;
        const t = tw.getValue();
        ring.clear();
        ring.lineStyle(4, 0xff3030, 0.85 * (1 - t) + 0.15);
        ring.strokeCircle(this.x, this.y, 60 + t * 150);
      },
      onComplete: () => {
        ring.destroy();
        this._screaming = false;
        if (this.active) this._applyScream();
      }
    });
  }

  _applyScream() {
    const flash = this.scene.add.graphics().setDepth(40);
    flash.lineStyle(3, 0xff0000, 1);
    flash.strokeCircle(this.x, this.y, 210);
    this.scene.time.delayedCall(300, () => flash.destroy());

    if (this.target && this.target.active) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
      if (dist < 210) {
        const pushAngle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
        this.scene.physics.velocityFromRotation(pushAngle, 400, this.target.body.velocity);
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
      this._hitPop();
    }
  }

  // Squash nhẹ khi trúng đạn — cảm giác "chắc đòn" mà không dịch chuyển thân
  // (vị trí do server đồng bộ, nên chỉ đụng scale, không đụng x/y).
  _hitPop() {
    if (this._popping) return;
    this._popping = true;
    this.scene.tweens.add({
      targets: this, scaleX: this._baseScale * 1.18, scaleY: this._baseScale * 0.86,
      duration: 60, yoyo: true, ease: 'Quad.easeOut',
      onComplete: () => { this._popping = false; if (this.active) this.setScale(this._baseScale); }
    });
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

  // Dọn graphics phụ ở MỌI đường huỷ (die tween, intermission clear(true,true)).
  destroy(fromScene) {
    if (this._eliteAura) { this._eliteAura.destroy(); this._eliteAura = null; }
    if (this._spitCharge) { this._spitCharge.destroy(); this._spitCharge = null; }
    if (this._hpBar) { this._hpBar.destroy(); this._hpBar = null; }
    super.destroy(fromScene);
  }

  die() {
    if (this._eliteAura) { this._eliteAura.destroy(); this._eliteAura = null; }
    if (this._hpBar) { this._hpBar.destroy(); this._hpBar = null; }
    if (!this.active) { this.destroy(); return; }
    // Tắt logic + va chạm ngay (handler check !active để đếm kill), rồi poof xác.
    this.setActive(false);
    if (this.body) this.body.enable = false;
    this.anims.stop();
    this.setVelocity?.(0, 0);
    this.setTint(0x991111);
    this.scene.tweens.add({
      targets: this, scaleX: 0, scaleY: 0, alpha: 0, angle: this.angle + 180,
      duration: 220, ease: 'Quad.easeIn',
      onComplete: () => this.destroy()
    });
  }
}
