const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/zombie_coop';
// URL service AI difficulty (Deep Learning). Không cấu hình → bỏ qua, dùng độ khó mặc định.
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || '';

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Quick User Model mapping to the schema in the DB
const userSchema = new mongoose.Schema({
  nickname: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  avatar: { type: String, enum: ['ranged', 'melee', 'scientist', 'engineer'], default: 'ranged' },
  stats: {
    bestWave: { type: Number, default: 0 },
    totalGames: { type: Number, default: 0 },
    totalKills: { type: Number, default: 0 },
    totalScore: { type: Number, default: 0 },
    revives: { type: Number, default: 0 },
    mvps: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema, 'users');

const roomSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  hostName: { type: String },
  isPrivate: { type: Boolean, default: false },
  status: { type: String, enum: ['waiting', 'playing', 'finished'], default: 'waiting' },
  difficulty: { type: String, enum: ['EASY', 'NORMAL', 'HARD'], default: 'NORMAL' },
  currentWave: { type: Number, default: 1 },
  players: [{
    userId: { type: mongoose.Schema.Types.ObjectId },
    nickname: String,
    class: { type: String, enum: ['ranged', 'melee', 'scientist', 'engineer'], default: 'ranged' },
    hp: { type: Number, default: 100 },
    isAlive: { type: Boolean, default: true }
  }],
  activeBuffs: { type: Array, default: [] },
  updatedAt: { type: Date, default: Date.now }
});
const Room = mongoose.model('Room', roomSchema, 'rooms');

const telemetrySchema = new mongoose.Schema({
  roomCode: String,
  wave: Number,
  apm: Number,
  avgAccuracy: Number,
  hpLossRate: Number,
  clearTime: Number,
  recordedAt: { type: Date, default: Date.now }
});
const Telemetry = mongoose.model('Telemetry', telemetrySchema, 'telemetry');

const aiDifficultySchema = new mongoose.Schema({
  roomCode: String,
  wave: Number,
  zombieSpeedMultiplier: Number,
  eliteSpawnChance: Number,
  resourceScarcity: Number,
  generatedAt: { type: Date, default: Date.now }
});
const AiDifficulty = mongoose.model('AiDifficulty', aiDifficultySchema, 'ai_difficulty');

const scoreSchema = new mongoose.Schema({
  nickname: { type: String, required: true },
  playerClass: { type: String, default: 'Ranged' },
  wave: { type: Number, default: 1 },
  kills: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  playerCount: { type: Number, default: 1 },
  playedAt: { type: Date, default: Date.now }
});
const Score = mongoose.model('Score', scoreSchema, 'scores');

// Active rooms in memory for fast socket broadcasting
const activeRooms = {};

// --- DIRECTOR & PACING CONFIG (chỉnh cảm giác độ khó tại đây) ---
// Độ gắt "Vừa": thưởng/phạt rõ nhưng không tàn nhẫn (~±28%).
const DIRECTOR = {
  SPEED_MIN: 0.85, SPEED_MAX: 1.28,  // biên zombieSpeedMultiplier
  ELITE_MAX: 0.28,                   // tỉ lệ elite tối đa khi người chơi mạnh
  SMOOTH: 0.6,                       // EMA: 0=giữ nguyên, 1=nhảy thẳng tới target
  ACC_BASELINE: 0.45,                // accuracy mốc "ổn"
  FAST_CLEAR: 25, SLOW_CLEAR: 60     // giây: dưới=mạnh (gắt thêm), trên=đuối (nới ra)
};
const SPAWN_LULL_MS = 3500;          // nghỉ ngắn giữa các đợt trong 1 wave

// Map Templates — bản đồ có cấu trúc chiến thuật
function generateMapLayout() {
  const MAP = 1600;
  const walls = [];

  // Viền map (tường biên): 4 thanh dọc/ngang ở rìa map
  // Top border
  walls.push({ x: 0, y: 0, w: MAP, h: 16 });
  // Bottom border  
  walls.push({ x: 0, y: MAP - 16, w: MAP, h: 16 });
  // Left border
  walls.push({ x: 0, y: 0, w: 16, h: MAP });
  // Right border
  walls.push({ x: MAP - 16, y: 0, w: 16, h: MAP });

  // Chọn ngẫu nhiên 1 trong 3 layout
  const layoutId = Math.floor(Math.random() * 3);

  if (layoutId === 0) {
    // Layout "Arena" — Khu trung tâm + 4 góc cover
    // Khối trung tâm hình chữ thập
    walls.push({ x: 740, y: 700, w: 120, h: 40 }); // ngang
    walls.push({ x: 770, y: 660, w: 40, h: 120 });  // dọc

    // 4 góc cover (L-shape)
    // Góc trên-trái
    walls.push({ x: 250, y: 250, w: 120, h: 32 });
    walls.push({ x: 250, y: 250, w: 32, h: 120 });
    // Góc trên-phải
    walls.push({ x: 1230, y: 250, w: 120, h: 32 });
    walls.push({ x: 1318, y: 250, w: 32, h: 120 });
    // Góc dưới-trái
    walls.push({ x: 250, y: 1230, w: 120, h: 32 });
    walls.push({ x: 250, y: 1130, w: 32, h: 120 });
    // Góc dưới-phải
    walls.push({ x: 1230, y: 1230, w: 120, h: 32 });
    walls.push({ x: 1318, y: 1130, w: 32, h: 120 });

    // 2 Barrier lanes ngang
    walls.push({ x: 500, y: 500, w: 200, h: 28 });
    walls.push({ x: 900, y: 1050, w: 200, h: 28 });

  } else if (layoutId === 1) {
    // Layout "Corridors" — Hành lang dọc + ngang tạo 4 khu vực
    // Tường dọc giữa (có 2 lỗ hở)
    walls.push({ x: 780, y: 100, w: 40, h: 500 });
    walls.push({ x: 780, y: 750, w: 40, h: 500 });
    // Tường ngang giữa (có 2 lỗ hở)
    walls.push({ x: 100, y: 780, w: 500, h: 40 });
    walls.push({ x: 750, y: 780, w: 500, h: 40 });

    // Cover nhỏ mỗi góc khu vực
    walls.push({ x: 300, y: 400, w: 100, h: 32 });
    walls.push({ x: 1100, y: 400, w: 100, h: 32 });
    walls.push({ x: 300, y: 1100, w: 100, h: 32 });
    walls.push({ x: 1100, y: 1100, w: 100, h: 32 });

  } else {
    // Layout "Bunker" — Vòng tròn bunker giữa + tường rải rác
    // Bunker trung tâm (4 mảnh tạo ô vuông có 4 lối vào)
    walls.push({ x: 650, y: 650, w: 120, h: 28 }); // top
    walls.push({ x: 650, y: 920, w: 120, h: 28 }); // bottom (lệch)
    walls.push({ x: 840, y: 650, w: 120, h: 28 }); // top right
    walls.push({ x: 840, y: 920, w: 120, h: 28 }); // bottom right
    walls.push({ x: 640, y: 670, w: 28, h: 120 }); // left top
    walls.push({ x: 640, y: 810, w: 28, h: 120 }); // left bottom
    walls.push({ x: 940, y: 670, w: 28, h: 120 }); // right top
    walls.push({ x: 940, y: 810, w: 28, h: 120 }); // right bottom

    // Tường rải rác xung quanh
    walls.push({ x: 200, y: 350, w: 160, h: 28 });
    walls.push({ x: 1240, y: 350, w: 160, h: 28 });
    walls.push({ x: 200, y: 1200, w: 160, h: 28 });
    walls.push({ x: 1240, y: 1200, w: 160, h: 28 });

    // Cover dọc 2 bên
    walls.push({ x: 400, y: 700, w: 28, h: 200 });
    walls.push({ x: 1180, y: 700, w: 28, h: 200 });
  }

  return walls;
}

