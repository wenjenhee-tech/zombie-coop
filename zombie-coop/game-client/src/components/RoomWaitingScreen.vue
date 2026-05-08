<template>
  <div class="room-waiting-screen">
    <div class="vignette"></div>
    <div class="grain"></div>
    
    <div class="header">
      <div class="room-info">
        <h2>PHÒNG #{{ store.currentRoomDetails?.id || '...' }}</h2>
        <span class="difficulty-badge" :class="(store.currentRoomDetails?.difficulty || 'normal').toLowerCase()">
          {{ { EASY: 'DỄ', NORMAL: 'BÌNH THƯỜNG', HARD: 'KHÓ' }[(store.currentRoomDetails?.difficulty || 'normal').toUpperCase()] || 'BÌNH THƯỜNG' }}
        </span>
      </div>
      <button class="btn-outline" @click="leaveRoom">RỜI PHÒNG</button>
    </div>

    <div class="content">
      <div class="player-slots">
        <!-- Loop 4 slots -->
        <div 
          v-for="index in 4" 
          :key="index"
          class="slot"
          :class="{ 'is-empty': !store.currentRoomDetails.players[index - 1], 'is-you': store.currentRoomDetails.players[index - 1]?.nickname === store.playerStats.nickname }"
        >
          <template v-if="store.currentRoomDetails.players[index - 1]">
            <div class="slot-avatar">
              <span v-if="index === 1" class="host-icon">👑</span>
            </div>
            <div class="slot-info">
              <h4>{{ store.currentRoomDetails.players[index - 1].nickname }}</h4>
              <p>{{ store.currentRoomDetails.players[index - 1].class }}</p>
            </div>
          </template>
          <template v-else>
            <div class="slot-empty">
              <span>ĐANG CHỜ...</span>
            </div>
          </template>
        </div>
      </div>

      <div class="action-bar">
        <p class="status-text">
          {{ store.currentRoomDetails.isHost
            ? 'Sẵn sàng bắt đầu!'
            : 'Chờ chủ phòng bắt đầu...' }}
        </p>
        <button
          class="btn-primary"
          :disabled="!store.currentRoomDetails.isHost"
          @click="startGame"
        >
          BẮT ĐẦU
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { store } from '../store.js';

export default {
  setup() {
    const leaveRoom = () => {
      store.socket.emit('leave_room', store.currentRoomDetails.id);
      store.setScreen('lobby');
    };

    const startGame = () => {
      if (store.currentRoomDetails.isHost) {
        store.socket.emit('start_game', store.currentRoomDetails.id);
      }
    };

    return {
      store,
      leaveRoom,
      startGame
    };
  }
};
</script>

<style scoped>
.room-waiting-screen {
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

.room-info {
  display: flex;
  align-items: center;
  gap: 15px;
}
.room-info h2 {
  margin: 0;
  font-size: 28px;
  letter-spacing: 2px;
}
.difficulty-badge {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}
.difficulty-badge.easy { background: rgba(76, 175, 80, 0.2); color: #4caf50; border: 1px solid #4caf50; }
.difficulty-badge.normal { background: rgba(255, 152, 0, 0.2); color: #ff9800; border: 1px solid #ff9800; }
.difficulty-badge.hard { background: rgba(244, 67, 54, 0.2); color: #f44336; border: 1px solid #f44336; }

.btn-outline {
  background: transparent;
  border: 1px solid #555;
  color: #aaa;
  padding: 8px 20px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: bold;
}
.btn-outline:hover {
  background: #222;
  color: white;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 40px;
  flex: 1;
  align-items: center;
  justify-content: center;
}

.player-slots {
  display: flex;
  gap: 20px;
  width: 100%;
  max-width: 1000px;
}

.slot {
  flex: 1;
  background: rgba(26, 26, 26, 0.8);
  border: 2px solid #333;
  border-radius: 8px;
  height: 250px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.3s;
}

.slot.is-you {
  border-color: #b71c1c;
  background: rgba(183, 28, 28, 0.1);
  box-shadow: 0 0 20px rgba(183, 28, 28, 0.2);
}

.slot-avatar {
  width: 80px;
  height: 80px;
  background: #111;
  border: 2px solid #555;
  border-radius: 50%;
  margin-bottom: 20px;
  position: relative;
}
.is-you .slot-avatar {
  border-color: #ff5252;
}

.host-icon {
  position: absolute;
  top: -10px;
  right: -10px;
  font-size: 20px;
}

.slot-info {
  text-align: center;
}
.slot-info h4 {
  margin: 0 0 5px 0;
  font-size: 20px;
  color: white;
}
.is-you .slot-info h4 {
  color: #ff5252;
}
.slot-info p {
  margin: 0;
  color: #aaa;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.slot-empty {
  color: #555;
  font-weight: bold;
  letter-spacing: 2px;
  font-size: 14px;
}
.slot.is-empty {
  border: 2px dashed #333;
  background: transparent;
}

.action-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.status-text {
  color: #888;
  font-style: italic;
  margin: 0;
}

.btn-primary {
  background-color: #b71c1c;
  color: white;
  border: none;
  padding: 15px 40px;
  border-radius: 4px;
  font-size: 18px;
  font-weight: bold;
  letter-spacing: 2px;
  cursor: pointer;
  transition: all 0.3s;
}
.btn-primary:hover:not(:disabled) {
  background-color: #d32f2f;
  box-shadow: 0 0 20px rgba(211, 47, 47, 0.5);
}
.btn-primary:disabled {
  background-color: #333;
  color: #555;
  cursor: not-allowed;
}
</style>
