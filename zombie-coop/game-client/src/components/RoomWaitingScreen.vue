<template>
  <div class="hud-screen room-waiting-screen">
    <div class="header">
      <div class="room-info">
        <div class="room-code">
          <span class="hud-tag">MÃ TẬP KẾT</span>
          <h2>#{{ store.currentRoomDetails?.id || '...' }}</h2>
          <button class="btn-copy" @click="copyCode" :title="copied ? 'Đã sao chép' : 'Sao chép mã'">
            {{ copied ? '✓' : '⧉' }}
          </button>
        </div>
        <span class="difficulty-badge" :class="(store.currentRoomDetails?.difficulty || 'normal').toLowerCase()">
          {{ { EASY: 'DỄ', NORMAL: 'BÌNH THƯỜNG', HARD: 'KHÓ' }[(store.currentRoomDetails?.difficulty || 'normal').toUpperCase()] || 'BÌNH THƯỜNG' }}
        </span>
      </div>
      <button class="btn-outline" @click="leaveRoom">RỜI PHÒNG</button>
    </div>

    <div class="content">
      <h3 class="muster-title">◢ KHU TẬP KẾT &mdash; ĐỘI SỐNG SÓT</h3>
      <div class="player-slots">
        <div
          v-for="index in 4"
          :key="index"
          class="slot"
          :class="[
            classKey(store.currentRoomDetails.players[index - 1]),
            {
              'is-empty': !store.currentRoomDetails.players[index - 1],
              'is-you': store.currentRoomDetails.players[index - 1]?.nickname === store.playerStats.nickname
            }
          ]"
        >
          <template v-if="store.currentRoomDetails.players[index - 1]">
            <span v-if="index === 1" class="host-icon" title="Chủ phòng">👑</span>
            <div class="slot-avatar">{{ classIcon(store.currentRoomDetails.players[index - 1]) }}</div>
            <div class="slot-info">
              <h4>{{ store.currentRoomDetails.players[index - 1].nickname }}</h4>
              <p>{{ store.currentRoomDetails.players[index - 1].class }}</p>
            </div>
            <span class="slot-tag ready">● SẴN SÀNG</span>
          </template>
          <template v-else>
            <div class="slot-empty">
              <div class="scan-box"></div>
              <span class="hud-tag">ĐANG CHỜ<span class="hud-loading-dots"></span></span>
            </div>
          </template>
        </div>
      </div>

      <div class="action-bar">
        <p class="status-text" :class="{ host: store.currentRoomDetails.isHost }">
          <template v-if="store.currentRoomDetails.isHost">
            <span class="hud-dot"></span> Sẵn sàng triển khai!
          </template>
          <template v-else>
            Chờ chủ phòng bắt đầu<span class="hud-loading-dots"></span>
          </template>
        </p>
        <button
          class="btn-primary"
          :class="{ ready: store.currentRoomDetails.isHost }"
          :disabled="!store.currentRoomDetails.isHost"
          @click="startGame"
        >
          ▶ BẮT ĐẦU
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue';
import { store } from '../store.js';

const CLASS_ICON = { gunner: '🔫', tank: '🛡️', medic: '💉', trapper: '🪤' };

export default {
  setup() {
    const copied = ref(false);

    const classKey = (p) => 'cls-' + ((p?.class || 'gunner').toLowerCase());
    const classIcon = (p) => CLASS_ICON[(p?.class || '').toLowerCase()] || '🧍';

    const copyCode = () => {
      const code = store.currentRoomDetails?.id;
      if (!code) return;
      navigator.clipboard?.writeText(code).then(() => {
        copied.value = true;
        setTimeout(() => { copied.value = false; }, 1500);
      }).catch(() => {});
    };

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
      copied,
      classKey,
      classIcon,
      copyCode,
      leaveRoom,
      startGame
    };
  }
};
</script>

<style scoped>
.room-waiting-screen {
  display: flex;
  flex-direction: column;
  padding: 32px 72px;
}

.cls-gunner  { --cls: var(--cls-gunner); }
.cls-tank    { --cls: var(--cls-tank); }
.cls-medic   { --cls: var(--cls-medic); }
.cls-trapper { --cls: var(--cls-trapper); }