// Heuristic Director: từ telemetry wave vừa xong → param độ khó wave kế.
// Thay cho ML service (vốn cần AI_SERVICE_URL). Mạnh → gắt hơn, đuối → dễ lại; EMA cho mượt.
function computeDirector(prev, tele) {
  const p = prev || { zombieSpeedMultiplier: 1, eliteSpawnChance: 0 };
  let perf = (tele.avgAccuracy - DIRECTOR.ACC_BASELINE) * 1.2;
  if (tele.clearTime < DIRECTOR.FAST_CLEAR) perf += 0.35;
  else if (tele.clearTime > DIRECTOR.SLOW_CLEAR) perf -= 0.35;
  perf = Math.max(-1, Math.min(1, perf)); // [-1,1]: >0 chơi tốt, <0 đang đuối

  const targetSpeed = 1 + perf * 0.28;
  const targetElite = perf > 0 ? perf * DIRECTOR.ELITE_MAX : 0;
  const s = DIRECTOR.SMOOTH;
  const lerp = (a, b) => a + (b - a) * s;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const r2 = v => Math.round(v * 100) / 100;
  return {
    zombieSpeedMultiplier: r2(clamp(lerp(p.zombieSpeedMultiplier, targetSpeed), DIRECTOR.SPEED_MIN, DIRECTOR.SPEED_MAX)),
    eliteSpawnChance: r2(clamp(lerp(p.eliteSpawnChance, targetElite), 0, DIRECTOR.ELITE_MAX))
  };
}

// Chia tổng zombie của wave thành các "đợt" tăng dần (đợt cuối dồn dập nhất = peak rush).
function buildBursts(total, wave) {
  if (total <= 3) return [total];
  const n = wave < 3 ? 2 : wave < 7 ? 3 : 4;
  const weights = [];
  for (let i = 0; i < n; i++) weights.push(1 + i * 0.45); // càng về cuối càng nặng
  const sum = weights.reduce((a, b) => a + b, 0);
  const counts = weights.map(w => Math.max(1, Math.round(total * w / sum)));
  const diff = total - counts.reduce((a, b) => a + b, 0);
  counts[counts.length - 1] = Math.max(1, counts[counts.length - 1] + diff); // dồn dư vào đợt peak
  return counts;
}

// Khởi tạo state spawn cho 1 wave (dùng chung bởi host_ready_to_spawn & start_next_wave)
function initWave(room) {
  const playerCount = room.players.filter(p => p.isAlive).length || 1;
  const baseCount = Math.floor(3 + room.currentWave * 1.5 + room.currentWave * room.currentWave * 0.15);
  const isBossWave = room.currentWave === 5 || room.currentWave === 10; // boss spawn đúng 1 con
  room.isWaveActive = true;
  room.zombiesToSpawn = isBossWave ? 1 : Math.floor(baseCount * (0.5 + playerCount * 0.5));
  room.zombiesSpawned = 0;
  // Pacing "làn sóng": chia thành đợt + lull ngắn giữa các đợt
  room.spawnBursts = buildBursts(room.zombiesToSpawn, room.currentWave);
  room.spawnBurstIdx = 0;
  room.spawnedInBurst = 0;
  room.lullUntil = 0;
  room.zombies = {};
  room.lastSpawnTime = Date.now();
  room.waveStartTime = Date.now();
  room.telemetry = { shotsFired: 0, shotsHit: 0, actionCount: 0 };
}

// Tăng sang wave kế: reset vote, kết thúc intermission, báo client, init spawn.
// Dùng chung bởi handler start_next_wave (legacy) và driver intermission tự động.
function advanceWave(room, code) {
  room.currentWave += 1;
  room.votes = {};
  room.voteResolved = false;
  room.intermission = null;
  io.to(code).emit('next_wave_started', room.currentWave);
  initWave(room);
}

// Cho 1 người chơi chết (server-initiated). opts.afk = true → đánh dấu không hồi sinh.
function killPlayer(room, code, player, opts = {}) {
  player.isAlive = false;
  player.deathTime = Date.now();
  player.deathX = player.x;
  player.deathY = player.y;
  if (opts.afk) player.afkOut = true;
  io.to(code).emit('player_died', { id: player.id, x: player.deathX, y: player.deathY });
}

