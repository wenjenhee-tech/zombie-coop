<template>
  <div class="app-container" @click="handleFirstInteraction">
    <!-- Global Background Music -->
    <audio ref="bgAudio" loop :muted="store.isMuted">
      <source src="/audio/Iron_Underfoot.mp3" type="audio/mpeg">
    </audio>

    <button class="global-mute-btn" @click="store.isMuted = !store.isMuted" title="Tắt/Bật tiếng">
      {{ store.isMuted ? '🔇' : '🔊' }}
    </button>
    <LoginScreen v-if="store.currentScreen === 'login'" />
    <LobbyScreen v-if="store.currentScreen === 'lobby'" />
    <RoomWaitingScreen v-if="store.currentScreen === 'room_waiting'" />
    <GameComponent v-if="['game', 'vote', 'spectator'].includes(store.currentScreen)" />
    
    <!-- Overlays on top of the game -->
    <div class="overlays" v-if="['vote', 'spectator'].includes(store.currentScreen)">
      <PowerupVote v-if="store.currentScreen === 'vote'" />
      <SpectatorView v-if="store.currentScreen === 'spectator'" />
    </div>

    <EndGameSummary v-if="store.currentScreen === 'summary'" />
    <Leaderboard v-if="store.currentScreen === 'leaderboard'" />

    <!-- Disconnect overlay -->
    <div v-if="store.isDisconnected" class="disconnect-overlay">
      <div class="disconnect-box">
        <div class="disconnect-title">Mất kết nối</div>
        <div class="disconnect-sub">Đang thử kết nối lại...</div>
        <div class="disconnect-spinner"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { store } from './store.js';
import LoginScreen from './components/LoginScreen.vue';
import LobbyScreen from './components/LobbyScreen.vue';
import RoomWaitingScreen from './components/RoomWaitingScreen.vue';
import GameComponent from './components/GameComponent.vue';
import PowerupVote from './components/PowerupVote.vue';
import SpectatorView from './components/SpectatorView.vue';
import EndGameSummary from './components/EndGameSummary.vue';
import Leaderboard from './components/Leaderboard.vue';

const bgAudio = ref(null);
const userInteracted = ref(false);

const handleFirstInteraction = () => {
  if (!userInteracted.value) {
    userInteracted.value = true;
    updateAudioPlayback(store.currentScreen);
  }
};

const updateAudioPlayback = (screen) => {
  if (!bgAudio.value || !userInteracted.value) return;
  
  const screensWithMusic = ['login', 'lobby', 'room_waiting'];
  if (screensWithMusic.includes(screen)) {
    if (bgAudio.value.paused) {
      bgAudio.value.play().catch(e => console.log('Autoplay blocked', e));
    }
  } else {
    bgAudio.value.pause();
  }
};

watch(() => store.currentScreen, (newScreen) => {
  updateAudioPlayback(newScreen);
});

watch(() => store.isMuted, (muted) => {
  if (!bgAudio.value) return;
  bgAudio.value.muted = muted;
  if (!muted) updateAudioPlayback(store.currentScreen);
});

onMounted(() => {
  // Attempt autoplay immediately
  updateAudioPlayback(store.currentScreen);
});
</script>

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  position: relative;
  background-color: #1a1a1a;
  overflow: hidden;
}
.overlays {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
}
.disconnect-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.disconnect-box {
  background: #1a1a2e;
  border: 2px solid #c0392b;
  border-radius: 12px;
  padding: 40px 56px;
  text-align: center;
  color: #fff;
}
.disconnect-title {
  font-size: 1.6rem;
  font-weight: 700;
  color: #e74c3c;
  margin-bottom: 10px;
  letter-spacing: 0.05em;
}
.disconnect-sub {
  font-size: 0.95rem;
  color: #aaa;
  margin-bottom: 24px;
}
.disconnect-spinner {
  width: 36px;
  height: 36px;
  border: 4px solid #444;
  border-top-color: #e74c3c;
  border-radius: 50%;
  margin: 0 auto;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.global-mute-btn {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid #555;
  color: white;
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
  transition: background 0.2s;
}
.global-mute-btn:hover {
  background: rgba(0, 0, 0, 0.8);
}
</style>
