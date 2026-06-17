import Phaser from 'phaser';
import { Gunner, Tank, Medic, Trapper } from '../entities/PlayerClasses';
import Zombie from '../entities/Zombie';
import { store } from '../../store';
import { generateAllTextures, registerAnims } from '../PixelArtTextures';
import { drawWeapon } from '../weapons';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {
    this.load.audio('gunshot', '/audio/sfx/gunshot.wav');
    this.load.audio('zombie_growl', '/audio/sfx/zombie_growl.wav'); // ambient gầm
    this.load.audio('zombie_hit', '/audio/sfx/zombie_hit.wav');     // grunt ngắn (lát growl)
    this.load.audio('zombie_die', '/audio/sfx/zombie_die.wav');     // groan (lát growl)
  }

  create() {
    // Generate all pixel-art textures + register walk animations
    generateAllTextures(this);
    registerAnims(this);

    // Pre-generate bullet textures MỘT LẦN (tránh tạo lại mỗi phát bắn → rò rỉ Graphics)
    const bg = this.make.graphics({ x: 0, y: 0, add: false });
    bg.fillStyle(0xffff00, 1); bg.fillCircle(4, 4, 4);
    bg.generateTexture('bullet_normal', 8, 8);
    bg.clear();
    bg.fillStyle(0xffaa00, 1); bg.fillCircle(4, 4, 4);
    bg.generateTexture('bullet_fire', 8, 8);
    bg.destroy();

    // Set world bounds to 3200x3200
    this.physics.world.setBounds(0, 0, 1600, 1600);
    this.cameras.main.setBounds(0, 0, 1600, 1600);

    const classMap = { Gunner, Tank, Medic, Trapper };
    const PlayerClass = classMap[store.playerStats.class] || Gunner;
    this.player = new PlayerClass(this, this.cameras.main.width / 2, this.cameras.main.height / 2);
    // Unique ID for this client
    this.playerId = store.socket.id;

    // Group for other players
    this.otherPlayers = this.add.group();

    // Add crosshair
    this.input.setDefaultCursor('crosshair');
    
    // Camera follow player
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    // Groups
    this.bullets = this.physics.add.group({
      defaultKey: 'bullet',
      maxSize: 100
    });

    this.zombies = this.physics.add.group();
    
    // Collisions
    this.physics.add.collider(this.bullets, this.zombies, this.handleBulletHitZombie, null, this);
    this.physics.add.collider(this.player, this.zombies, this.handleZombieHitPlayer, null, this);
    this.physics.add.collider(this.zombies, this.zombies); // Zombies don't overlap

    // Draw grass background
    this.addGrassBackground();

    // Static obstacle walls
    this.obstacles = this.physics.add.staticGroup();
    this.addObstacles(store.currentRoomDetails.wallData || []);
    this.addDecorations();
    this.addNightMood();
    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.zombies, this.obstacles);
    this.physics.add.collider(this.bullets, this.obstacles, (bullet) => {
      if (!this.player.piercingShots) {
        bullet.setActive(false);
        bullet.setVisible(false);
      }
    });

    // Screamer split: server-authoritative (xem zombie_damaged trong server.js)

    // DL difficulty params (updated each wave)
    this.difficultyParams = { zombieSpeedMultiplier: 1, eliteSpawnChance: 0 };

    // Shooting mechanics
    this.input.on('pointerdown', this.shoot, this);
    this.lastFired = 0;

    // UI Text for Wave (fixed to camera)
    this.waveText = this.add.text(16, 16, 'Wave: 1', { fontSize: '32px', fill: '#fff' });
    this.waveText.setScrollFactor(0);

    // Wave Spawning
    this.currentWave = 1;
    this.isWaveActive = true;

    // Telemetry tracking
    this.waveStartTime = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.hpLostThisWave = 0;
    this.actionsThisWave = 0;
    
    this.setupMultiplayerSync();

    this.waveText.setText('Wave: 1');
    if (store.currentRoomDetails.isHost) {
      store.socket.emit('host_ready_to_spawn', store.playerStats.roomCode);
    }

    // Initial emit so server knows player position immediately
    store.socket.emit('player_move', {
      roomCode: store.playerStats.roomCode,
      x: this.player.x,
      y: this.player.y,
      rotation: this.player.aimAngle,
      velocityX: 0,
      velocityY: 0
    });

    this._wasMoving = false;
    this.time.addEvent({
      delay: 2000, loop: true,
      callback: () => {
        if (this.player?.active) {
          store.socket.emit('player_move', { 
            roomCode: store.playerStats.roomCode, 
            x: this.player.x, 
            y: this.player.y, 
            rotation: this.player.aimAngle, 
            velocityX: this.player.body.velocity.x, 
            velocityY: this.player.body.velocity.y 
          });
        }
      }
    });

    // Death markers cho teammate đã chết (visual ô vuông xám tại deathX/Y)
    this.deathMarkers = {};

    if (store.isMuted) this.sound.setVolume(0);
  }

  setupMultiplayerSync() {
    // XÓA tất cả listener cũ trước khi thêm mới — tránh tích lũy qua nhiều game session
    const events = [
      'player_moved', 'player_shot', 'zombie_spawned', 'zombies_updated',
      'zombie_took_damage', 'heal_aoe', 'shield_wall_active', 'taunt_active',
      'intermission_start', 'next_wave_started', 'difficulty_update',
      'you_are_host', 'player_revived', 'mine_placed', 'mine_exploded',
      'exploder_exploded', 'player_died', 'skill_burst_fx', 'team_stim',
      'powerup_progress', 'wave_countdown_start'
    ];
    events.forEach(e => store.socket.off(e));

    const CLASS_COLORS = { Gunner: 0xe67e22, Tank: 0x2980b9, Medic: 0x27ae60, Trapper: 0xf1c40f };

    store.socket.on('player_moved', (data) => {
      let other = this.otherPlayers.getChildren().find(p => p.id === data.id);
      if (!other) {
        const playerInfo = store.currentRoomDetails.players.find(p => p.id === data.id);
        const cls = (playerInfo?.class || 'Gunner').toLowerCase();
        other = this.add.sprite(data.x, data.y, `player_${cls}`);
        other.id = data.id;
        other.weapon = this.add.graphics(); // layer vũ khí riêng, xoay theo aim của họ
        this.otherPlayers.add(other);
      }
      other.setPosition(data.x, data.y);
      // Tự chữa lành desync: chỉ player CÒN SỐNG mới gửi player_move (player chết
      // ngừng emit do this.player.active=false). Nên nếu nhận được move mà sprite
      // đang bị ẩn (vì player_died trước đó thiếu player_revived khớp — reconnect
      // đổi socket.id, mất gói...), hiện lại để khỏi "vô hình nhưng vẫn bắn".
      if (!other.visible) other.setVisible(true);
      this._updateOtherWeapon(other, data.x, data.y, data.rotation);

      // Play walk animation based on velocity
      const { velocityX: vx, velocityY: vy } = data;
      const moving = Math.abs(vx) > 10 || Math.abs(vy) > 10;
      if (moving) {
        const cls = other.texture.key.replace('player_', '');
        const dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up');
        const animKey = `player_${cls}_walk_${dir}`;
        if (other.anims.currentAnim?.key !== animKey) other.play(animKey);
      } else {
        other.anims.stop();
      }
    });

    store.socket.on('player_shot', (data) => {
      const b = this.add.graphics({ x: data.x, y: data.y });
      b.fillStyle(0xcccccc, 1);
      b.fillCircle(0, 0, 4);
      // No physics body — purely visual tracer
      const vx = Math.cos(data.angle) * 600;
      const vy = Math.sin(data.angle) * 600;
      this.tweens.add({ targets: b, x: data.x + vx, y: data.y + vy, duration: 1000, onComplete: () => b.destroy() });
      // Tiếng súng đồng đội — nhỏ dần theo khoảng cách
      this.playSpatial('gunshot', data.x, data.y, 0.26, 120);
      // Xoay vũ khí người bắn theo hướng + chớp lửa (cover cả khi họ đứng yên bắn)
      const shooter = this.otherPlayers.getChildren().find(p => p.id === data.id);
      if (shooter) this._updateOtherWeapon(shooter, data.x, data.y, data.angle, true);
    });

    store.socket.on('zombie_spawned', (data) => {
      const zombie = new Zombie(this, data.x, data.y, data.type);
      zombie.id = data.zombieId;
      // Dùng HP từ server để đảm bảo đồng bộ với HP_TABLE server-side
      if (data.hp !== undefined) {
        zombie.hp = data.hp;
        zombie.maxHp = data.hp;
      }
      zombie.setTarget(this.player);
      this.zombies.add(zombie);
    });

    store.socket.on('zombies_updated', (list) => {
      // 1 message chứa nhiều zombie — index theo id để cập nhật nhanh
      const byId = {};
      for (const z of this.zombies.getChildren()) byId[z.id] = z;
      for (const data of list) {
        const zombie = byId[data.zombieId];
        // Không setRotation — hướng sprite điều khiển bằng velocity-based anim
        if (zombie) zombie.setPosition(data.x, data.y);
      }
    });

    store.socket.on('zombie_took_damage', (data) => {
      const zombie = this.zombies.getChildren().find(z => z.id === data.zombieId);
      if (zombie) {
        zombie.takeDamage(data.damage);
        
        // Rate-limit để tránh spam âm thanh khi nhiều người bắn cùng lúc
        if (this.time.now > (this._lastHitSfx || 0) + 80) {
          this.playSpatial('zombie_hit', zombie.x, zombie.y, 0.35, 250, 300); // grunt cao
          this._lastHitSfx = this.time.now;
        }

        if (!zombie.active) {
          this.playSpatial('zombie_die', zombie.x, zombie.y, 0.6, 120, -250); // groan trầm
          store.playerStats.kills++;
          store.playerStats.score += zombie.maxHp * 2;
          store.remainingZombies = this.zombies.getChildren().filter(z => z.active).length;
        }
      }
    });

    store.socket.on('heal_aoe', (data) => {
      if (data.sourceId === store.socket.id) return;
      if (this.player && this.player.active) {
        this.player.heal(data.healAmount);
        store.playerStats.hp = this.player.hp;
      }
    });

    store.socket.on('shield_wall_active', (data) => {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, data.x, data.y);
      if (dist <= data.radius) {
        this.player.addBuff('Iron Skin');
        this.scene?.time?.delayedCall(data.duration, () => {
          if (this.player?.activeBuffs) {
            this.player.removeBuff('Iron Skin');
          }
        });
      }
    });

    store.socket.on('taunt_active', (data) => {
      if (!store.currentRoomDetails.isHost) return;
      this.zombies.getChildren().forEach(zombie => {
        if (!zombie.active) return;
        const dist = Phaser.Math.Distance.Between(zombie.x, zombie.y, data.x, data.y);
        if (dist < 160) {
          zombie.tauntTargetX = data.x;
          zombie.tauntTargetY = data.y;
          zombie.tauntUntil = this.time.now + data.duration;
        }
      });
    });

    // Skill chủ động (R) gây sát thương/hiệu ứng vùng — server xử lý damage+effect,
    // client chỉ vẽ hiệu ứng nổ/sóng/lưới.
    store.socket.on('skill_burst_fx', ({ x, y, radius, fx }) => {
      const color = fx === 'slam' ? 0xe74c3c : fx === 'net' ? 0x00ffff : 0xf1c40f;
      const ring = this.add.graphics();
      ring.fillStyle(color, 0.4);
      ring.fillCircle(x, y, radius);
      ring.lineStyle(3, color, 0.9);
      ring.strokeCircle(x, y, radius);
      this.time.delayedCall(280, () => ring.destroy());
    });

    // Medic "Liều Kích Thích" — đồng đội nhận buff lên player local của mình.
    store.socket.on('team_stim', (data) => {
      if (data.sourceId === store.socket.id) return;
      if (this.player && this.player.active) this.player.applyStim(data.duration);
    });

    store.socket.on('intermission_start', (data) => {
      this.isWaveActive = false;
      this.zombies.clear(true, true);
      store.remainingZombies = 0;
      store.voteData.wave = this.currentWave;
      store.voteData.class = store.playerStats.class;
      store.voteData.winner = null;
      if (data?.options) store.voteData.options = data.options;
      store.pendingBuffId = null;
      // Reset trạng thái intermission cho banner "chờ đồng đội"
      store.intermission.active = true;
      store.intermission.chosenCount = 0;
      store.intermission.total = store.teammates.filter(t => t?.isAlive).length + (store.playerStats.isAlive ? 1 : 0);
      store.intermission.countdownSeconds = null;
      this._clearWaveCountdown();
      store.setScreen('vote');
    });

    // Cập nhật bảng "x/y đã chọn" trên banner
    store.socket.on('powerup_progress', (data) => {
      store.intermission.chosenCount = data.chosenCount;
      store.intermission.total = data.total;
    });

    // Đủ người chọn → server báo đếm ngược 5s tới wave kế
    store.socket.on('wave_countdown_start', (data) => {
      this._startWaveCountdown(data?.seconds ?? 5);
    });

    store.socket.on('next_wave_started', (wave) => {
      this.currentWave = wave;
      this.isWaveActive = true;
      this.waveText.setText(`Wave: ${wave}`);

      const picked = store.pendingBuffId;
      if (picked) {
        const opt = store.voteData.options.find(o => o.id === picked);
        if (opt) this.player.addBuff(opt.name);
        store.pendingBuffId = null;
      }
      store.intermission.active = false;
      store.intermission.countdownSeconds = null;
      this._clearWaveCountdown();
      store.setScreen('game');
    });

    store.socket.on('difficulty_update', (params) => {
      this.difficultyParams = params;
    });

    store.socket.on('you_are_host', () => {
      store.currentRoomDetails.isHost = true;
      if (this.isWaveActive) {
        store.socket.emit('host_ready_to_spawn', store.playerStats.roomCode);
      }
    });

    store.socket.on('player_revived', (data) => {
      // Xoá death marker (nếu có) cho người được hồi sinh
      if (this.deathMarkers && this.deathMarkers[data.targetId]) {
        this.deathMarkers[data.targetId].destroy();
        delete this.deathMarkers[data.targetId];
      }
      
      const other = this.otherPlayers.getChildren().find(p => p.id === data.targetId);
      if (other) { other.setVisible(true); if (other.weapon) other.weapon.setVisible(true); }

      if (data.targetId === store.socket.id) {
        // Bản thân được hồi sinh
        if (this.player) {
          this.player.respawn(data.x, data.y, data.hp);
          this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        }
        store.setScreen('game');
      }
    });

    // Mine visuals (server-driven)
    this.mineSprites = this.mineSprites || {};
    store.socket.on('mine_placed', ({ mineId, x, y, isFreeze }) => {
      const g = this.add.graphics({ x, y });
      g.fillStyle(isFreeze ? 0x00ffff : 0xf39c12, 1);
      g.fillCircle(0, 0, 8);
      g.lineStyle(2, 0x000000, 1);
      g.strokeCircle(0, 0, 8);
      this.mineSprites[mineId] = g;
      // Auto-clean nếu mine hết hạn 15s mà chưa nổ
      this.time.delayedCall(15500, () => {
        if (this.mineSprites[mineId]) {
          this.mineSprites[mineId].destroy();
          delete this.mineSprites[mineId];
        }
      });
    });

    store.socket.on('mine_exploded', ({ mineId, x, y, radius, isFreeze }) => {
      if (this.mineSprites[mineId]) {
        this.mineSprites[mineId].destroy();
        delete this.mineSprites[mineId];
      }
      const ring = this.add.graphics();
      ring.fillStyle(isFreeze ? 0x00ffff : 0xe67e22, 0.5);
      ring.fillCircle(x, y, radius);
      this.time.delayedCall(250, () => ring.destroy());
    });

    // Exploder nổ server-side: render visual + áp damage nếu player trong vùng nổ
    store.socket.on('exploder_exploded', (data) => {
      const ring = this.add.graphics();
      ring.fillStyle(0x8e44ad, 0.6);
      ring.fillCircle(data.x, data.y, data.radius);
      this.time.delayedCall(300, () => ring.destroy());

      if (this.player && this.player.active) {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, data.x, data.y);
        if (dist < data.radius) {
          this.player.takeDamage(data.damage);
          store.playerStats.hp = this.player.hp;
          if (this.player.hp <= 0) this.handlePlayerDeath();
        }
      }

      const zombie = this.zombies.getChildren().find(z => z.id === data.zombieId);
      if (zombie) zombie.die();
    });

    store.socket.on('player_died', (data) => {
      const other = this.otherPlayers.getChildren().find(p => p.id === data.id);
      if (other) { other.setVisible(false); if (other.weapon) other.weapon.setVisible(false); }

      // Server cho CHÍNH MÌNH chết (vd AFK quá 60s không chọn powerup) → vào spectator.
      // Không emit lại player_died (server đã khởi xướng).
      if (data.id === store.socket.id && store.playerStats.isAlive) {
        store.playerStats.isAlive = false;
        store.intermission.active = false;
        store.intermission.countdownSeconds = null;
        this._clearWaveCountdown();
        this.cameras.main.stopFollow();
        store.setScreen('spectator');
      }
    });
  }

  // ── Phát âm thanh theo vị trí: nhỏ dần theo khoảng cách tới player, quá xa thì bỏ.
  // detuneBase dịch cao độ cố định (hit cao / die thấp), detuneRange thêm ngẫu nhiên.
  playSpatial(key, x, y, baseVol, detuneRange = 0, detuneBase = 0) {
    if (store.isMuted || !this.player || !this.cache.audio.exists(key)) return;
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
    const vol = baseVol * Math.max(0, 1 - dist / 850);
    if (vol < 0.02) return; // quá xa, không nghe được → bỏ (đỡ tốn voice)
    const detune = detuneBase + (detuneRange ? Phaser.Math.Between(-detuneRange, detuneRange) : 0);
    this.sound.play(key, { volume: vol, detune });
  }

  // ── Vũ khí của người chơi khác: đặt vị trí + xoay theo aim của họ + vẽ lại ──
  _updateOtherWeapon(other, x, y, rotation, muzzle = false) {
    if (!other.weapon) return;
    other.weapon.setPosition(x, y);
    if (rotation != null) {
      other.weapon.setRotation(rotation);
      other.weapon.scaleY = Math.abs(rotation) > Math.PI / 2 ? -1 : 1; // lật trái
    }
    other.weapon.setVisible(other.visible);
    drawWeapon(other.weapon, other.texture.key.replace('player_', ''), { muzzle });
  }

  // ── Tiếng gầm ambient: định kỳ ~3s, chọn zombie sống GẦN NHẤT trong tầm nghe ──
  _ambientGrowl(time) {
    if (time < (this._lastGrowl || 0)) return;
    const zs = this.zombies.getChildren().filter(z => z.active);
    if (zs.length) {
      let nearest = null, nd = Infinity;
      for (const z of zs) {
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, z.x, z.y);
        if (d < nd) { nd = d; nearest = z; }
      }
      if (nearest && nd < 850) this.playSpatial('zombie_growl', nearest.x, nearest.y, 0.3, 200);
    }
    this._lastGrowl = time + Phaser.Math.Between(2800, 4200);
  }

  // ── Đếm ngược 5s (cục bộ, hiển thị banner) ──
  _startWaveCountdown(seconds) {
    this._clearWaveCountdown();
    store.intermission.countdownSeconds = seconds;
    this._cdTimer = setInterval(() => {
      if (store.intermission.countdownSeconds > 0) {
        store.intermission.countdownSeconds -= 1;
      } else {
        this._clearWaveCountdown();
      }
    }, 1000);
  }

  _clearWaveCountdown() {
    if (this._cdTimer) { clearInterval(this._cdTimer); this._cdTimer = null; }
  }

  addObstacles(wallData) {
    wallData.forEach(({ x, y, w, h }) => {
      const g = this.add.graphics();

      // Bóng đổ
      g.fillStyle(0x000000, 0.45);
      g.fillRect(3, 4, w, h);

      // Thân bê-tông — gradient sáng trên → tối dưới
      g.fillGradientStyle(0x4a4f57, 0x4a4f57, 0x2b2f35, 0x2b2f35, 1);
      g.fillRect(0, 0, w, h);

      // Cạnh sáng trên / tối dưới
      g.fillStyle(0x5c626b, 1); g.fillRect(0, 0, w, 2);
      g.fillStyle(0x1c1f23, 1); g.fillRect(0, h - 3, w, 3);

      // Vết gỉ sét loang
      g.fillStyle(0x6b4326, 0.45); g.fillCircle(w * 0.28, h * 0.32, Math.min(w, h) * 0.16);
      g.fillStyle(0x4d3019, 0.40); g.fillCircle(w * 0.72, h * 0.66, Math.min(w, h) * 0.12);

      // Vết nứt
      g.lineStyle(1, 0x17181b, 0.75);
      g.beginPath();
      g.moveTo(w * 0.35, 2); g.lineTo(w * 0.45, h * 0.5); g.lineTo(w * 0.38, h - 2);
      g.strokePath();

      // Vạch cảnh báo hazard (vàng/đen) cho tường lớn
      if (w > 60 || h > 60) {
        const horiz = w > h;
        const len = horiz ? w : h;
        for (let s = 0; s < len; s += 7) {
          g.fillStyle(((s / 7) | 0) % 2 ? 0x141414 : 0xc9a01f, 0.9);
          if (horiz) g.fillRect(s, 3, 7, 5);
          else       g.fillRect(3, s, 5, 7);
        }
      }

      // Viền ngoài
      g.lineStyle(1, 0x0f1012, 1);
      g.strokeRect(0, 0, w, h);

      g.setPosition(x, y);
      g.setDepth(1);

      // Static physics body for the obstacle
      const body = this.physics.add.staticImage(x + w / 2, y + h / 2, null);
      body.setVisible(false);
      body.body.setSize(w, h);
      body.refreshBody();
      this.obstacles.add(body);
    });
  }

  addGrassBackground() {
    // Nền nhựa đường phủ toàn map (tileSprite — 1 draw-call)
    this.add.tileSprite(800, 800, 1600, 1600, 'asphalt', 0).setDepth(-3);

    // ~200 mảng biến thể (nứt / vết dầu / vạch kẻ) rải bằng RNG-có-seed
    let seed = 42;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0x100000000;
    };
    for (let i = 0; i < 200; i++) {
      const x = rng() * 1600;
      const y = rng() * 1600;
      const frame = 1 + Math.floor(rng() * 3); // frames 1-3 là biến thể
      this.add.image(x, y, 'asphalt', frame).setDepth(-2).setAlpha(0.7);
    }
  }

  addDecorations() {
    const WORLD = 1600;
    const CENTER = 800;
    const SAFE_R = 230; // bán kính vùng spawn trung tâm — không đặt vật gì ở đây

    let seed = 1337;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0x100000000;
    };

    const placed = [];
    const walls = store.currentRoomDetails.wallData || [];

    const isSafe = (x, y, r) => {
      // Không đặt trong vùng spawn trung tâm
      const dx = x - CENTER, dy = y - CENTER;
      if (Math.sqrt(dx * dx + dy * dy) < SAFE_R) return false;
      // Không đặt quá sát viền map
      if (x < 70 || x > WORLD - 70 || y < 70 || y > WORLD - 70) return false;
      // Không đè lên TƯỜNG (server wallData) — tránh 2 body vật lý chồng nhau
      for (const wl of walls) {
        const nx = Math.max(wl.x, Math.min(x, wl.x + wl.w));
        const ny = Math.max(wl.y, Math.min(y, wl.y + wl.h));
        if (Math.hypot(x - nx, y - ny) < r + 14) return false;
      }
      // Không đè lên vật đã đặt trước (margin rộng hơn cho gọn vật lý)
      return placed.every(p => {
        const ddx = p.x - x, ddy = p.y - y;
        return Math.sqrt(ddx * ddx + ddy * ddy) >= p.r + r + 16;
      });
    };

    const tryPlace = (count, r, fn) => {
      let placed_count = 0, attempts = 0;
      while (placed_count < count && attempts++ < count * 40) {
        const x = 70 + rng() * (WORLD - 140);
        const y = 70 + rng() * (WORLD - 140);
        if (isSafe(x, y, r)) {
          fn(x, y);
          placed.push({ x, y, r });
          placed_count++;
        }
      }
    };

    // --- Xác xe cháy (9 chiếc, collidable) ---
    tryPlace(9, 34, (x, y) => {
      this.add.image(x, y, 'wreck').setDepth(1).setAngle(Math.floor(rng() * 4) * 90);

      const body = this.physics.add.staticImage(x, y, null);
      body.setVisible(false).setActive(true);
      body.body.setSize(34, 34);
      body.refreshBody();
      this.obstacles.add(body);
    });

    // --- Đống gạch vụn (7 đống, collidable) ---
    tryPlace(7, 20, (x, y) => {
      this.add.image(x, y, 'rock').setDepth(1);

      const body = this.physics.add.staticImage(x, y, null);
      body.setVisible(false).setActive(true);
      body.body.setSize(22, 16);
      body.refreshBody();
      this.obstacles.add(body);
    });

    // --- Vũng độc (5 vũng, decorative only — tái dùng shimmer của nước, nhuộm xanh độc) ---
    tryPlace(5, 30, (x, y) => {
      const puddle = this.add.image(x, y, 'water', 0).setDepth(-1).setAlpha(0.85).setTint(0x6fae2e);
      let frame = 0;
      this.time.addEvent({
        delay: 1400 + Math.floor(rng() * 800),
        loop: true,
        callback: () => {
          frame = 1 - frame;
          puddle.setFrame(frame);
        }
      });
    });

    // --- Đèn đường (6 cây, collidable ở chân cột, có quầng sáng ấm rọi xuống đường) ---
    tryPlace(6, 26, (x, y) => {
      // Quầng sáng trên mặt đất — blend ADD để "rọi" xuyên qua lớp bóng đêm
      this.add.image(x, y - 6, 'lightpool')
        .setDepth(-0.45)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.9);
      this.add.image(x, y, 'streetlight').setDepth(1);

      const body = this.physics.add.staticImage(x, y + 8, null);
      body.setVisible(false).setActive(true);
      body.body.setSize(12, 12);
      body.refreshBody();
      this.obstacles.add(body);
    });

    // --- Thùng phuy (6 cái, collidable, ~35% là thùng độc phát sáng) ---
    tryPlace(6, 18, (x, y) => {
      const toxic = rng() < 0.35 ? 1 : 0;
      this.add.image(x, y, 'barrel', toxic).setDepth(1);

      const body = this.physics.add.staticImage(x, y + 4, null);
      body.setVisible(false).setActive(true);
      body.body.setSize(14, 18);
      body.refreshBody();
      this.obstacles.add(body);
    });

    // --- Decal máu/cháy (14 vệt, phẳng, KHÔNG physics, được phép đè lên nhau) ---
    for (let i = 0; i < 14; i++) {
      const dx = 80 + rng() * (WORLD - 160);
      const dy = 80 + rng() * (WORLD - 160);
      const f  = rng() < 0.6 ? 0 : 1; // 60% máu, 40% cháy
      this.add.image(dx, dy, 'decal', f)
        .setDepth(-0.48)
        .setAlpha(0.9)
        .setAngle(Math.floor(rng() * 4) * 90);
    }
  }

  // Lớp không khí "đêm tận thế": tối nền + vignette theo camera.
  addNightMood() {
    // Phủ tối lên các lớp NỀN (depth < 0) — đặt trên đất, dưới nhân vật/props (depth ≥ 0)
    // → giữ nhân vật & xe đọc rõ, chỉ mặt đất chìm trong bóng đêm.
    this.add.rectangle(800, 800, 1600, 1600, 0x0a0e1a, 0.5).setDepth(-0.5);

    // Vignette tối 4 góc, bám theo camera (screen-space)
    const camW = this.cameras.main.width;
    const camH = this.cameras.main.height;
    if (!this.textures.exists('vignette')) {
      const vt = this.textures.createCanvas('vignette', camW, camH);
      const vctx = vt.getContext('2d');
      const grd = vctx.createRadialGradient(camW / 2, camH / 2, camH * 0.32, camW / 2, camH / 2, camH * 0.78);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(0,0,0,0.7)');
      vctx.fillStyle = grd;
      vctx.fillRect(0, 0, camW, camH);
      vt.refresh();
    }
    this.add.image(0, 0, 'vignette').setOrigin(0).setScrollFactor(0).setDepth(60);
  }

  shoot(pointer) {
    if (this.time.now < this.lastFired) return;
    if (!this.player || !this.player.active) return;
    if (!this.isWaveActive) return; // Prevent shooting between waves

    const bulletSize = 4;
    const bullet = this.bullets.get(this.player.x, this.player.y);

    if (bullet) {
      // Dùng texture đã tạo sẵn trong create() — chỉ đổi theo buff Fire Ammo
      bullet.setTexture(this.player.hasBuff('Fire Ammo') ? 'bullet_fire' : 'bullet_normal');
      bullet.setActive(true);
      bullet.setVisible(true);
      bullet.body.setSize(bulletSize*2, bulletSize*2);
      
      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY);
      const bulletSpeed = 600 * (this.player.bulletSpeedMult || 1);
      this.physics.velocityFromRotation(angle, bulletSpeed, bullet.body.velocity);
      bullet.rotation = angle;
      bullet.damage = this.player.damage;

      // Play SFX — súng của chính mình (luôn gần → full volume)
      if (!store.isMuted && this.cache.audio.exists('gunshot')) {
        this.sound.play('gunshot', { volume: 0.3, detune: Phaser.Math.Between(-120, 120) });
      }
      this.player.fireFx(); // recoil + chớp lửa đầu nòng

      // Auto destroy bullet after 2 seconds
      this.time.delayedCall(2000, () => {
        if (bullet.active) {
          bullet.setActive(false);
          bullet.setVisible(false);
        }
      });

      this.shotsFired++;
      this.actionsThisWave++;
      store.playerStats.shotsFired++;

      // Emit shoot event
      store.socket.emit('player_shoot', {
        roomCode: store.playerStats.roomCode,
        x: this.player.x,
        y: this.player.y,
        angle: angle,
        damage: bullet.damage,
        isPiercing: this.player.piercingShots,
        isFireAmmo: this.player.hasBuff('Fire Ammo')
      });

      this.lastFired = this.time.now + this.player.fireRate;
    }
  }

  update(time, delta) {
    this.sound.setVolume(store.isMuted ? 0 : 1);

    if (this.player && this.player.active) {
      this.player.update(time, delta);
      
      // Sync HP and Cooldowns to Vue Store
      store.playerStats.hp = this.player.hp;
      store.playerStats.maxHp = this.player.maxHp;
      
      const primaryDiff = time - this.player.lastPrimaryUsed;
      store.playerStats.primaryCDReadyRatio = Math.min(1, primaryDiff / this.player.primaryCooldown);
      store.playerStats.primaryCooldownMs = this.player.primaryCooldown;

      const secondaryDiff = time - this.player.lastSecondaryUsed;
      store.playerStats.secondaryCDReadyRatio = Math.min(1, secondaryDiff / this.player.secondaryCooldown);
      store.playerStats.secondaryCooldownMs = this.player.secondaryCooldown;

      const tertiaryDiff = time - this.player.lastTertiaryUsed;
      store.playerStats.tertiaryCDReadyRatio = Math.min(1, tertiaryDiff / this.player.tertiaryCooldown);
      store.playerStats.tertiaryCooldownMs = this.player.tertiaryCooldown;

      // Emit movement — throttle ~20Hz (50ms) thay vì mỗi frame (~60Hz)
      const isMoving = this.player.body.velocity.x !== 0 || this.player.body.velocity.y !== 0;
      if (isMoving) {
        if (time - (this._lastMoveEmit || 0) >= 50) {
          store.socket.emit('player_move', {
            roomCode: store.playerStats.roomCode,
            x: this.player.x,
            y: this.player.y,
            rotation: this.player.aimAngle,
            velocityX: this.player.body.velocity.x,
            velocityY: this.player.body.velocity.y
          });
          this._lastMoveEmit = time;
        }
        this._wasMoving = true;
      } else if (this._wasMoving) {
        store.socket.emit('player_move', { 
          roomCode: store.playerStats.roomCode, 
          x: this.player.x, 
          y: this.player.y, 
          rotation: this.player.aimAngle, 
          velocityX: 0, 
          velocityY: 0 
        });
        this._wasMoving = false;
      }

    }

    // Death markers cho mọi teammate đã chết (đặt tại deathX/deathY)
    this.refreshDeathMarkers();

    // Zombie update logic (hoạt ảnh)
    this.zombies.getChildren().forEach(zombie => {
      if (!zombie.active) return;
      zombie.update(time, delta);
    });

    // Tiếng gầm ambient khi đang trong wave (chỉ khi còn sống)
    if (this.player && this.player.active && this.isWaveActive) this._ambientGrowl(time);

    // Spectator camera: follow the selected teammate
    if (!store.playerStats.isAlive) {
      const watched = this.otherPlayers.getChildren()[store.spectatingIndex];
      if (watched) this.cameras.main.setScroll(watched.x - this.cameras.main.width / 2, watched.y - this.cameras.main.height / 2);
    }
  }

  // Removed getWaveConfig, startWave, spawnZombie

  handleBulletHitZombie(bullet, zombie) {
    if (bullet.active && zombie.active) {
      
      // Piercing shots logic
      if (!this.player.piercingShots) {
        bullet.setActive(false);
        bullet.setVisible(false);
      }
      
      // Nội tại "Sát Thủ" (Gunner): chí mạng ×2 dmg
      let dmg = bullet.damage || 15;
      if (Math.random() < (this.player.critChance || 0)) {
        dmg *= 2;
        const t = this.add.text(zombie.x, zombie.y - 24, 'CRIT!', { fontSize: '13px', fill: '#ffdd33', fontStyle: 'bold' });
        this.time.delayedCall(500, () => t.destroy());
      }

      // Chỉ gửi lên server — server sẽ broadcast zombie_took_damage về cho tất cả
      // KHÔNG gọi zombie.takeDamage() ở đây để tránh double damage
      store.socket.emit('zombie_damaged', {
        roomCode: store.playerStats.roomCode,
        zombieId: zombie.id,
        damage: dmg
      });

      this.shotsHit++;
      store.playerStats.shotsHit++;

      // Fire Ammo effect
      if (this.player.hasBuff('Fire Ammo')) {
        zombie.applyEffect('burn', 3000);
        this.time.addEvent({
          delay: 1000,
          repeat: 2,
          callback: () => {
            if (zombie.active) {
              store.socket.emit('zombie_damaged', {
                roomCode: store.playerStats.roomCode,
                zombieId: zombie.id,
                damage: 5
              });
            }
          }
        });
      }
    }
  }

  // Removed checkWaveCleared

  applyPowerup(powerup) {
    console.log(`Powerup selected: ${powerup.name}`);
    this.player.addBuff(powerup.name);
  }

  handleZombieHitPlayer(player, zombie) {
    if (!player.lastHit || this.time.now > player.lastHit + 1000) {
      player.takeDamage(zombie.damage);
      store.playerStats.hp = player.hp;
      this.hpLostThisWave += zombie.damage;
      player.lastHit = this.time.now;

      // Nội tại "Phản Đòn" (Tank): dội 1 phần dmg về zombie tấn công
      if (player.thornsRatio && zombie.active && zombie.damage > 0) {
        store.socket.emit('zombie_damaged', {
          roomCode: store.playerStats.roomCode,
          zombieId: zombie.id,
          damage: Math.round(zombie.damage * player.thornsRatio)
        });
      }

      if (player.hp <= 0) {
        this.handlePlayerDeath();
        return;
      }

      const angle = Phaser.Math.Angle.Between(zombie.x, zombie.y, player.x, player.y);
      this.physics.velocityFromRotation(angle, 300, player.body.velocity);
    }
  }

  handlePlayerDeath() {
    store.playerStats.isAlive = false;
    store.socket.emit('player_died', { roomCode: store.playerStats.roomCode });
    this.cameras.main.stopFollow();
    store.setScreen('spectator');
  }

  refreshDeathMarkers() {
    const now = Date.now();
    const seen = new Set();
    for (const mate of store.teammates) {
      if (!mate || mate.isAlive || mate.deathX == null) continue;
      if (!mate.deathTime || (now - mate.deathTime) > 30000) continue;
      seen.add(mate.id);
      let marker = this.deathMarkers[mate.id];
      if (!marker) {
        marker = this.add.graphics();
        marker.fillStyle(0x888888, 0.6);
        marker.fillCircle(0, 0, 18);
        marker.lineStyle(2, 0xff5555, 1);
        marker.strokeCircle(0, 0, 18);
        this.deathMarkers[mate.id] = marker;
      }
      marker.setPosition(mate.deathX, mate.deathY);
    }
    // Xoá marker cho các teammate đã hết hạn / hồi sinh
    for (const id in this.deathMarkers) {
      if (!seen.has(id)) {
        this.deathMarkers[id].destroy();
        delete this.deathMarkers[id];
      }
    }
  }
}
