import Phaser from 'phaser';
import { Gunner, Tank, Medic, Trapper } from '../entities/PlayerClasses';
import Zombie from '../entities/Zombie';
import { store } from '../../store';
import { generateAllTextures, registerAnims } from '../PixelArtTextures';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {
    this.load.audio('shoot', '/audio/sfx/shoot.mp3');
    this.load.audio('zombie_die', '/audio/sfx/zombie.mp3');
    this.load.audio('zombie_hit', '/audio/sfx/zombie.wav');
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
      rotation: this.player.rotation,
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
            rotation: this.player.rotation, 
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
      'exploder_exploded', 'player_died'
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
        this.otherPlayers.add(other);
      }
      other.setPosition(data.x, data.y);

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
          if (this.cache.audio.exists('zombie_hit')) {
            this.sound.play('zombie_hit', { volume: 0.12, detune: Phaser.Math.Between(-300, 300) });
          }
          this._lastHitSfx = this.time.now;
        }

        if (!zombie.active) {
          if (this.cache.audio.exists('zombie_die')) this.sound.play('zombie_die', { volume: 0.4 });
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

    store.socket.on('intermission_start', (data) => {
      this.isWaveActive = false;
      this.zombies.clear(true, true);
      store.remainingZombies = 0;
      store.voteData.wave = this.currentWave;
      store.voteData.class = store.playerStats.class;
      store.voteData.winner = null;
      if (data?.options) store.voteData.options = data.options;
      store.setScreen('vote');
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
      if (other) other.setVisible(true);

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
      if (other) other.setVisible(false);
    });
  }

  addObstacles(wallData) {
    wallData.forEach(({ x, y, w, h }) => {
      const g = this.add.graphics();
      
      // Shadow
      g.fillStyle(0x111111, 0.5);
      g.fillRect(3, 3, w, h);
      
      // Main body — gradient look with lighter top
      g.fillStyle(0x555555, 1);
      g.fillRect(0, 0, w, h);
      
      // Top highlight edge
      g.fillStyle(0x777777, 1);
      g.fillRect(0, 0, w, 3);
      g.fillRect(0, 0, 3, h);
      
      // Bottom/right dark edge
      g.fillStyle(0x333333, 1);
      g.fillRect(0, h - 3, w, 3);
      g.fillRect(w - 3, 0, 3, h);
      
      // Inner detail lines (for larger walls)
      if (w > 60 || h > 60) {
        g.lineStyle(1, 0x4a4a4a, 0.6);
        if (w > h) {
          // Horizontal wall — vertical ribs
          for (let rx = 20; rx < w; rx += 20) {
            g.lineBetween(rx, 4, rx, h - 4);
          }
        } else {
          // Vertical wall — horizontal ribs
          for (let ry = 20; ry < h; ry += 20) {
            g.lineBetween(4, ry, w - 4, ry);
          }
        }
      }
      
      // Outer border
      g.lineStyle(1, 0x2a2a2a, 1);
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
    // Base layer — tileSprite phủ toàn bản đồ (GPU efficient)
    this.add.tileSprite(800, 800, 1600, 1600, 'grass', 0).setDepth(-3);

    // 250 patch biến thể phủ lên để phá vỡ monotone
    let seed = 42;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0x100000000;
    };
    for (let i = 0; i < 250; i++) {
      const x = rng() * 1600;
      const y = rng() * 1600;
      const frame = 1 + Math.floor(rng() * 3); // frames 1-3 là biến thể
      this.add.image(x, y, 'grass', frame).setDepth(-2).setAlpha(0.55);
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

    const isSafe = (x, y, r) => {
      // Không đặt trong vùng spawn trung tâm
      const dx = x - CENTER, dy = y - CENTER;
      if (Math.sqrt(dx * dx + dy * dy) < SAFE_R) return false;
      // Không đặt quá sát viền map
      if (x < 70 || x > WORLD - 70 || y < 70 || y > WORLD - 70) return false;
      // Không đặt chồng lên vật đã đặt trước
      return placed.every(p => {
        const ddx = p.x - x, ddy = p.y - y;
        return Math.sqrt(ddx * ddx + ddy * ddy) >= p.r + r + 10;
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

    // --- Cây (18 cây, collidable) ---
    tryPlace(18, 26, (x, y) => {
      this.add.image(x, y, 'tree').setDepth(1);

      const body = this.physics.add.staticImage(x, y, null);
      body.setVisible(false).setActive(true);
      body.body.setSize(28, 28);
      body.refreshBody();
      this.obstacles.add(body);
    });

    // --- Đá (10 tảng, collidable) ---
    tryPlace(10, 18, (x, y) => {
      this.add.image(x, y, 'rock').setDepth(1);

      const body = this.physics.add.staticImage(x, y, null);
      body.setVisible(false).setActive(true);
      body.body.setSize(22, 16);
      body.refreshBody();
      this.obstacles.add(body);
    });

    // --- Hồ nước (5 hồ, decorative only — không có physics) ---
    tryPlace(5, 30, (x, y) => {
      const water = this.add.image(x, y, 'water', 0).setDepth(-1).setAlpha(0.8);
      let frame = 0;
      this.time.addEvent({
        delay: 1400 + Math.floor(rng() * 800),
        loop: true,
        callback: () => {
          frame = 1 - frame;
          water.setFrame(frame);
        }
      });
    });
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

      // Play SFX
      if (this.cache.audio.exists('shoot')) {
        this.sound.play('shoot', { volume: 0.25, detune: Phaser.Math.Between(-100, 100) });
      }

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

      // Emit movement — throttle ~20Hz (50ms) thay vì mỗi frame (~60Hz)
      const isMoving = this.player.body.velocity.x !== 0 || this.player.body.velocity.y !== 0;
      if (isMoving) {
        if (time - (this._lastMoveEmit || 0) >= 50) {
          store.socket.emit('player_move', {
            roomCode: store.playerStats.roomCode,
            x: this.player.x,
            y: this.player.y,
            rotation: this.player.rotation,
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
          rotation: this.player.rotation, 
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
      
      // Chỉ gửi lên server — server sẽ broadcast zombie_took_damage về cho tất cả
      // KHÔNG gọi zombie.takeDamage() ở đây để tránh double damage
      store.socket.emit('zombie_damaged', {
        roomCode: store.playerStats.roomCode,
        zombieId: zombie.id,
        damage: bullet.damage || 15
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