// Nếu tất cả đã chết → lưu điểm + game_over + xoá room. Trả về true nếu đã kết thúc.
function checkGameOver(room, code) {
  const allDead = room.players.length > 0 && room.players.every(p => p.isAlive === false);
  if (!allDead) return false;

  room.status = 'finished';
  const elapsedMs = Date.now() - (room.gameStartTime || Date.now());
  const finishedWave = room.currentWave;
  const playerCount = room.players.length;

  Score.insertMany(room.players.map(p => ({
    nickname: p.nickname, playerClass: p.class || 'Ranged',
    wave: finishedWave, kills: p.kills || 0, score: p.score || 0, playerCount
  }))).catch(err => console.error('Score save error:', err));

  User.bulkWrite(room.players.map(p => ({
    updateOne: {
      filter: { nickname: p.nickname },
      update: {
        $inc: { 'stats.totalGames': 1, 'stats.totalKills': p.kills || 0, 'stats.totalScore': p.score || 0 },
        $max: { 'stats.bestWave': finishedWave }
      }
    }
  }))).catch(err => console.error('User stats update error:', err));

  io.to(code).emit('game_over', {
    wave: room.currentWave, result: 'Thua', elapsedMs,
    players: room.players.map(p => ({
      id: p.id, name: p.nickname, class: p.class || 'Ranged',
      kills: p.kills || 0, score: p.score || 0, isAlive: p.isAlive
    }))
  });
  delete activeRooms[code];
  return true;
}

// Driver intermission (chạy mỗi tick cho phòng có room.intermission.active).
// Tất cả đã chọn → đếm ngược 5s → advanceWave. Quá 60s → người chưa chọn chết (AFK).
function handleIntermission(room, code, now) {
  const im = room.intermission;
  // Chỉ người CÒN SỐNG mới phải chọn (người chết-AFK đang ở spectator, bỏ qua)
  const alive = room.players.filter(p => p.isAlive);
  const chosenCount = alive.filter(p => p.id in im.chosen).length;

  // Đủ người sống đã chọn → bắt đầu đếm ngược 5s (một lần)
  if (alive.length > 0 && chosenCount >= alive.length && !im.countdownStart) {
    im.countdownStart = now;
    io.to(code).emit('wave_countdown_start', { seconds: 5 });
  }

  // Hết 5s đếm ngược → vào wave kế
  if (im.countdownStart && now - im.countdownStart >= 5000) {
    advanceWave(room, code);
    return;
  }

  // Quá 60s kể từ lúc mở vote (và chưa vào đếm ngược) → người chưa chọn chết (AFK)
  if (!im.countdownStart && now - im.startedAt >= 60000) {
    room.players
      .filter(p => p.isAlive && !(p.id in im.chosen))
      .forEach(p => killPlayer(room, code, p, { afk: true }));
    if (checkGameOver(room, code)) return; // tất cả chết → game_over, room đã xoá
    advanceWave(room, code);
  }
}

// Áp sát thương lên 1 zombie theo cách server-authoritative: trừ máu, cộng điểm cho
// attacker, xử lý screamer-split khi chết, broadcast zombie_took_damage. Dùng chung bởi
// skill_burst (và có thể tái dùng cho zombie_damaged/mìn sau này).
// Hệ số "Suy Nhược" (Scientist): zombie dính vuln nhận thêm 40% sát thương.
function vulnMult(z, now) {
  return (z.effects && z.effects.vuln && now < z.effects.vuln) ? 1.4 : 1;
}

function applyZombieDamage(room, code, zId, damage, attackerId) {
  const z = room.zombies[zId];
  if (!z || z.isDead) return;
  const dmg = damage * vulnMult(z, Date.now());
  z.hp -= dmg;
  io.to(code).emit('zombie_took_damage', { roomCode: code, zombieId: zId, damage: dmg });
  if (z.hp > 0) return;

  z.isDead = true;
  const score = z.type === 'hordeking' ? 1000 : z.type === 'brute' ? 400 : z.type === 'runner' ? 40 : 100;
  const killer = room.players.find(p => p.id === attackerId);
  if (killer) { killer.kills++; killer.score += score; }

  const wasScreamer = z.type === 'screamer';
  const dx = z.x, dy = z.y;
  delete room.zombies[zId];

  if (wasScreamer) {
    for (let i = 0; i < 3; i++) {
      const ox = Math.floor(Math.random() * 80) - 40;
      const oy = Math.floor(Math.random() * 80) - 40;
      const newId = Math.random().toString(36).substring(2, 9);
      room.zombies[newId] = { id: newId, type: 'walker', x: dx + ox, y: dy + oy, hp: 30, speed: 50, rotation: 0 };
      io.to(code).emit('zombie_spawned', { roomCode: code, zombieId: newId, type: 'walker', x: dx + ox, y: dy + oy, hp: 30 });
    }
  }
}

