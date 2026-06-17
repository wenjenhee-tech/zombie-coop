<template>
  <div class="spectator-view">
    <div class="header">
      <div class="title-group">
        <h2><span class="red-dot">●</span> Bạn đã tử trận</h2>
        <p>Đang theo dõi: <span class="highlight">{{ spectatingPlayer?.name }}</span> · Wave {{ store.playerStats.waves + 1 }} · Zombie còn lại: {{ store.remainingZombies }}</p>
      </div>
      <div class="badges">
        <span class="badge red-badge">Bạn: đã chết</span>
        <span class="badge default-badge">Wave {{ store.playerStats.waves + 1 }}</span>
      </div>
    </div>
    
    <div class="teammates-section">
      <p class="section-title">Đang theo dõi góc nhìn của đội · Nhấn tên để chuyển</p>
      
      <div class="teammates-grid">
        <div 
          v-for="(mate, index) in allPlayers" 
          :key="mate.id"
          class="mate-card"
          :class="{ 
            active: isSpectating(mate), 
            dead: !mate.isAlive 
          }"
          @click="spectate(mate)"
        >
          <div class="avatar" :class="{ 'avatar-blue': isSpectating(mate) }">{{ mate.avatar }}</div>
          <div class="info">
            <div class="name-row">
              <h4>{{ mate.name }} {{ mate.isYou ? '(bạn)' : '' }}</h4>
              <span v-if="isSpectating(mate)" class="status-text blue-text">Đang xem</span>
            </div>
            <p class="class-status">{{ mate.class }} · <span :class="mate.isAlive ? 'green-text' : 'red-text'">{{ mate.isAlive ? 'Sống' : 'Đã chết' }}</span></p>
            
            <div class="hp-bar-container" v-if="mate.isAlive">
              <div class="hp-bar" :style="{ width: (mate.hp / mate.maxHp * 100) + '%', backgroundColor: isSpectating(mate) ? '#3498db' : (mate.class === 'Melee' ? '#2ecc71' : '#f39c12') }"></div>
            </div>
            <p class="hp-text">{{ mate.hp }} HP</p>
          </div>
        </div>
      </div>
    </div>
    
    <div class="stats-section">
      <h3>STATS CỦA BẠN TRƯỚC KHI CHẾT</h3>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="value">{{ store.playerStats.kills }}</div>
          <div class="label">Tiêu diệt</div>
        </div>
        <div class="stat-box">
          <div class="value">{{ store.playerStats.waves }}</div>
          <div class="label">Wave sống sót</div>
        </div>
        <div class="stat-box">
          <div class="value">{{ store.playerStats.revives }}</div>
          <div class="label">Lần revive</div>
        </div>
        <div class="stat-box">
          <div class="value">{{ store.playerStats.score }}</div>
          <div class="label">Điểm</div>
        </div>
      </div>
    </div>
    
    <div class="revive-alert">
      Bạn sẽ tự động hồi sinh khi wave kết thúc (50 HP).
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { store } from '../store.js';

const allPlayers = computed(() => {
  const me = {
    id: store.socket.id,
    avatar: store.playerStats.nickname.substring(0, 2).toUpperCase(),
    name: store.playerStats.nickname,
    class: store.playerStats.class,
    hp: store.playerStats.hp,
    maxHp: store.playerStats.maxHp,
    isAlive: store.playerStats.isAlive,
    isYou: true
  };
  const teammates = store.teammates
    .filter(t => t != null)
    .map(t => ({ ...t, avatar: t.name.substring(0, 2).toUpperCase() }));
  return [...teammates, me];
});

const spectatingPlayer = computed(() => {
  return store.teammates[store.spectatingIndex] ?? null;
});

const isSpectating = (mate) => {
  return spectatingPlayer.value && mate.id === spectatingPlayer.value.id;
};

const spectate = (mate) => {
  if (!mate.isAlive || mate.isYou) return;
  const index = store.teammates.findIndex(t => t.id === mate.id);
  if (index !== -1) {
    store.spectatingIndex = index;
  }
};
</script>

<style scoped>
.spectator-view {
  width: 100%;
  height: 100%;
  background-color: rgba(26, 26, 26, 0.95);
  display: flex;
  flex-direction: column;
  padding: 40px 100px;
  box-sizing: border-box;
  color: white;
  font-family: 'Inter', sans-serif;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 30px;
}
.header h2 {
  font-size: 24px;
  margin: 0 0 10px 0;
}
.red-dot {
  color: #e74c3c;
}
.header p {
  color: #aaa;
  margin: 0;
  font-size: 16px;
}
.highlight {
  color: #3498db;
}

.badges {
  display: flex;
  gap: 10px;
}
.badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  background-color: #2a2a2a;
  border: 1px solid #444;
  color: #aaa;
}
.red-badge {
  background-color: rgba(192, 57, 43, 0.2);
  border-color: #c0392b;
  color: #e74c3c;
}
.default-badge {
  color: #aaa;
}

.teammates-section {
  background-color: #222;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}
.section-title {
  text-align: center;
  color: #aaa;
  font-size: 14px;
  margin: 0 0 20px 0;
}

.teammates-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.mate-card {
  background-color: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  padding: 15px;
  display: flex;
  align-items: center;
  gap: 15px;
  cursor: pointer;
  transition: all 0.2s;
}
.mate-card:hover:not(.dead) {
  border-color: #666;
}
.mate-card.active {
  background-color: #1a2a3a;
  border-color: #2196f3;
  color: #e0e0e0;
}
.mate-card.active h4 {
  color: #64b5f6;
}
.mate-card.dead {
  opacity: 0.5;
  cursor: not-allowed;
}

.avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background-color: #444;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  font-size: 18px;
}
.avatar-blue {
  background-color: #1565c0;
  color: #e3f2fd;
}

.info {
  flex: 1;
}
.name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.info h4 {
  margin: 0 0 5px 0;
  font-size: 16px;
}
.status-text {
  font-size: 12px;
  font-weight: 600;
}
.blue-text { color: #1976d2; }
.green-text { color: #2ecc71; }
.red-text { color: #e74c3c; }

.class-status {
  margin: 0 0 10px 0;
  font-size: 13px;
  color: #888;
}

.hp-bar-container {
  height: 6px;
  background-color: #444;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 5px;
}
.hp-bar {
  height: 100%;
}
.hp-text {
  margin: 0;
  font-size: 12px;
  color: #888;
}
.mate-card.active .class-status, .mate-card.active .hp-text {
  color: #555;
}

.stats-section {
  background-color: #222;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}
.stats-section h3 {
  margin: 0 0 20px 0;
  font-size: 14px;
  color: #aaa;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  text-align: center;
}
.stat-box .value {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 5px;
}
.stat-box .label {
  font-size: 14px;
  color: #888;
}

.revive-alert {
  background-color: rgba(33, 150, 243, 0.08);
  color: #90caf9;
  padding: 15px;
  border-radius: 8px;
  font-size: 14px;
  border: 1px solid #1565c0;
}
</style>
