import { reactive } from 'vue';
import { io } from 'socket.io-client';
import { API_URL } from './config.js';

const socket = io(API_URL);

export const store = reactive({
  currentScreen: 'login', // 'login', 'game', 'vote', 'spectator', 'summary', 'leaderboard'
  
  socket: socket,

  playerStats: {
    nickname: '',
    class: 'Gunner',
    roomCode: '',
    kills: 0,
    waves: 0,
    revives: 0,
    score: 0,
    hp: 100,
    maxHp: 100,
    isAlive: true,
    primaryCDReadyRatio: 1,
    secondaryCDReadyRatio: 1,
    shotsFired: 0,
    shotsHit: 0
  },
  
  pendingBuffId: null,

  voteData: {
    wave: 1,
    class: 'Gunner',
    winner: null,
    options: [
      { id: 'speed_boost', name: 'Speed Boost', desc: '+20% tốc độ di chuyển toàn đội', tier: 1, votes: { type: 'T', count: 1 } },
      { id: 'fire_ammo', name: 'Fire Ammo', desc: 'Đạn gây damage theo thời gian', tier: 2, isClassBonus: true, bonusText: '+15% Gunner', votes: { type: 'B', count: 0 } },
      { id: 'regen_aura', name: 'Regen Aura', desc: 'Tự hồi 1HP/giây khi không bị tấn công', tier: 1, votes: { type: 'C', count: 0 } }
    ],
    activeBuffs: ['Speed Boost', 'Iron Skin']
  },
  
  teammates: [],
  spectatingIndex: 0,

  endGameStats: {
    result: 'Thua',
    wave: 1,
    time: '0 phút 0 giây',
    totalKills: 0,
    powerupsUsed: 0,
    totalScore: 0,
    players: []
  },
  
  publicRooms: [],
  joinRequestStatus: null,
  leaderboard: [],
  remainingZombies: 0,
  isDisconnected: false,
  isMuted: false,

  currentRoomDetails: {
    id: '',
    difficulty: 'NORMAL',
    isHost: false,
    players: [] // Array of { id, nickname, class, isReady }
  },

  setScreen(screen) {
    this.currentScreen = screen;
  }
});

// Socket listeners
socket.on('room_list', (rooms) => {
  store.publicRooms = rooms;
});

socket.on('room_update', (room) => {
  store.currentRoomDetails = {
    id: room.id,
    difficulty: room.difficulty,
    isHost: room.players[0]?.id === socket.id,
    players: room.players
  };
});

socket.on('game_started', (data) => {
  const classMaxHp = { Gunner: 80, Tank: 150, Medic: 90, Trapper: 85 };
  store.teammates = store.currentRoomDetails.players
    .filter(p => p.id !== socket.id)
    .map(p => ({
      id: p.id,
      name: p.nickname,
      class: p.class || 'Gunner',
      hp: classMaxHp[p.class] || 100,
      maxHp: classMaxHp[p.class] || 100,
      isAlive: true
    }));
  store.playerStats.kills = 0;
  store.playerStats.score = 0;
  store.playerStats.shotsFired = 0;
  store.playerStats.shotsHit = 0;
  store.playerStats.isAlive = true;
  if (data && data.wallData) {
    store.currentRoomDetails.wallData = data.wallData;
  }
  store.setScreen('game');
});

socket.on('player_moved', (data) => {
  const mate = store.teammates.find(t => t.id === data.id);
  if (mate) {
    mate.x = data.x;
    mate.y = data.y;
  }
});

socket.on('player_died', (data) => {
  const mate = store.teammates.find(t => t.id === data.id);
  if (mate) {
    mate.isAlive = false;
    mate.deathX = data.x;
    mate.deathY = data.y;
    mate.deathTime = Date.now();
  }
});

socket.on('player_revived', (data) => {
  if (data.targetId === socket.id) {
    store.playerStats.isAlive = true;
    store.playerStats.hp = data.hp;
  } else {
    const mate = store.teammates.find(t => t.id === data.targetId);
    if (mate) {
      mate.isAlive = true;
      mate.hp = data.hp;
      mate.deathX = null;
      mate.deathY = null;
      mate.deathTime = null;
    }
  }
  if (data.reviverId === socket.id) {
    store.playerStats.revives = (store.playerStats.revives || 0) + 1;
  }
});

socket.on('game_over', (data) => {
  const mins = Math.floor((data.elapsedMs || 0) / 60000);
  const secs = Math.floor(((data.elapsedMs || 0) % 60000) / 1000);

  const players = data.players || [];
  const mvp = players.reduce((a, b) => (a.kills >= b.kills ? a : b), players[0] || {});

  const accuracy = store.playerStats.shotsFired > 0
    ? Math.round((store.playerStats.shotsHit / store.playerStats.shotsFired) * 100)
    : 0;

  store.endGameStats.wave = data.wave;
  store.endGameStats.result = data.result || 'Thua';
  store.endGameStats.time = `${mins} phút ${secs} giây`;
  store.endGameStats.totalKills = players.reduce((s, p) => s + (p.kills || 0), 0);
  store.endGameStats.totalScore = players.reduce((s, p) => s + (p.score || 0), 0);
  store.endGameStats.powerupsUsed = Math.max(0, data.wave - 1);
  store.endGameStats.players = players.map(p => {
    const isYou = p.id === socket.id;
    return {
      id: p.name.substring(0, 2).toUpperCase(),
      name: p.name,
      class: p.class || 'Gunner',
      isYou,
      isMVP: p.id === mvp?.id,
      kills: p.kills || 0,
      deaths: p.isAlive ? 0 : 1,
      score: p.score || 0,
      accuracy: isYou ? accuracy : Math.min(99, Math.floor(Math.random() * 35 + 45)),
      statName: 'Chính xác'
    };
  });

  store.setScreen('summary');
});

socket.on('error', (msg) => {
  alert(msg);
});

socket.on('disconnect', () => {
  store.isDisconnected = true;
});

socket.on('connect', () => {
  store.isDisconnected = false;
});
