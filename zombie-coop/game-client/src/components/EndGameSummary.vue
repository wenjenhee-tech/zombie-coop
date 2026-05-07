<template>
  <div class="end-game-summary">
    <div class="header-result">
      <p class="subtitle">KẾT QUẢ</p>
      <h1>Wave {{ store.endGameStats.wave }} — {{ store.endGameStats.result }}</h1>
      <p class="meta">Thời gian: {{ store.endGameStats.time }} · Phòng: #{{ store.playerStats.roomCode }}</p>
    </div>
    
    <div class="overall-stats">
      <div class="stat">
        <div class="value">{{ store.endGameStats.wave }}</div>
        <div class="label">Wave đạt được</div>
      </div>
      <div class="stat">
        <div class="value">{{ store.endGameStats.totalKills }}</div>
        <div class="label">Zombie tiêu diệt</div>
      </div>
      <div class="stat">
        <div class="value">{{ store.endGameStats.powerupsUsed }}</div>
        <div class="label">Power-up đã chọn</div>
      </div>
      <div class="stat">
        <div class="value">{{ store.endGameStats.totalScore.toLocaleString() }}</div>
        <div class="label">Tổng điểm</div>
      </div>
    </div>
    
    <div class="player-achievements">
      <h3>THÀNH TÍCH TỪNG NGƯỜI</h3>
      <div class="achievements-grid">
        <div 
          v-for="p in store.endGameStats.players" 
          :key="p.id"
          class="player-card"
          :class="{ 'is-you': p.isYou }"
        >
          <div class="card-header">
            <div class="avatar" :class="{ 'avatar-blue': p.isYou }">{{ p.id }}</div>
            <div class="name-info">
              <h4>{{ p.name }} {{ p.isYou ? '(bạn)' : '' }}</h4>
              <span class="class-tag">{{ p.class }}</span>
            </div>
            <div v-if="p.isMVP" class="mvp-badge">👑 MVP</div>
          </div>
          
          <div class="card-stats">
            <div class="row"><span>Kills</span> <strong>{{ p.kills }}</strong></div>
            <div class="row"><span>{{ p.revives !== undefined ? 'Revives' : 'Lần chết' }}</span> <strong>{{ p.revives !== undefined ? p.revives : p.deaths }}</strong></div>
            <div class="row"><span>Điểm</span> <strong>{{ p.score.toLocaleString() }}</strong></div>
            
            <div class="special-stat">
              <span>{{ p.statName }}</span>
              <div class="bar-container">
                <div class="bar" :style="{ width: getSpecialStatValue(p) + '%', backgroundColor: getBarColor(p) }"></div>
              </div>
              <strong>{{ getSpecialStatValue(p) }}%</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="action-buttons">
      <button class="btn-outline" @click="store.setScreen('lobby')">↻ Chơi lại</button>
      <button class="btn-primary" @click="store.setScreen('leaderboard')">📊 Bảng xếp hạng</button>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { store } from '../store.js';

onMounted(() => {
  // Điểm số và Telemetry hiện tại đã được Server tự động lưu trực tiếp vào Database
  // Không cần thiết phải fetch API từ Client nữa để tránh gian lận.
});

const getSpecialStatValue = (p) => {
  if (p.accuracy !== undefined) return p.accuracy;
  if (p.damageBlock !== undefined) return p.damageBlock;
  if (p.healDone !== undefined) return p.healDone;
  return 50;
};

const getBarColor = (p) => {
  if (p.isYou) return '#3498db';
  if (p.class === 'Tank') return '#e74c3c';
  if (p.class === 'Medic') return '#2ecc71';
  return '#3498db';
};
</script>

<style scoped>
.end-game-summary {
  width: 100%;
  height: 100%;
  background-color: #0f0f0f;
  display: flex;
  flex-direction: column;
  padding: 40px 100px;
  box-sizing: border-box;
  color: #e0e0e0;
  font-family: 'Inter', sans-serif;
  overflow-y: auto;
  position: relative;
}

