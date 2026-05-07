<template>
  <div class="powerup-vote">
    <div class="header">
      <div class="header-text">
        <h2>Chọn power-up</h2>
        <p>Wave {{ store.voteData.wave }} vừa kết thúc · Class: {{ store.voteData.class }} · Vote trong <span class="highlight">{{ timeLeft }}</span>s</p>
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
        v-for="(option, index) in store.voteData.options" 
        :key="option.id"
        class="card"
        :class="{ selected: selectedIndex === index }"
        @click="selectCard(index)"
      >
        <div class="card-icon">{{ getIcon(option.tier) }}</div>
        <h3 :class="{'class-color': option.isClassBonus}">{{ option.name }}</h3>
        <p class="desc">{{ option.desc }}</p>
        
        <div class="tags">
          <span class="tag" :class="'tier-' + option.tier">Tier {{ option.tier }}</span>
          <span v-if="option.isClassBonus" class="tag class-tag">{{ option.bonusText }}</span>
        </div>
        
        <div class="votes">
          <span class="vote-label">Votes</span>
          <div class="vote-circles">
            <div class="circle" :class="{ filled: (voteCounts[option.id] || 0) >= 1 }"></div>
            <div class="circle" :class="{ filled: (voteCounts[option.id] || 0) >= 2 }"></div>
            <div class="circle" :class="{ filled: (voteCounts[option.id] || 0) >= 3 }"></div>
            <div class="circle" :class="{ filled: (voteCounts[option.id] || 0) >= 4 }"></div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="active-buffs">
      <h4>BUFF ĐANG ACTIVE</h4>
      <div class="buff-tags">
        <span v-for="(buff, i) in store.voteData.activeBuffs" :key="i" class="buff-tag">
          {{ getBuffIcon(buff) }} {{ buff }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { store } from '../store.js';

const timeLeft = ref(15);
const selectedIndex = ref(-1);
const voteCounts = ref({});
const voteResolved = ref(false);
const hasVoted = ref(false);
const waveStartSent = ref(false);
let timer = null;

const alivePlayers = computed(() =>
  store.teammates.filter(t => t?.isAlive).length + (store.playerStats.isAlive ? 1 : 0)
);
const totalPlayers = computed(() => store.teammates.length + 1);

const startTimer = () => {
  clearInterval(timer);
  timeLeft.value = 15;
  voteResolved.value = false;
  hasVoted.value = false;
  waveStartSent.value = false;
  selectedIndex.value = -1;
  voteCounts.value = {};
  timer = setInterval(() => {
    timeLeft.value--;
    if (timeLeft.value <= 0) {
      clearInterval(timer);
      if (!voteResolved.value && store.currentRoomDetails.isHost) {
        store.socket.emit('finalize_vote', store.currentRoomDetails.id);
      }
    }
  }, 1000);
};

const onVoteUpdate = (tally) => {
  voteCounts.value = { ...tally };
};

const onVoteResult = ({ winnerId }) => {
  if (voteResolved.value) return; // Chống gọi nhiều lần
  voteResolved.value = true;
  clearInterval(timer);
  store.voteData.winner = winnerId;
  if (winnerId) {
    const winnerOpt = store.voteData.options.find(o => o.id === winnerId);
    if (winnerOpt && !store.voteData.activeBuffs.includes(winnerOpt.name)) {
      store.voteData.activeBuffs.push(winnerOpt.name);
    }
  }
  if (store.currentRoomDetails.isHost && !waveStartSent.value) {
    waveStartSent.value = true;
    setTimeout(() => {
      store.socket.emit('start_next_wave', store.currentRoomDetails.id);
    }, 2000);
  }
};

onMounted(() => {
  store.socket.on('vote_update', onVoteUpdate);
  store.socket.on('vote_result', onVoteResult);
  startTimer();
});

// Reset timer every time vote screen is shown (wave 2+)
watch(() => store.currentScreen, (screen) => {
  if (screen === 'vote') startTimer();
});

onUnmounted(() => {
  clearInterval(timer);
  store.socket.off('vote_update', onVoteUpdate);
  store.socket.off('vote_result', onVoteResult);
});

const selectCard = (index) => {
  if (voteResolved.value || hasVoted.value) return; // đã chốt hoặc đã vote — bỏ qua
  hasVoted.value = true;
  selectedIndex.value = index;
  const option = store.voteData.options[index];
  if (option) {
    store.socket.emit('cast_vote', {
      roomCode: store.playerStats.roomCode,
      powerId: option.id
    });
  }
};

const getIcon = (tier) => {
  if (tier === 1) return '⚡';
  if (tier === 2) return '🔥';
  return '💥';
};

const getBuffIcon = (buff) => {
  if (buff.includes('Speed')) return '⚡';
  if (buff.includes('Iron')) return '🛡';
  return '✨';
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
  margin-bottom: 40px;
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
.card:hover {
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

.votes {
  margin-top: auto;
}
.vote-label {
  font-size: 12px;
  color: #888;
  display: block;
  margin-bottom: 8px;
}
.vote-circles {
  display: flex;
  gap: 5px;
}
.circle {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: #444;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 12px;
  font-weight: bold;
  color: white;
}
.circle.filled {
  background-color: #2ecc71;
}
.circle.blue-fill {
  background-color: #3498db;
}

.card.selected .circle {
  background-color: #ccc;
}
.card.selected .circle.blue-fill {
  background-color: #3498db;
}

.active-buffs h4 {
  font-size: 14px;
  color: #888;
  margin: 0 0 10px 0;
  letter-spacing: 1px;
}
.buff-tags {
  display: flex;
  gap: 10px;
}
.buff-tag {
  padding: 6px 15px;
  border-radius: 20px;
  background-color: #e8f5e9;
  color: #2e7d32;
  font-size: 14px;
  font-weight: 500;
}
.buff-tag:nth-child(2) {
  background-color: #f3e5f5;
  color: #7b1fa2;
}
</style>