/* ---------- HEADER ---------- */
.header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 36px; padding-bottom: 18px;
  border-bottom: 1px solid var(--hud-line);
}
.room-info { display: flex; align-items: center; gap: 18px; }
.room-code { display: flex; align-items: center; gap: 10px; }
.room-code .hud-tag { align-self: center; }
.room-code h2 {
  margin: 0; font-size: 30px; letter-spacing: 2px;
  font-family: var(--font-display); color: #fff;
  text-shadow: 0 0 18px rgba(193, 18, 31, 0.3);
}
.btn-copy {
  background: #1a1b1f; border: 1px solid var(--hud-line-2);
  color: var(--hud-amber-2); width: 32px; height: 32px;
  border-radius: var(--hud-radius); cursor: pointer; font-size: 15px;
  transition: all 0.15s;
}
.btn-copy:hover { border-color: var(--hud-amber); background: #222; }

.difficulty-badge {
  padding: 4px 12px; border-radius: var(--hud-radius);
  font-size: 12px; font-weight: bold; font-family: var(--font-head); letter-spacing: 1px;
}
.difficulty-badge.easy   { background: rgba(70,200,122,0.18); color: var(--hud-ok); border: 1px solid var(--hud-ok); }
.difficulty-badge.normal { background: var(--hud-amber-dim); color: var(--hud-amber-2); border: 1px solid var(--hud-amber); }
.difficulty-badge.hard   { background: var(--hud-blood-dim); color: var(--hud-blood-2); border: 1px solid var(--hud-blood); }

.btn-outline {
  background: transparent; border: 1px solid var(--hud-line-2);
  color: #aaa; padding: 8px 18px; border-radius: var(--hud-radius);
  cursor: pointer; transition: all 0.2s;
  font-family: var(--font-head); letter-spacing: 1px; font-size: 13px;
}
.btn-outline:hover { background: #1c1c1f; color: white; border-color: var(--hud-blood); }

/* ---------- CONTENT ---------- */
.content { display: flex; flex-direction: column; gap: 30px; flex: 1; align-items: center; justify-content: center; }
.muster-title {
  font-family: var(--font-head); color: var(--hud-amber);
  letter-spacing: 4px; font-size: 16px; margin: 0; font-weight: 600;
}

.player-slots { display: flex; gap: 18px; width: 100%; max-width: 1000px; }

.slot {
  --cls: var(--hud-blood);
  flex: 1; height: 250px;
  background: var(--hud-panel);
  border: 2px solid var(--hud-line);
  border-radius: 6px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  position: relative; transition: all 0.3s;
  overflow: hidden;
}
.slot:not(.is-empty) {
  border-color: var(--cls);
  background: color-mix(in srgb, var(--cls) 9%, var(--hud-panel));
  box-shadow: 0 0 22px color-mix(in srgb, var(--cls) 22%, transparent);
}
.slot.is-you { border-style: solid; }
.slot.is-you::after {
  content: 'BẠN'; position: absolute; top: 10px; left: 10px;
  font-family: var(--font-head); font-size: 10px; letter-spacing: 1px;
  color: var(--cls); border: 1px solid var(--cls);
  padding: 2px 6px; border-radius: 3px;
}

.host-icon { position: absolute; top: 10px; right: 12px; font-size: 20px; }

.slot-avatar {
  width: 84px; height: 84px;
  display: flex; align-items: center; justify-content: center;
  font-size: 40px;
  background: #0e0f12; border: 2px solid var(--cls);
  border-radius: 50%; margin-bottom: 16px;
  box-shadow: 0 0 18px color-mix(in srgb, var(--cls) 30%, transparent);
}
.slot-info { text-align: center; }
.slot-info h4 {
  margin: 0 0 4px 0; font-size: 19px; color: white;
  font-family: var(--font-head); letter-spacing: 0.5px;
  max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.slot-info p { margin: 0; color: var(--cls); font-size: 13px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600; }
.slot-tag { margin-top: 12px; font-size: 11px; font-family: var(--font-head); letter-spacing: 1px; }
.slot-tag.ready { color: var(--hud-ok); }

.slot.is-empty { border: 2px dashed var(--hud-line-2); background: rgba(255,255,255,0.012); }
.slot-empty { display: flex; flex-direction: column; align-items: center; gap: 14px; color: var(--hud-ink-faint); }
.scan-box {
  width: 60px; height: 60px;
  border: 1px solid var(--hud-line-2); border-radius: 50%;
  position: relative; overflow: hidden;
}
.scan-box::after {
  content: ''; position: absolute; left: 0; right: 0; height: 40%;
  background: linear-gradient(180deg, transparent, rgba(245,166,35,0.18), transparent);
  animation: scan-move 2.2s ease-in-out infinite;
}
@keyframes scan-move { 0%,100% { top: -40%; } 50% { top: 100%; } }

/* ---------- ACTION BAR ---------- */
.action-bar { display: flex; flex-direction: column; align-items: center; gap: 16px; }
.status-text { color: var(--hud-ink-dim); margin: 0; display: flex; align-items: center; gap: 8px; font-size: 14px; }
.status-text.host { color: var(--hud-ok); }

.btn-primary {
  background: #2a2a2e; color: #666; border: none;
  padding: 15px 46px; border-radius: var(--hud-radius);
  font-family: var(--font-head); font-size: 18px; font-weight: 700; letter-spacing: 3px;
  cursor: not-allowed; transition: all 0.25s;
}
.btn-primary.ready {
  background: linear-gradient(180deg, var(--hud-blood-2), var(--hud-blood));
  color: white; cursor: pointer;
  border-top: 1px solid rgba(255,255,255,0.25);
  animation: hud-pulse 2s ease-in-out infinite;
}
.btn-primary.ready:hover { filter: brightness(1.1); box-shadow: 0 0 26px rgba(239, 59, 59, 0.5); }
.btn-primary.ready:active { transform: translateY(1px); }
</style>