.end-game-summary::before {
  content: "";
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  box-shadow: 0 0 200px rgba(0,0,0,0.9) inset;
  pointer-events: none;
  z-index: 1;
}

.end-game-summary::after {
  content: "";
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background-image: url('data:image/svg+xml;utf8,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)"/%3E%3C/svg%3E');
  opacity: 0.05;
  pointer-events: none;
  z-index: 2;
}

.header-result, .overall-stats, .player-achievements, .action-buttons {
  z-index: 10;
}

.header-result {
  text-align: center;
  margin-bottom: 40px;
}
.header-result .subtitle {
  color: #d32f2f;
  letter-spacing: 2px;
  font-size: 14px;
  margin-bottom: 10px;
  font-weight: bold;
}
.header-result h1 {
  font-size: 42px;
  margin: 0 0 10px 0;
  color: white;
  text-transform: uppercase;
}
.header-result .meta {
  color: #888;
  font-size: 14px;
}

.overall-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  text-align: center;
  margin-bottom: 50px;
}
.stat .value {
  font-size: 36px;
  font-weight: bold;
  margin-bottom: 5px;
  color: #e0e0e0;
}
.stat .label {
  color: #888;
  font-size: 14px;
}

.player-achievements h3 {
  font-size: 14px;
  color: #d32f2f;
  margin-bottom: 20px;
  letter-spacing: 1px;
}

.achievements-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 40px;
}

.player-card {
  background-color: rgba(26, 26, 26, 0.8);
  border: 1px solid #333;
  border-radius: 4px;
  padding: 20px;
  backdrop-filter: blur(5px);
}
.player-card.is-you {
  background-color: rgba(183, 28, 28, 0.1);
  border-color: #b71c1c;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
}
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  background-color: #333;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
}
.is-you .avatar {
  background-color: #b71c1c;
  color: white;
}

.name-info {
  flex: 1;
}
.name-info h4 {
  margin: 0 0 5px 0;
  font-size: 18px;
  color: #fff;
}
.is-you .name-info h4 {
  color: #ff5252;
}

.class-tag {
  background-color: #111;
  color: #aaa;
  padding: 2px 8px;
  border-radius: 2px;
  font-size: 12px;
  border: 1px solid #333;
}
.is-you .class-tag {
  border-color: #b71c1c;
  color: #ff5252;
}

.mvp-badge {
  background-color: #f39c12;
  color: #111;
  padding: 4px 10px;
  border-radius: 2px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
}

.card-stats {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.row {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid #333;
  padding-bottom: 10px;
}
.is-you .row {
  border-color: #5c1616;
}
.row span {
  color: #888;
}
.is-you .row span {
  color: #ff8a80;
}
.row strong {
  font-weight: 600;
  color: #e0e0e0;
}

.special-stat {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-top: 10px;
}
.special-stat span {
  width: 100px;
  color: #888;
}
.is-you .special-stat span {
  color: #ff8a80;
}
.bar-container {
  flex: 1;
  height: 6px;
  background-color: #333;
  border-radius: 2px;
  overflow: hidden;
}
.is-you .bar-container {
  background-color: #5c1616;
}
.bar {
  height: 100%;
}

.action-buttons {
  display: flex;
  gap: 20px;
}
button {
  flex: 1;
  padding: 15px;
  border-radius: 4px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  border: none;
  font-family: 'Inter', sans-serif;
  letter-spacing: 1px;
}
.btn-outline {
  background-color: transparent;
  color: #aaa;
  border: 1px solid #555;
  transition: all 0.2s;
}
.btn-outline:hover {
  background-color: #222;
  color: white;
}
.btn-primary {
  background-color: #b71c1c;
  color: white;
  transition: all 0.2s;
}
.btn-primary:hover {
  background-color: #d32f2f;
  box-shadow: 0 0 15px rgba(211, 47, 47, 0.4);
}
</style>
