<template>
  <div class="powerup-vote">
    <div class="header">
      <div class="header-text">
        <h2>Chọn power-up</h2>
        <p>Wave {{ store.voteData.wave }} vừa kết thúc · Class: {{ store.voteData.class }} · <span class="highlight">Chọn 1 power-up để tiếp tục</span></p>
      </div>
      <div class="badges">
        <span class="badge blue-badge">⚡ Wave {{ store.voteData.wave }}</span>
        <span class="badge default-badge">👥 {{ alivePlayers }}/{{ totalPlayers }} sống</span>
      </div>
    </div>
    
    <div class="bonus-alert">
      <strong>⭐ {{ store.voteData.class }} bonus:</strong> Power-up thiên về sát thương và tốc độ bắn hiệu quả hơn +15%
    </div>
    
    <div class="cards-container">
      <div 
        v-for="option in store.voteData.options" 
        :key="option.id"
        class="card"
        :class="{ selected: store.pendingBuffId === option.id, disabled: store.pendingBuffId && store.pendingBuffId !== option.id }"
        @click="selectCard(option)"
      >
        <div class="card-icon">{{ getIcon(option.tier) }}</div>
        <h3 :class="{'class-color': option.isClassBonus}">{{ option.name }}</h3>
        <p class="desc">{{ option.desc }}</p>
        
        <div class="tags">
          <span class="tag" :class="'tier-' + option.tier">Hạng {{ option.tier }}</span>
          <span v-if="option.isClassBonus" class="tag class-tag">{{ option.bonusText }}</span>
          <span
            v-if="option.maxStacks"
            class="tag stack-tag"
            :class="{ maxed: stackOf(option) >= option.maxStacks }"
          >{{ stackOf(option) >= option.maxStacks ? '✓ ĐÃ MAX' : `Lv ${stackOf(option)}/${option.maxStacks}` }}</span>
        </div>
        
        <div v-if="store.pendingBuffId === option.id" class="picked-check">
          ✓ Đã chọn
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed } from 'vue';
import { store } from '../store.js';

const alivePlayers = computed(() =>
  store.teammates.filter(t => t?.isAlive).length + (store.playerStats.isAlive ? 1 : 0)
);
const totalPlayers = computed(() => store.teammates.length + 1);

// Cấp stack hiện tại của buff tương ứng option (đọc từ store, GameScene đồng bộ mỗi frame).
const stackOf = (opt) => store.playerStats.buffStacks?.[opt.name] || 0;

// Chọn xong → báo server + rời màn chọn ngay, về arena chờ đồng đội (banner trong HUD).
const selectCard = (option) => {
  if (store.pendingBuffId) return; // đã chọn rồi
  store.pendingBuffId = option.id;
  store.socket.emit('powerup_chosen', {
    roomCode: store.currentRoomDetails.id,
    buffId: option.id,
  });
  store.setScreen('game');
};

const getIcon = (tier) => {
  if (tier === 1) return '⚡';
  if (tier === 2) return '🔥';
  return '💥';
};
</script>

<style scoped>
.powerup-vote {
  width: 100%;
  height: 100%;
  background-color: rgba(26, 26, 26, 0.95);
  display: flex;
  flex-direction: column;
  padding: 60px 100px;
  box-sizing: border-box;
  color: white;
  font-family: 'Inter', sans-serif;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}
.header h2 {
  font-size: 28px;
  margin: 0 0 10px 0;
}
.header p {
  color: #aaa;
  margin: 0;
  font-size: 16px;
}
.highlight {
  color: #3498db;
  font-weight: bold;
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
}
.blue-badge {
  background-color: #e3f2fd;
  color: #1565c0;
}
.default-badge {
  background-color: #333;
  color: #eeddcc;
}

.bonus-alert {
  background-color: #fff3e0;
  color: #e65100;
  padding: 15px 20px;
  border-radius: 8px;
  margin-bottom: 30px;
  border: 1px solid #ffe0b2;
}

.cards-container {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  flex: 1;
}

.card {
  flex: 1;
  background-color: #2a2a2a;
  border: 1px solid #444;
  border-radius: 12px;
  padding: 30px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
}
.card:hover:not(.disabled):not(.selected) {
  transform: translateY(-5px);
  border-color: #666;
}
.card.selected {
  background-color: #e3f2fd;
  border-color: #2196f3;
  color: #333;
}
.card.selected h3 {
  color: #1565c0;
}
.card.selected .desc {
  color: #555;
}
.card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(100%);
}

.card-icon {
  font-size: 24px;
  margin-bottom: 15px;
}
.card h3 {
  margin: 0 0 10px 0;
  font-size: 22px;
}
.class-color {
  color: #e74c3c;
}
.desc {
  color: #aaa;
  font-size: 15px;
  margin: 0 0 20px 0;
  line-height: 1.4;
  flex: 1;
}

.tags {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}
.tag {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}
.tier-1 {
  background-color: #e8f5e9;
  color: #2e7d32;
}
.tier-2 {
  background-color: #fff3e0;
  color: #e65100;
}
.tier-3 {
  background-color: #fce4ec;
  color: #c2185b;
}
.class-tag {
  background-color: #e3f2fd;
  color: #1565c0;
}
.stack-tag {
  background-color: #ede7f6;
  color: #5e35b1;
}
.stack-tag.maxed {
  background-color: #424242;
  color: #ffca28;
}

.picked-check {
  margin-top: auto;
  font-weight: bold;
  color: #2ecc71;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.waiting-text {
  text-align: center;
  color: #2ecc71;
  font-size: 18px;
  font-weight: bold;
  padding: 15px;
  background: rgba(46, 204, 113, 0.1);
  border-radius: 8px;
  border: 1px solid #2ecc71;
}
</style>
