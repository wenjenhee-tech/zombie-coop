import Phaser from 'phaser';
import { Gunner, Tank, Medic, Trapper } from '../entities/PlayerClasses';
import Zombie from '../entities/Zombie';
import { store } from '../../store';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {
    this.load.audio('shoot', '/audio/sfx/shoot.mp3');
    this.load.audio('zombie_die', '/audio/sfx/zombie.mp3');
  }

  create() {
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

    // Draw grid background
    this.addGrid();

    // Static obstacle walls
    this.obstacles = this.physics.add.staticGroup();
    this.addObstacles(store.currentRoomDetails.wallData || []);
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

    // Death markers cho teammate đã chết (visual ô vuông xám tại deathX/Y)
    this.deathMarkers = {};
  }

  setupMultiplayerSync() {
    // XÓA tất cả listener cũ trước khi thêm mới — tránh tích lũy qua nhiều game session
    const events = [
      'player_moved', 'player_shot', 'zombie_spawned', 'zombie_updated',
      'zombie_took_damage', 'heal_aoe', 'shield_wall_active', 'taunt_active',
      'intermission_start', 'next_wave_started', 'difficulty_update',
      'you_are_host', 'player_revived', 'mine_placed', 'mine_exploded',
      'exploder_exploded'
    ];
    events.forEach(e => store.socket.off(e));

    const CLASS_COLORS = { Gunner: 0xe67e22, Tank: 0x2980b9, Medic: 0x27ae60, Trapper: 0xf1c40f };

    store.socket.on('player_moved', (data) => {
      let other = this.otherPlayers.getChildren().find(p => p.id === data.id);
      if (!other) {
        other = this.add.graphics();
        other.id = data.id;
        this.otherPlayers.add(other);
      }
      const playerInfo = store.currentRoomDetails.players.find(p => p.id === data.id);
      const color = CLASS_COLORS[playerInfo?.class] || 0x95a5a6;
      other.clear();
      other.fillStyle(color, 1);
      other.fillCircle(0, 0, 16);
      other.lineStyle(3, 0xffffff, 0.8);
      other.strokeCircle(0, 0, 16);
      other.setPosition(data.x, data.y);
      other.setRotation(data.rotation);
    });

    store.socket.on('player_shot', (data) => {
      // Visual feedback for other players shooting
      const bulletGraphics = this.add.graphics({ x: data.x, y: data.y });
      bulletGraphics.fillStyle(0xcccccc, 1);
      bulletGraphics.fillCircle(0, 0, 4);
      
      this.physics.add.existing(bulletGraphics);
      this.physics.velocityFromRotation(data.angle, 600, bulletGraphics.body.velocity);
      
      this.time.delayedCall(1000, () => bulletGraphics.destroy());
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

    store.socket.on('zombie_updated', (data) => {
      const zombie = this.zombies.getChildren().find(z => z.id === data.zombieId);
      if (zombie) {
        zombie.setPosition(data.x, data.y);
        zombie.setRotation(data.rotation);
      }
    });

    store.socket.on('zombie_took_damage', (data) => {
      const zombie = this.zombies.getChildren().find(z => z.id === data.zombieId);
      if (zombie) {
        zombie.takeDamage(data.damage);
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
            this.player.activeBuffs = this.player.activeBuffs.filter(b => b !== 'Iron Skin');
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
      // Apply voted powerup buff
      const winnerId = store.voteData.winner;
      if (winnerId) {
        const winnerOpt = store.voteData.options.find(o => o.id === winnerId);
        if (winnerOpt) this.player.addBuff(winnerOpt.name);
        store.voteData.winner = null;
      }
      store.setScreen('game');
      // KHÔNG emit host_ready_to_spawn ở đây vì start_next_wave đã init spawn params trên server
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

  addGrid() {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x333333, 0.5);
    for (let x = 0; x <= 1600; x += 64) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, 1600);
    }
    for (let y = 0; y <= 1600; y += 64) {
      graphics.moveTo(0, y);
      graphics.lineTo(1600, y);
    }
    graphics.strokePath();
    // Send grid to back
    graphics.setDepth(-1);
  }

  shoot(pointer) {
    if (this.time.now < this.lastFired) return;
    if (!this.player || !this.player.active) return;
    if (!this.isWaveActive) return; // Prevent shooting between waves

    const bulletSize = 4;
    const bulletGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    
    // Fire ammo check
    if (this.player.hasBuff('Fire Ammo')) {
      bulletGraphics.fillStyle(0xffaa00, 1);
    } else {
      bulletGraphics.fillStyle(0xffff00, 1);
    }
    bulletGraphics.fillCircle(bulletSize, bulletSize, bulletSize);
    bulletGraphics.generateTexture('bullet_tex', bulletSize * 2, bulletSize * 2);

    const bullet = this.bullets.get(this.player.x, this.player.y);
    
    if (bullet) {
      bullet.setTexture('bullet_tex');
      bullet.setActive(true);
      bullet.setVisible(true);
      bullet.body.setSize(bulletSize*2, bulletSize*2);
      
      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY);
      const bulletSpeed = 600 * (this.player.bulletSpeedMult || 1);
      this.physics.velocityFromRotation(angle, bulletSpeed, bullet.body.velocity);
      bullet.rotation = angle;
      bullet.damage = this.player.damage;

      // Play SFX
      if (this.cache.audio.exists('shoot')) this.sound.play('shoot', { volume: 0.3 });

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

      // Emit movement
      if (this.player.body.velocity.x !== 0 || this.player.body.velocity.y !== 0) {
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
        bullet.destroy(); 
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