io.on('connection', (socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);

  // Send all active waiting rooms to the client
  socket.emit('room_list', Object.values(activeRooms).filter(r => r.status === 'waiting'));

  socket.on('create_room', async (data) => {
    // data: { code, hostName, difficulty, class }
    const newRoom = {
      id: data.code,
      hostSocketId: socket.id,
      spawnCount: 0,
      name: data.hostName,
      difficulty: data.difficulty || 'NORMAL',
      status: 'waiting',
      players: [
        { id: socket.id, nickname: data.hostName, class: data.class, isAlive: true, kills: 0, score: 0 }
      ],
      maxPlayers: 4,
      wave: 1
    };
    
    activeRooms[data.code] = newRoom;
    socket.join(data.code);
    
    // Gửi room_update lại cho host để hiển thị đúng slot
    socket.emit('room_update', newRoom);
    // Broadcast updated room list to everyone in lobby
    io.emit('room_list', Object.values(activeRooms).filter(r => r.status === 'waiting'));
    
    // Attempt to save to MongoDB
    try {
      await Room.create({
        code: data.code,
        hostName: data.hostName,
        difficulty: (data.difficulty || 'NORMAL').toUpperCase(),
        status: 'waiting',
        currentWave: 1,
        players: [{ nickname: data.hostName, class: (data.class || 'Ranged').toLowerCase(), hp: 100, isAlive: true }]
      });
    } catch(e) { console.error("Failed to save room to DB", e); }
  });

  socket.on('join_room', (data) => {
    // data: { code, nickname, class }
    const room = activeRooms[data.code];
    if (!room || room.status !== 'waiting') {
      socket.emit('error', 'Phòng không tồn tại hoặc trò chơi đã bắt đầu');
      return;
    }
    // Chặn tự join lại phòng mình
    if (room.players.find(p => p.id === socket.id)) {
      socket.emit('error', 'Bạn đã ở trong phòng này rồi');
      return;
    }
    if (room.players.length >= 4) {
      socket.emit('error', 'Phòng đã đầy');
      return;
    }
    room.players.push({ id: socket.id, nickname: data.nickname, class: data.class, isAlive: true, kills: 0, score: 0 });
    socket.join(data.code);
    
    // Update everyone in the room
    io.to(data.code).emit('room_update', room);
    // Update lobby list
    io.emit('room_list', Object.values(activeRooms).filter(r => r.status === 'waiting'));
  });

  socket.on('leave_room', (roomCode) => {
    const room = activeRooms[roomCode];
    if (room) {
      room.players = room.players.filter(p => p.id !== socket.id);
      socket.leave(roomCode);
      if (room.players.length === 0) {
        delete activeRooms[roomCode];
      } else {
        room.name = room.players[0].nickname;
        room.hostSocketId = room.players[0].id;
        io.to(room.players[0].id).emit('you_are_host');
        io.to(roomCode).emit('room_update', room);
      }
      io.emit('room_list', Object.values(activeRooms).filter(r => r.status === 'waiting'));
    }
  });

  socket.on('start_game', async (roomCode) => {
    const room = activeRooms[roomCode];
    if (room && socket.id === room.hostSocketId) {
      room.status = 'playing';
      room.spawnCount = 0;
      room.zombies = {};
      room.zombiesToSpawn = 0;
      room.zombiesSpawned = 0;
      room.isWaveActive = false;
      room.currentWave = 1;
      room.gameStartTime = Date.now();
      room.waveStartTime = Date.now();
      room.difficultyParams = { zombieSpeedMultiplier: 1, eliteSpawnChance: 0 }; // Director sẽ điều chỉnh sau mỗi wave
      room.telemetry = { shotsFired: 0, shotsHit: 0, actionCount: 0 };
      room.players.forEach(p => { p.kills = 0; p.score = 0; });
      
      // Tạo bản đồ có cấu trúc (1600x1600)
      room.wallData = generateMapLayout();

      io.to(roomCode).emit('game_started', { wallData: room.wallData });
      io.emit('room_list', Object.values(activeRooms).filter(r => r.status === 'waiting'));

      try {
        await Room.updateOne({ code: roomCode }, { status: 'playing' });
      } catch(e) {}
    }
  });

  // MULTIPLAYER GAME SYNC EVENTS

  // Player Movement & Rotation
  socket.on('player_move', (data) => {
    // data: { roomCode, x, y, rotation, velocityX, velocityY }
    const room = activeRooms[data.roomCode];
    if (room) {
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.x = data.x;
        player.y = data.y;
      }
      if (room.telemetry) room.telemetry.actionCount++;
    }
    // Broadcast to everyone else in the room
    socket.to(data.roomCode).emit('player_moved', {
      id: socket.id,
      x: data.x,
      y: data.y,
      rotation: data.rotation,
      velocityX: data.velocityX,
      velocityY: data.velocityY
    });
  });

  // Player Shooting
  socket.on('player_shoot', (data) => {
    // data: { roomCode, x, y, angle, damage, isPiercing, isFireAmmo }
    const room = activeRooms[data.roomCode];
    if (room && room.telemetry) {
      room.telemetry.shotsFired++;
      room.telemetry.actionCount++;
    }
    socket.to(data.roomCode).emit('player_shot', {
      id: socket.id,
      x: data.x,
      y: data.y,
      angle: data.angle,
      damage: data.damage,
      isPiercing: data.isPiercing,
      isFireAmmo: data.isFireAmmo
    });
  });

  // Server nhận sát thương từ Client (Client nào bắn trúng cũng gửi)
  socket.on('zombie_damaged', (data) => {
    // data: { roomCode, zombieId, damage, effect }
    const room = activeRooms[data.roomCode];
    if (!room || !room.zombies[data.zombieId]) return;
    
    // Đã chết trước đó rồi nhưng chưa bị xóa thì return luôn
    if (room.zombies[data.zombieId].isDead) return;

    if (room.telemetry) room.telemetry.shotsHit++;

    // Suy Nhược: nếu zombie đang dính vuln thì sát thương ×1.4 (server-authoritative,
    // ghi đè data.damage để hp client/server + số nổ hiển thị đồng nhất).
    data.damage *= vulnMult(room.zombies[data.zombieId], Date.now());

    room.zombies[data.zombieId].hp -= data.damage;
    if (room.zombies[data.zombieId].hp <= 0) {
      const dyingZombie = room.zombies[data.zombieId];
      dyingZombie.isDead = true; // Cờ đánh dấu đã chết
      const zombieScore = dyingZombie.type === 'hordeking' ? 1000
          : dyingZombie.type === 'brute' ? 400
          : dyingZombie.type === 'runner' ? 40
          : 100;
      const killer = room.players.find(p => p.id === socket.id);
      if (killer) { killer.kills++; killer.score += zombieScore; }

      const wasScreamer = dyingZombie.type === 'screamer';
      const dx = dyingZombie.x;
      const dy = dyingZombie.y;

      // Xóa zombie khỏi bộ nhớ ngay lập tức
      delete room.zombies[data.zombieId];

      // Screamer chết → spawn 3 walker (server-authoritative để bullet sync đúng)
      if (wasScreamer) {
        for (let i = 0; i < 3; i++) {
          const ox = Math.floor(Math.random() * 80) - 40;
          const oy = Math.floor(Math.random() * 80) - 40;
          const newId = Math.random().toString(36).substring(2, 9);
          room.zombies[newId] = {
            id: newId,
            type: 'walker',
            x: dx + ox,
            y: dy + oy,
            hp: 30,
            speed: 50,
            rotation: 0
          };
          io.to(data.roomCode).emit('zombie_spawned', {
            roomCode: data.roomCode,
            zombieId: newId,
            type: 'walker',
            x: dx + ox,
            y: dy + oy,
            hp: 30
          });
        }
      }
    }
    // Phát lại cho mọi người để vẽ hiệu ứng
    io.to(data.roomCode).emit('zombie_took_damage', data);
  });

  // Host báo wave ended (hoặc Server tự báo, tạm thời giữ để không phá vỡ UI)
  socket.on('end_wave', (roomCode) => {
    const room = activeRooms[roomCode];
    if (room) room.isWaveActive = false;
    io.to(roomCode).emit('intermission_start', {});
  });

  // Host triggers next wave
  socket.on('start_next_wave', (roomCode) => {
    const room = activeRooms[roomCode];
    if (room && socket.id === room.hostSocketId) {
      if (room.isWaveActive) return; // chống click nhiều lần làm nhảy wave
      room.currentWave += 1;
      room.votes = {};
      room.voteResolved = false;
      io.to(roomCode).emit('next_wave_started', room.currentWave);
      initWave(room);
    }
  });

  // Client ready to start wave 1 (sau khi GameScene loaded lần đầu)
  socket.on('host_ready_to_spawn', (roomCode) => {
    const room = activeRooms[roomCode];
    if (room && socket.id === room.hostSocketId) {
      if (room.isWaveActive) return; // Đã active rồi thì bỏ qua (tránh double-init)
      initWave(room); // Scale zombie count theo số người chơi (solo = ít hơn)
    }
  });

  // POWERUP VOTING — server theo dõi ai đã chọn (intermission do server lái)
  socket.on('powerup_chosen', ({ roomCode, buffId }) => {
    const room = activeRooms[roomCode];
    if (!room || !room.intermission || !room.intermission.active) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    room.intermission.chosen[socket.id] = buffId;
    const alive = room.players.filter(p => p.isAlive);
    io.to(roomCode).emit('powerup_progress', {
      chosenCount: alive.filter(p => p.id in room.intermission.chosen).length,
      total: alive.length
    });
  });

  // CLASS SKILLS RELAY

  socket.on('heal_aoe', (data) => {
    // data: { roomCode, healAmount, sourceId }
    const room = activeRooms[data.roomCode];
    if (!room) return;
    const sender = room.players.find(p => p.id === socket.id);
    if (!sender || (sender.class || '').toLowerCase() !== 'scientist') return; // chỉ Scientist
    socket.to(data.roomCode).emit('heal_aoe', data);
  });

  socket.on('shield_wall_active', (data) => {
    // data: { roomCode, tankId, x, y, radius, duration }
    socket.to(data.roomCode).emit('shield_wall_active', data);
  });

  socket.on('taunt_active', (data) => {
    // data: { roomCode, duration, tankId, x, y }
    const room = activeRooms[data.roomCode];
    if (room) {
      // Server lưu state để pathing trong setInterval override target sang Tank
      room.tauntActive = {
        x: data.x,
        y: data.y,
        tankId: socket.id,
        expireAt: Date.now() + (data.duration || 8000)
      };
    }
    socket.to(data.roomCode).emit('taunt_active', data);
  });

  // TRAPPER MINES — Server-authoritative mine placement & detonation
  socket.on('mine_placed', (data) => {
    // data: { roomCode, x, y, isFreeze }
    const room = activeRooms[data.roomCode];
    if (!room) return;
    if (!room.mines) room.mines = {};
    const mineId = 'mine_' + Math.random().toString(36).substring(2, 9);
    room.mines[mineId] = {
      id: mineId,
      x: data.x,
      y: data.y,
      isFreeze: data.isFreeze,
      radius: data.isFreeze ? 100 : 80,
      damage: data.isFreeze ? 0 : 40,
      placedAt: Date.now(),
      placedBy: socket.id
    };
    // Broadcast mine visual cho tất cả client
    io.to(data.roomCode).emit('mine_placed', { mineId, x: data.x, y: data.y, isFreeze: data.isFreeze });
  });

  // ACTIVE SKILLS (slot R) — sát thương + hiệu ứng vùng, server-authoritative
  socket.on('skill_burst', (data) => {
    // data: { roomCode, x, y, radius, damage, effect, fx }
    const room = activeRooms[data.roomCode];
    if (!room || !room.zombies) return;
    const now = Date.now();
    const radius = data.radius || 120;
    const dmg = data.damage || 0;

    for (const zId in room.zombies) {
      const z = room.zombies[zId];
      if (z.isDead) continue;
      if (Math.hypot(z.x - data.x, z.y - data.y) > radius) continue;
      if (dmg > 0) applyZombieDamage(room, data.roomCode, zId, dmg, socket.id);
      // zombie có thể đã bị xóa nếu vừa chết — lấy lại tham chiếu để gắn hiệu ứng
      const zz = room.zombies[zId];
      if (zz && !zz.isDead && data.effect) {
        zz.effects = zz.effects || {};
        if (data.effect === 'freeze') zz.effects.freeze = now + 3000;
        else if (data.effect === 'slow') zz.effects.slow = now + 2000;
      }
    }
    io.to(data.roomCode).emit('skill_burst_fx', {
      x: data.x, y: data.y, radius, effect: data.effect || null, fx: data.fx || null
    });
  });

  // "Vùng Suy Nhược" (Scientist E) — debuff vùng: zombie trong bán kính nhận
  // vuln (+40% sát thương) + nhiễm độc (DoT). Chỉ Scientist được phát.
  socket.on('debuff_zone', (data) => {
    // data: { roomCode, x, y, radius, vulnMs, poisonDps, poisonMs }
    const room = activeRooms[data.roomCode];
    if (!room || !room.zombies) return;
    const sender = room.players.find(p => p.id === socket.id);
    if (!sender || (sender.class || '').toLowerCase() !== 'scientist') return;
    const now = Date.now();
    const radius   = data.radius   || 150;
    const vulnMs   = data.vulnMs   || 5000;
    const poisonMs = data.poisonMs || 5000;
    const dps      = data.poisonDps || 5;
    const affected = [];
    for (const zId in room.zombies) {
      const z = room.zombies[zId];
      if (z.isDead) continue;
      if (Math.hypot(z.x - data.x, z.y - data.y) > radius) continue;
      z.effects = z.effects || {};
      z.effects.vuln   = now + vulnMs;
      z.effects.poison = { until: now + poisonMs, dps, lastTick: now, by: socket.id };
      affected.push(zId);
    }
    io.to(data.roomCode).emit('debuff_zone_fx', {
      x: data.x, y: data.y, radius, duration: Math.max(vulnMs, poisonMs), zombieIds: affected
    });
  });

  socket.on('team_stim', (data) => {
    // data: { roomCode, duration, sourceId } — chỉ Scientist được phát
    const room = activeRooms[data.roomCode];
    if (!room) return;
    const sender = room.players.find(p => p.id === socket.id);
    if (!sender || (sender.class || '').toLowerCase() !== 'scientist') return;
    socket.to(data.roomCode).emit('team_stim', data);
  });




  socket.on('player_died', (data) => {
    const room = activeRooms[data.roomCode];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    killPlayer(room, data.roomCode, player);
    checkGameOver(room, data.roomCode);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
    // Clean up rooms
    for (const code in activeRooms) {
      const room = activeRooms[code];
      const pIndex = room.players.findIndex(p => p.id === socket.id);
      if (pIndex !== -1) {
        room.players.splice(pIndex, 1);
        if (room.players.length === 0) {
          delete activeRooms[code];
        } else {
          room.name = room.players[0].nickname;
          room.hostSocketId = room.players[0].id;
          io.to(room.players[0].id).emit('you_are_host');
          io.to(code).emit('room_update', room);
        }
        io.emit('room_list', Object.values(activeRooms).filter(r => r.status === 'waiting'));
      }
    }
  });
});

