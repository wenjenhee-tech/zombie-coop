<template>
  <div class="leaderboard-view">
    <div class="header">
      <div class="title">
        <h2>Bảng xếp hạng</h2>
        <p>Theo số wave cao nhất · Cập nhật realtime</p>
      </div>
      <div class="tabs">
        <span class="tab" :class="{ active: activeTab === 'all' }" @click="setTab('all')">Tất cả</span>
        <span class="tab" :class="{ active: activeTab === 'week' }" @click="setTab('week')">Tuần này</span>
        <span class="tab" :class="{ active: activeTab === 'friends' }" @click="setTab('friends')">Bạn bè</span>
      </div>
    </div>
    
    <div v-if="activeTab === 'friends'" class="friends-placeholder">
      <p>🔒 Tính năng Bạn bè sắp ra mắt</p>
    </div>

    <div v-else-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Dang tai du lieu...</p>
    </div>

    <div v-else class="list">
      <div
        v-for="entry in displayedLeaderboard"
        :key="entry.rank"
        class="row"
        :class="{ 
          'is-top': entry.rank === 1,
          'is-you': entry.isYou
        }"
      >
        <div class="rank">{{ entry.rank === 1 ? '👑' : entry.rank }}</div>
        <div class="avatar" :class="{'avatar-orange': entry.rank === 1, 'avatar-blue': entry.isYou}">{{ entry.id }}</div>
        <div class="info">
          <h4>{{ entry.name }} {{ entry.isYou ? '(bạn)' : '' }}</h4>
          <p>{{ entry.class }} · {{ entry.players }} người chơi</p>
        </div>
        <div class="score-info">
          <div class="wave">Wave {{ entry.wave }}</div>
          <div class="points">{{ entry.score.toLocaleString() }} điểm</div>
        </div>
      </div>
      
      <div class="ellipsis" v-if="displayedLeaderboard.length > 0">...</div>

      <div class="tip-box" v-if="myEntry || store.playerStats.nickname">
        <span class="icon">ℹ️</span> {{ tipText }}
        <button class="btn-play" @click="store.setScreen('lobby')">Chơi ngay</button>
      </div>

      <div v-if="displayedLeaderboard.length === 0" class="empty-state">
        Chưa có dữ liệu cho khoảng thời gian này.
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { store } from '../store.js';
import { API_URL } from '../config.js';

const activeTab = ref('all');
const weekLeaderboard = ref([]);
const isLoading = ref(false);

const fetchLeaderboard = async (period = null) => {
  try {
    const base = API_URL + '/api/leaderboard';
    const url = period ? `${base}?period=${period}` : base;
    const res = await fetch(url);
    const data = await res.json();
    const myNickname = store.playerStats.nickname;
    return data.map(e => ({ ...e, isYou: e.name === myNickname }));
  } catch (e) {
    console.error('Failed to fetch leaderboard:', e);
    return [];
  }
};

onMounted(async () => {
  store.leaderboard = await fetchLeaderboard();
});

const setTab = async (tab) => {
  activeTab.value = tab;
  if (tab === 'week' && weekLeaderboard.value.length === 0) {
    isLoading.value = true;
    weekLeaderboard.value = await fetchLeaderboard('week');
    isLoading.value = false;
  }
};

const displayedLeaderboard = computed(() => {
  if (activeTab.value === 'week') return weekLeaderboard.value;
  return store.leaderboard;
});

const myEntry = computed(() => displayedLeaderboard.value.find(e => e.isYou));
const tipText = computed(() => {
  if (!myEntry.value) return 'Chưa có dữ liệu xếp hạng của bạn';
  const above = displayedLeaderboard.value.find(e => e.rank === myEntry.value.rank - 1);
  if (!above) return `Best của bạn: Wave ${myEntry.value.wave} — Bạn đang ở hạng #1!`;
  return `Best của bạn: Wave ${myEntry.value.wave} — Cần vượt Wave ${above.wave} để lên hạng #${above.rank}`;
});
</script>

<style scoped>
.leaderboard-view {
  width: 100%;
  height: 100%;
  background-color: #0f0f0f;
  display: flex;
  flex-direction: column;
  padding: 40px 100px;
  box-sizing: border-box;
  color: #e0e0e0;
  font-family: 'Inter', sans-serif;
  position: relative;
}

.leaderboard-view::before {
  content: "";
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  box-shadow: 0 0 200px rgba(0,0,0,0.9) inset;
  pointer-events: none;
  z-index: 1;
}

.leaderboard-view::after {
  content: "";
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background-image: url('data:image/svg+xml;utf8,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)"/%3E%3C/svg%3E');
  opacity: 0.05;
  pointer-events: none;
  z-index: 2;
}

.header, .list {
  z-index: 10;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 30px;
}
.title h2 {
  font-size: 28px;
  margin: 0 0 5px 0;
  color: white;
  text-transform: uppercase;
  letter-spacing: 2px;
}
.title p {
  color: #888;
  margin: 0;
  font-size: 14px;
}

.tabs {
  display: flex;
  gap: 20px;
}
.tab {
  font-size: 16px;
  color: #666;
  cursor: pointer;
  padding-bottom: 5px;
  font-weight: bold;
  text-transform: uppercase;
}
.tab.active {
  color: #d32f2f;
  border-bottom: 2px solid #d32f2f;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.row {
  display: flex;
  align-items: center;
  background-color: rgba(26, 26, 26, 0.8);
  border: 1px solid #333;
  padding: 15px 20px;
  border-radius: 4px;
  gap: 20px;
  backdrop-filter: blur(5px);
}
.row.is-top {
  background-color: rgba(216, 67, 21, 0.1);
  border-color: #d84315;
}
.row.is-top .info p, .row.is-top .points {
  color: #ffab91;
}
.row.is-top h4, .row.is-top .wave {
  color: #ff5722;
}

.row.is-you {
  background-color: rgba(183, 28, 28, 0.1);
  border-color: #b71c1c;
}
.row.is-you .info p, .row.is-you .points {
  color: #ff8a80;
}
.row.is-you h4, .row.is-you .wave {
  color: #ff5252;
}

.rank {
  width: 30px;
  text-align: center;
  font-weight: bold;
  font-size: 18px;
  color: #aaa;
}
.row.is-top .rank {
  color: #ff5722;
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
.avatar-orange {
  background-color: #d84315;
  color: white;
}
.avatar-blue {
  background-color: #b71c1c;
  color: white;
}

.info {
  flex: 1;
}
.info h4 {
  margin: 0 0 5px 0;
  font-size: 16px;
  color: #fff;
}
.info p {
  margin: 0;
  font-size: 13px;
  color: #888;
}

.score-info {
  text-align: right;
}
.wave {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 5px;
  color: #e0e0e0;
}
.points {
  font-size: 13px;
  color: #888;
}

.ellipsis {
  text-align: center;
  color: #555;
  font-size: 20px;
  margin: 10px 0;
}

.tip-box {
  background-color: rgba(216, 67, 21, 0.1);
  color: #ffab91;
  border: 1px solid #d84315;
  border-radius: 4px;
  padding: 15px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.btn-play {
  background-color: transparent;
  border: 1px solid #d84315;
  padding: 8px 20px;
  border-radius: 4px;
  color: #ffab91;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-play:hover {
  background-color: #d84315;
  color: white;
}

.friends-placeholder, .empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #555;
  font-size: 18px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 60px 20px;
  color: #666;
  font-size: 14px;
  z-index: 10;
}
.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #333;
  border-top-color: #d32f2f;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
