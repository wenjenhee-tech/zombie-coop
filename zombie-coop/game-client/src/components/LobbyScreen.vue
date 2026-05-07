<template>
  <div class="lobby-screen">
    <div class="vignette"></div>
    <div class="grain"></div>
    
    <div class="header">
      <div class="user-info">
        <div class="avatar"></div>
        <div>
          <h3>{{ store.playerStats.nickname }}</h3>
          <p>Level {{ store.playerStats.waves }} Survivor</p>
        </div>
      </div>
      <button class="btn-outline" @click="store.setScreen('login')">LOGOUT</button>
    </div>

    <div class="content">
      <!-- CLASS SELECTION -->
      <div class="panel class-panel">
        <h2 class="panel-title">SELECT CLASS</h2>
        <div class="class-grid">
          <div
            v-for="c in classes"
            :key="c.id"
            class="class-card"
            :class="{ active: store.playerStats.class === c.name }"
            @click="store.playerStats.class = c.name"
          >
            <div class="class-icon">{{ c.icon }}</div>
            <h4>{{ c.name }}</h4>
            <p>{{ c.desc }}</p>
          </div>
        </div>

        <!-- Class Detail Panel -->
        <div class="class-detail" v-if="selectedClass">
          <div class="detail-header">
            <span class="role-badge">{{ selectedClass.role }}</span>
            <span class="class-name-lg">{{ selectedClass.icon }} {{ selectedClass.name }}</span>
          </div>
          <div class="stat-bars">
            <div class="stat-row">
              <span class="stat-label">HP</span>
              <div class="stat-bar-bg">
                <div class="stat-bar-fill hp" :style="{ width: (selectedClass.stats.hp / 150 * 100) + '%' }"></div>
              </div>
              <span class="stat-val">{{ selectedClass.stats.hp }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Speed</span>
              <div class="stat-bar-bg">
                <div class="stat-bar-fill speed" :style="{ width: (selectedClass.stats.speed / 230 * 100) + '%' }"></div>
              </div>
              <span class="stat-val">{{ selectedClass.stats.speed }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">DMG</span>
              <div class="stat-bar-bg">
                <div class="stat-bar-fill dmg" :style="{ width: (selectedClass.stats.dmg / 35 * 100) + '%' }"></div>
              </div>
              <span class="stat-val">{{ selectedClass.stats.dmg }}</span>
            </div>
          </div>
          <div class="skill-list">
            <div class="skill-row" v-for="skill in selectedClass.skills" :key="skill.key + skill.name">
              <span class="skill-key" :class="'key-' + skill.key.toLowerCase()">{{ skill.key }}</span>
              <div class="skill-info">
                <span class="skill-name">{{ skill.name }}</span>
                <span class="skill-desc">{{ skill.desc }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- PUBLIC ROOMS -->
      <div class="panel room-panel">
        <div class="panel-header">
          <h2 class="panel-title">PUBLIC ZONES</h2>
          <div class="create-actions">
            <select v-model="selectedDifficulty" class="difficulty-select">
              <option value="easy">EASY</option>
              <option value="normal">NORMAL</option>
              <option value="hard">HARD</option>
            </select>
            <button class="btn-create" @click="createRoom">CREATE ZONE</button>
          </div>
        </div>
        
        <div class="room-list">
          <div v-if="store.publicRooms.length === 0" class="room-empty">
            Khong co phong nao dang mo. Hay tao phong moi!
          </div>
          <div v-for="room in store.publicRooms" :key="room.id" class="room-row">
            <div class="room-info">
              <h4>Zone #{{ room.id }} <span class="host-badge">Host: {{ room.name }}</span></h4>
              <p>Wave {{ room.wave }} · {{ room.difficulty ? room.difficulty.toUpperCase() : 'NORMAL' }}</p>
            </div>
            <div class="room-status">
              <span class="player-count">{{ room.players }}/{{ room.maxPlayers }}</span>
              <button 
                class="btn-join" 
                :disabled="room.players >= room.maxPlayers || store.joinRequestStatus === 'pending'"
                @click="requestJoin(room.id)"
              >
                {{ store.joinRequestStatus === 'pending' && selectedRoom === room.id ? 'REQUESTING...' : 'JOIN' }}
              </button>
            </div>
          </div>
        </div>
        
        <div v-if="store.joinRequestStatus === 'pending'" class="status-box">
          <span class="spinner"></span> Waiting for host approval...
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { store } from '../store.js';

const classes = [
  {
    id: 'gunner', name: 'Gunner', icon: '🔫',
    desc: 'Sát thương cao, bắn nhanh', role: 'DPS',
    stats: { hp: 80, speed: 210, dmg: 35 },
    skills: [
      { key: 'Q', name: 'Mưa Đạn', desc: 'Xuyên giáp, tốc độ đạn ×2 trong 3 giây' },
      { key: 'Passive', name: 'Adrenaline', desc: 'HP < 30% → tự động tăng 40% tốc bắn' }
    ]
  },
  {
    id: 'tank', name: 'Tank', icon: '🛡️',
    desc: 'Máu trâu, giáp dày', role: 'Tank',
    stats: { hp: 150, speed: 150, dmg: 20 },
    skills: [
      { key: 'Q', name: 'Khiên Thép', desc: 'Giảm 60% sát thương nhận trong 5 giây' },
      { key: 'E', name: 'Khiêu Chiến', desc: 'Kéo zombie tập trung vào mình trong 8 giây' },
      { key: 'Passive', name: 'Chặn Đòn', desc: 'Chặn hoàn toàn mỗi đòn thứ 5' }
    ]
  },
  {
    id: 'medic', name: 'Medic', icon: '💉',
    desc: 'Hồi máu cho đồng đội', role: 'Support',
    stats: { hp: 90, speed: 230, dmg: 15 },
    skills: [
      { key: 'Q', name: 'Cứu Thương', desc: 'Hồi 30 HP cho bản thân và đồng đội xung quanh' },
      { key: 'Passive', name: 'Khử Rung Tim', desc: 'HP < 10% → tự hồi 30 HP (CD: 30s)' }
    ]
  },
  {
    id: 'trapper', name: 'Trapper', icon: '🪤',
    desc: 'Đặt mìn, kiểm soát đám đông', role: 'Control',
    stats: { hp: 85, speed: 230, dmg: 15 },
    skills: [
      { key: 'Q', name: 'Bãi Mìn', desc: 'Đặt 5 mìn AoE gây sát thương vùng' },
      { key: 'E', name: 'Bẫy Băng', desc: 'Đặt 1 mìn đóng băng zombie trong 3 giây' }
    ]
  }
];

const selectedClass = computed(() =>
  classes.find(c => c.name === store.playerStats.class) ?? classes[0]
);

const selectedRoom = ref('');
const selectedDifficulty = ref('normal');

const createRoom = () => {
  store.playerStats.roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  store.playerStats.difficulty = selectedDifficulty.value;
  
  store.socket.emit('create_room', {
    code: store.playerStats.roomCode,
    hostName: store.playerStats.nickname,
    difficulty: selectedDifficulty.value,
    class: store.playerStats.class
  });
  
  store.setScreen('room_waiting');
};

const requestJoin = (roomId) => {
  selectedRoom.value = roomId;
  store.joinRequestStatus = 'pending';
  store.playerStats.roomCode = roomId;

  store.socket.emit('join_room', {
    code: roomId,
    nickname: store.playerStats.nickname,
    class: store.playerStats.class
  });

  store.setScreen('room_waiting');
};
</script>

<style scoped>
.lobby-screen {
  width: 100%;
  height: 100%;
  background-color: #0f0f0f;
  display: flex;
  flex-direction: column;
  padding: 40px 100px;
  box-sizing: border-box;
  position: relative;
  font-family: 'Inter', sans-serif;
  color: #e0e0e0;
}

.vignette {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  box-shadow: 0 0 200px rgba(0,0,0,0.9) inset;
  pointer-events: none;
  z-index: 1;
}

.grain {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background-image: url('data:image/svg+xml;utf8,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)"/%3E%3C/svg%3E');
  opacity: 0.05;
  pointer-events: none;
  z-index: 2;
}

.header, .content {
  z-index: 10;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
  border-bottom: 1px solid #333;
  padding-bottom: 20px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.avatar {
  width: 50px;
  height: 50px;
  background-color: #333;
  border: 2px solid #b71c1c;
  border-radius: 4px;
}

.user-info h3 {
  margin: 0 0 5px 0;
  font-size: 20px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-info p {
  margin: 0;
  color: #888;
  font-size: 13px;
}

.btn-outline {
  background: transparent;
  border: 1px solid #555;
  color: #aaa;
  padding: 8px 20px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-outline:hover {
  background: #222;
  color: white;
}

.content {
  display: flex;
  gap: 40px;
  flex: 1;
  min-height: 0;
}

.panel {
  background: rgba(26, 26, 26, 0.6);
  border: 1px solid #333;
  border-radius: 4px;
  padding: 25px;
  display: flex;
  flex-direction: column;
}

.class-panel {
  flex: 1;
}

.room-panel {
  flex: 1;
}

.panel-title {
  font-size: 18px;
  color: #888;
  letter-spacing: 2px;
  margin: 0 0 20px 0;
}

.class-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.class-card {
  background: #151515;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}
.class-card:hover {
  border-color: #555;
  background: #222;
}
.class-card.active {
  border-color: #d32f2f;
  background: rgba(211, 47, 47, 0.1);
}

.class-icon {
  font-size: 32px;
  margin-bottom: 10px;
}
.class-card h4 {
  margin: 0 0 5px 0;
  color: #fff;
}
.class-card p {
  margin: 0;
  font-size: 12px;
  color: #888;
}

.class-detail {
  margin-top: 16px;
  background: rgba(211, 47, 47, 0.05);
  border: 1px solid #2a2a2a;
  border-radius: 4px;
  padding: 16px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.role-badge {
  font-size: 11px;
  font-weight: bold;
  letter-spacing: 1px;
  padding: 3px 8px;
  border-radius: 3px;
  background: rgba(211, 47, 47, 0.2);
  border: 1px solid #d32f2f;
  color: #d32f2f;
}

.class-name-lg {
  font-size: 16px;
  font-weight: bold;
  color: #fff;
}

.stat-bars {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-bottom: 14px;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  width: 42px;
  font-size: 11px;
  color: #888;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.stat-bar-bg {
  flex: 1;
  height: 6px;
  background: #222;
  border-radius: 3px;
  overflow: hidden;
}

.stat-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}
.stat-bar-fill.hp    { background: #d32f2f; }
.stat-bar-fill.speed { background: #1565c0; }
.stat-bar-fill.dmg   { background: #e65100; }

.stat-val {
  width: 28px;
  font-size: 12px;
  color: #aaa;
  text-align: right;
}

.skill-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skill-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.skill-key {
  min-width: 48px;
  font-size: 10px;
  font-weight: bold;
  letter-spacing: 0.5px;
  padding: 3px 6px;
  border-radius: 3px;
  text-align: center;
}
.skill-key.key-q       { background: #d32f2f; color: #fff; }
.skill-key.key-e       { background: #bf360c; color: #fff; }
.skill-key.key-passive { background: #333; color: #aaa; border: 1px solid #555; }

.skill-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.skill-name {
  font-size: 13px;
  font-weight: bold;
  color: #e0e0e0;
}

.skill-desc {
  font-size: 11px;
  color: #777;
  line-height: 1.4;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.create-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}
.difficulty-select {
  background-color: #111;
  color: #aaa;
  border: 1px solid #333;
  padding: 8px 10px;
  border-radius: 4px;
  font-family: 'Inter', sans-serif;
  font-weight: bold;
  font-size: 13px;
  outline: none;
}
.difficulty-select:focus {
  border-color: #d32f2f;
}
.btn-create {
  background-color: #b71c1c;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s;
}
.btn-create:hover {
  background-color: #d32f2f;
}

.room-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.room-empty {
  text-align: center;
  padding: 40px 20px;
  color: #555;
  font-size: 14px;
  border: 1px dashed #333;
  border-radius: 4px;
}

.room-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #151515;
  border: 1px solid #333;
  padding: 15px;
  border-radius: 4px;
}
.room-info h4 {
  margin: 0 0 5px 0;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.host-badge {
  font-size: 11px;
  background: #333;
  padding: 2px 6px;
  border-radius: 2px;
  color: #aaa;
}
.room-info p {
  margin: 0;
  font-size: 13px;
  color: #888;
}

.room-status {
  display: flex;
  align-items: center;
  gap: 15px;
}
.player-count {
  color: #d32f2f;
  font-weight: bold;
}
.btn-join {
  background: #333;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
}
.btn-join:hover:not(:disabled) {
  background: #555;
}
.btn-join:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-box {
  margin-top: 20px;
  padding: 15px;
  background: rgba(211, 47, 47, 0.1);
  border: 1px solid #d32f2f;
  color: #ff8a80;
  border-radius: 4px;
  text-align: center;
  font-size: 14px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,138,128, 0.3);
  border-top-color: #ff8a80;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