// --- SERVER-AUTHORITATIVE GAME LOOP ---
setInterval(() => {
  const now = Date.now();
  for (const code in activeRooms) {
    const room = activeRooms[code];

    // Intermission (wave chưa active): server lái việc chọn powerup + đếm ngược + AFK
    if (room.intermission && room.intermission.active) {
      handleIntermission(room, code, now);
      continue;
    }

    if (room.status !== 'playing' || !room.isWaveActive) continue;

    // 1. Spawning Logic — pacing "làn sóng": đợt dồn dập + lull ngắn giữa các đợt
    const bursts = room.spawnBursts || [room.zombiesToSpawn];
    const burstQuota = bursts[room.spawnBurstIdx || 0] || 0;
    const burstInterval = Math.max(280, 700 - (room.spawnBurstIdx || 0) * 130); // đợt sau dồn nhanh hơn (build-up → peak)
    const inLull = now < (room.lullUntil || 0);
    if (room.zombiesSpawned < room.zombiesToSpawn && !inLull && now - (room.lastSpawnTime || 0) > burstInterval) {
      room.lastSpawnTime = now;
      room.zombiesSpawned++;
      room.spawnedInBurst = (room.spawnedInBurst || 0) + 1;

      const margin = 50;
      const mapSize = 1600;
      const isHorizontal = Math.random() < 0.5;
      let x, y;
      if (isHorizontal) {
        x = Math.floor(Math.random() * (mapSize - margin * 2)) + margin;
        y = Math.random() < 0.5 ? margin : mapSize - margin;
      } else {
        x = Math.random() < 0.5 ? margin : mapSize - margin;
        y = Math.floor(Math.random() * (mapSize - margin * 2)) + margin;
      }

      const dp = room.difficultyParams || {};
      const speedMult = dp.zombieSpeedMultiplier || 1;
      const eliteChance = dp.eliteSpawnChance || 0;

      let type = 'walker';
      const types = ['walker', 'walker'];
      if (room.currentWave >= 3) types.push('runner');
      if (room.currentWave >= 4) types.push('runner');
      if (room.currentWave >= 6) types.push('spitter', 'screamer');
      if (room.currentWave >= 8) types.push('exploder');
      if (room.currentWave >= 11) types.push('brute');

      if (room.currentWave === 5) type = 'brute';
      else if (room.currentWave === 10) type = 'hordeking';
      else if (eliteChance > 0 && Math.random() < eliteChance) type = 'brute';
      else type = types[Math.floor(Math.random() * types.length)];

      const baseSpeed = type === 'runner' ? 120 : type === 'brute' ? 30 : 50;
      // HP ph\u1ea3i kh\u1edbp v\u1edbi Zombie.js client-side
      const HP_TABLE = { walker: 30, runner: 20, brute: 200, spitter: 30, hordeking: 500, screamer: 15, exploder: 40 };
      const zombieId = Math.random().toString(36).substring(2, 9);
      room.zombies[zombieId] = {
        id: zombieId,
        type: type,
        x: x,
        y: y,
        hp: HP_TABLE[type] || 30,
        speed: Math.round(baseSpeed * speedMult),
        rotation: 0
      };

      io.to(code).emit('zombie_spawned', {
        roomCode: code,
        zombieId: zombieId,
        type: type,
        x: x,
        y: y,
        hp: HP_TABLE[type] || 30
      });

      // Hết quota đợt này → sang đợt kế + nghỉ ngắn (lull) cho người chơi thở
      if (room.spawnedInBurst >= burstQuota && room.zombiesSpawned < room.zombiesToSpawn) {
        room.spawnBurstIdx = (room.spawnBurstIdx || 0) + 1;
        room.spawnedInBurst = 0;
        room.lullUntil = now + SPAWN_LULL_MS;
      }
    }

    // 2. Movement Logic (đuổi theo người chơi gần nhất, có honor effect/taunt)
    const alivePlayers = room.players.filter(p => p.isAlive && p.x !== undefined);
    const tauntActive = room.tauntActive && now < room.tauntActive.expireAt ? room.tauntActive : null;
    const zombieUpdates = []; // gom tất cả update của tick này thành 1 message
    if (alivePlayers.length > 0) {
      for (const zId in room.zombies) {
        const zombie = room.zombies[zId];
        const eff = zombie.effects || null;

        // Freeze: đứng yên hoàn toàn
        if (eff && eff.freeze && now < eff.freeze) continue;

        let targetX, targetY;
        if (tauntActive) {
          // Taunt override: zombie trong bán kính 320 chase Tank
          const distToTank = Math.hypot(tauntActive.x - zombie.x, tauntActive.y - zombie.y);
          if (distToTank < 320) {
            targetX = tauntActive.x;
            targetY = tauntActive.y;
          }
        }
        if (targetX === undefined) {
          let nearestPlayer = null;
          let minDist = Infinity;
          for (const player of alivePlayers) {
            const dist = Math.hypot(player.x - zombie.x, player.y - zombie.y);
            if (dist < minDist) {
              minDist = dist;
              nearestPlayer = player;
            }
          }
          if (nearestPlayer) {
            targetX = nearestPlayer.x;
            targetY = nearestPlayer.y;
          }
        }

        if (targetX !== undefined) {
          const dx = targetX - zombie.x;
          const dy = targetY - zombie.y;
          const distToTarget = Math.hypot(dx, dy);

          // Exploder: khi tiếp cận đủ gần thì phát nổ server-side (tránh multi-client damage)
          if (zombie.type === 'exploder' && distToTarget < 70 && !zombie.exploded) {
            zombie.exploded = true;
            zombie.isDead = true;
            delete room.zombies[zId];
            io.to(code).emit('exploder_exploded', {
              zombieId: zombie.id,
              x: zombie.x,
              y: zombie.y,
              radius: 70,
              damage: 25
            });
            continue;
          }

          if (distToTarget > 10) {
            const angle = Math.atan2(dy, dx);
            // Slow effect: -50% speed
            const slowMul = (eff && eff.slow && now < eff.slow) ? 0.5 : 1;
            const moveDist = zombie.speed * slowMul * (50 / 1000);
            zombie.x += Math.cos(angle) * moveDist;
            zombie.y += Math.sin(angle) * moveDist;
            zombie.rotation = angle;

            zombieUpdates.push({
              zombieId: zombie.id,
              x: zombie.x,
              y: zombie.y,
              rotation: zombie.rotation
            });
          }
        }
      }
    }
    // Phát 1 message gom cho cả phòng (thay vì 1 message / 1 zombie)
    if (zombieUpdates.length > 0) {
      io.to(code).emit('zombies_updated', zombieUpdates);
    }

    // 2c. Poison DoT (Scientist "Vùng Suy Nhược") — tick mỗi 1s, server-authoritative.
    // applyZombieDamage tự cộng vuln + ghi điểm cho Scientist (effects.poison.by).
    for (const zId of Object.keys(room.zombies)) {
      const z = room.zombies[zId];
      const ps = z && z.effects && z.effects.poison;
      if (!ps) continue;
      if (now >= ps.until) { delete z.effects.poison; continue; }
      if (now - ps.lastTick >= 1000) {
        ps.lastTick += 1000;
        applyZombieDamage(room, code, zId, ps.dps, ps.by);
      }
    }

    // 2b. Mine Trigger Logic
    if (room.mines && Object.keys(room.mines).length > 0) {
      for (const mineId in room.mines) {
        const mine = room.mines[mineId];
        // Expire after 15s
        if (now - mine.placedAt > 15000) {
          delete room.mines[mineId];
          continue;
        }
        let triggered = false;
        for (const zId in room.zombies) {
          const z = room.zombies[zId];
          if (Math.hypot(z.x - mine.x, z.y - mine.y) < 24) {
            triggered = true;
            break;
          }
        }
        if (!triggered) continue;
        // Áp damage + effect cho zombie trong radius
        for (const zId in room.zombies) {
          const z = room.zombies[zId];
          const d = Math.hypot(z.x - mine.x, z.y - mine.y);
          if (d >= mine.radius) continue;
          if (mine.damage > 0 && !z.isDead) {
            z.hp -= mine.damage;
            io.to(code).emit('zombie_took_damage', {
              roomCode: code,
              zombieId: zId,
              damage: mine.damage
            });
            if (z.hp <= 0) {
              z.isDead = true;
              const owner = room.players.find(p => p.id === mine.placedBy);
              const score = z.type === 'hordeking' ? 1000 : z.type === 'brute' ? 400 : z.type === 'runner' ? 40 : 100;
              if (owner) { owner.kills++; owner.score += score; }
              delete room.zombies[zId];
            }
          }
          if (z && !z.isDead) {
            z.effects = z.effects || {};
            if (mine.isFreeze) z.effects.freeze = now + 3000;
            else z.effects.slow = now + 2000;
          }
        }
        io.to(code).emit('mine_exploded', {
          mineId: mine.id,
          x: mine.x,
          y: mine.y,
          radius: mine.radius,
          isFreeze: mine.isFreeze
        });
        delete room.mines[mineId];
      }
    }

    // 3. Wave Clear Logic
    if (room.zombiesSpawned >= room.zombiesToSpawn && Object.keys(room.zombies).length === 0) {
      room.isWaveActive = false;
      room.voteResolved = false;
      room.votes = {};

      // Auto-revive: hồi sinh người chết nếu còn ≥1 người sống
      const alivePlayers = room.players.filter(p => p.isAlive);
      if (alivePlayers.length > 0) {
        const deadPlayers = room.players.filter(p => !p.isAlive && !p.afkOut); // afkOut: chết do AFK, không hồi sinh
        for (const dead of deadPlayers) {
          dead.isAlive = true;
          const spawnX = dead.deathX ?? 400;
          const spawnY = dead.deathY ?? 300;
          dead.deathTime = null;
          dead.deathX = null;
          dead.deathY = null;
          io.to(code).emit('player_revived', {
            targetId: dead.id,
            reviverId: null,
            x: spawnX,
            y: spawnY,
            hp: 50
          });
        }
      }

      // Calculate & Save Telemetry
      const wave = room.currentWave;
      const clearTimeSec = Math.max(1, Math.round((Date.now() - (room.waveStartTime || Date.now())) / 1000));
      const actionCount = room.telemetry ? room.telemetry.actionCount : 0;
      const apm = Math.round((actionCount / clearTimeSec) * 60);
      const shotsFired = room.telemetry ? room.telemetry.shotsFired : 0;
      const shotsHit = room.telemetry ? room.telemetry.shotsHit : 0;
      const avgAccuracy = shotsFired > 0 ? (shotsHit / shotsFired) : 0.5;
      const hpLossRate = 0; // Not perfectly tracked currently, placeholder

      Telemetry.create({ roomCode: code, wave, apm, avgAccuracy, hpLossRate, clearTime: clearTimeSec })
        .catch(e => console.error('Telemetry save error:', e));

      // Director heuristic (mặc định, luôn chạy) — điều chỉnh độ khó wave kế từ telemetry vừa tính.
      room.difficultyParams = computeDirector(room.difficultyParams, { avgAccuracy, clearTime: clearTimeSec });
      io.to(code).emit('difficulty_update', room.difficultyParams);
      console.log(`🎚️  [${code}] wave ${wave} cleared in ${clearTimeSec}s acc=${(avgAccuracy*100).toFixed(0)}% → speed×${room.difficultyParams.zombieSpeedMultiplier} elite=${room.difficultyParams.eliteSpawnChance}`);

      // Override bằng AI service nếu được cấu hình (AI_SERVICE_URL) — không bắt buộc.
      if (AI_SERVICE_URL) {
        fetch(`${AI_SERVICE_URL}/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wave, apm, avgAccuracy, hpLossRate, clearTime: clearTimeSec })
        })
        .then(res => res.json())
        .then(params => {
          AiDifficulty.create({ roomCode: code, wave, ...params }).catch(()=>{});
          if (activeRooms[code]) activeRooms[code].difficultyParams = params;
          io.to(code).emit('difficulty_update', params);
        })
        .catch(e => console.warn('AI service unavailable, using default difficulty'));
      }

      const POWERUP_POOL = [
        { id: 'speed_boost', name: 'Speed Boost', desc: '+20% tốc độ di chuyển', tier: 1 },
        { id: 'fire_ammo', name: 'Fire Ammo', desc: 'Đạn gây damage theo thời gian', tier: 2, isClassBonus: true, bonusText: '+15% Ranged' },
        { id: 'iron_skin', name: 'Iron Skin', desc: 'Giảm 20% damage nhận vào', tier: 2 },
        { id: 'regen_aura', name: 'Regen Aura', desc: 'Tự hồi 1HP/giây khi không bị tấn công', tier: 1 },
        { id: 'rapid_fire', name: 'Rapid Fire', desc: '+25% tốc độ bắn', tier: 2 },
        { id: 'medkit_surge', name: 'Medkit Surge', desc: 'Hồi phục 20HP ngay lập tức', tier: 1 }
      ];

      const CLASS_PREFERRED = {
        ranged:    ['rapid_fire', 'fire_ammo'],
        melee:     ['iron_skin', 'medkit_surge'],
        scientist: ['regen_aura', 'medkit_surge'],
        engineer:  ['speed_boost', 'iron_skin'],
      };

      function getPersonalizedOptions(playerClass) {
        const cls = (playerClass || '').toLowerCase();
        const preferred = CLASS_PREFERRED[cls] || [];
        const shuffled  = [...POWERUP_POOL].sort(() => Math.random() - 0.5);
        // Move preferred buffs to front
        shuffled.sort((a, b) => {
          const ap = preferred.includes(a.id), bp = preferred.includes(b.id);
          return ap === bp ? 0 : ap ? -1 : 1;
        });
        return shuffled.slice(0, 3);
      }

      // Mở intermission do server lái: theo dõi ai đã chọn powerup, đếm ngược 5s
      // khi đủ người, hoặc cho người AFK chết sau 60s.
      room.intermission = { active: true, startedAt: Date.now(), chosen: {}, countdownStart: null };

      room.players.forEach(p => {
        io.to(p.id).emit('intermission_start', {
          options: getPersonalizedOptions(p.class),
          wave: room.currentWave
        });
      });
    }
  }
}, 50);

// API: Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nickname, password } = req.body;
    
    if (!nickname || !password) {
      return res.status(400).json({ error: 'Cần điền tên và mật khẩu' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu cần ít nhất 6 ký tự' });
    }

    const existingUser = await User.findOne({ nickname });
    if (existingUser) {
      return res.status(400).json({ error: 'Tên người dùng đã được sử dụng' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = new User({
      nickname,
      passwordHash,
      createdAt: new Date(),
      lastLoginAt: new Date()
    });

    await newUser.save();
    
    res.status(201).json({
      message: 'Đăng ký thành công',
      user: {
        id: newUser._id,
        nickname: newUser.nickname,
        stats: newUser.stats
      }
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// API: Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { nickname, password } = req.body;
    
    const user = await User.findOne({ nickname });
    if (!user) {
      return res.status(400).json({ error: 'Tên người dùng hoặc mật khẩu không đúng' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Tên người dùng hoặc mật khẩu không đúng' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    res.status(200).json({
      message: 'Đăng nhập thành công',
      user: {
        id: user._id,
        nickname: user.nickname,
        stats: user.stats
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// API: Submit Score
app.post('/api/scores', async (req, res) => {
  try {
    const { nickname, class: playerClass, wave, kills, score, playerCount } = req.body;
    if (!nickname) return res.status(400).json({ error: 'Cần cung cấp tên người dùng' });

    await Score.create({ nickname, playerClass, wave, kills, score, playerCount });

    // Update user lifetime stats
    await User.updateOne(
      { nickname },
      {
        $inc: { 'stats.totalGames': 1, 'stats.totalKills': kills || 0, 'stats.totalScore': score || 0 },
        $max: { 'stats.bestWave': wave || 0 }
      }
    );

    res.status(201).json({ message: 'Score saved' });
  } catch (err) {
    console.error('Score save error:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// API: Leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const matchStage = {};
    if (req.query.period === 'week') {
      matchStage.playedAt = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
    }
    const entries = await Score.aggregate([
      ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
      {
        $group: {
          _id: '$nickname',
          bestWave: { $max: '$wave' },
          totalScore: { $sum: '$score' },
          playerClass: { $last: '$playerClass' },
          playerCount: { $last: '$playerCount' }
        }
      },
      { $sort: { bestWave: -1, totalScore: -1 } },
      { $limit: 50 }
    ]);

    const leaderboard = entries.map((e, i) => ({
      rank: i + 1,
      id: e._id.substring(0, 2).toUpperCase(),
      name: e._id,
      class: e.playerClass || 'Ranged',
      players: e.playerCount || 1,
      wave: e.bestWave,
      score: e.totalScore
    }));

    res.status(200).json(leaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`);
});
