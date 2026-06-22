<template>
  <div class="powerup-vote">
    <div class="header">
      <div class="header-text">
        <h2>Chọn nâng cấp</h2>
        <p>Wave {{ store.voteData.wave }} vừa kết thúc · Class: {{ store.voteData.class }} · <span class="highlight">Chọn 1 nâng cấp để tiếp tục</span></p>
      </div>
      <div class="badges">
        <span class="badge blue-badge">⚡ Wave {{ store.voteData.wave }}</span>
        <span class="badge default-badge">👥 {{ alivePlayers }}/{{ totalPlayers }} sống</span>
      </div>
    </div>

    <!-- locked: chặn mọi tương tác cho tới khi reveal xong (tránh lỡ tay chọn) -->
    <div class="cards-container" :class="{ locked: !ready }">
      <div
        v-for="(option, idx) in store.voteData.options"
        :key="option.id"
        class="card"
        :class="[
          'rarity-' + option.tier,
          { selected: store.pendingBuffId === option.id,
            disabled: store.pendingBuffId && store.pendingBuffId !== option.id,
            'reveal': true }
        ]"
        :style="{ animationDelay: (idx * STAGGER_MS) + 'ms' }"
        @click="selectCard(option)"
      >
        <span class="rarity-ribbon">{{ rarityName(option.tier) }}</span>

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

    <div class="lock-hint" v-if="!ready">Đang mở thẻ bài…</div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { store } from '../store.js';

const STAGGER_MS = 130;   // khoảng cách giữa các card khi reveal
const CARD_ANIM_MS = 480; // thời lượng 1 card bay vào

const alivePlayers = computed(() =>
  store.teammates.filter(t => t?.isAlive).length + (store.playerStats.isAlive ? 1 : 0)
);
const totalPlayers = computed(() => store.teammates.length + 1);

// Cấp stack hiện tại của buff tương ứng option (đọc từ store, GameScene đồng bộ mỗi frame).
const stackOf = (opt) => store.playerStats.buffStacks?.[opt.name] || 0;

// Khoá tương tác cho đến khi card cuối cùng reveal xong → KHÔNG thể chọn lúc animation chạy.
const ready = ref(false);
let revealTimer = null;
onMounted(() => {
  ready.value = false;
  const n = store.voteData.options?.length || 3;
  const total = (n - 1) * STAGGER_MS + CARD_ANIM_MS + 80; // +80ms đệm an toàn
  revealTimer = window.setTimeout(() => { ready.value = true; }, total);
});
onUnmounted(() => { if (revealTimer) clearTimeout(revealTimer); });

// Chọn xong → báo server + rời màn chọn ngay, về arena chờ đồng đội (banner trong HUD).
const selectCard = (option) => {
  if (!ready.value) return;          // chưa reveal xong → bỏ qua click
  if (store.pendingBuffId) return;   // đã chọn rồi
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
const rarityName = (tier) => (tier === 1 ? 'THƯỜNG' : tier === 2 ? 'HIẾM' : 'SỬ THI');
</script>

<style scoped>
.powerup-vote {
  width: 100%;
  height: 100%;
  background-color: rgba(26, 26, 26, 0.95);
  display: flex;
  flex-direction: column;
  justify-content: center;   /* canh giữa theo chiều dọc — hết khoảng trống thừa */
  align-items: center;
  gap: 26px;
  padding: 40px;
  box-sizing: border-box;
  color: white;
  font-family: 'Inter', sans-serif;
}

.header {
  width: 100%;
  max-width: 1040px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0;
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

.cards-container {
  display: flex;
  justify-content: center;
  align-items: stretch;       /* các thẻ cao bằng nhau, nhưng chỉ vừa nội dung */
  gap: 18px;
  width: 100%;
  max-width: 1040px;
}
/* Khoá: chặn click + hover cho toàn bộ thẻ trong lúc reveal */
.cards-container.locked {
  pointer-events: none;
}

.card {
  position: relative;
  flex: 1 1 0;
  max-width: 320px;
  background: linear-gradient(160deg, #2c2c2e 0%, #1f1f21 100%);
  border: 1.5px solid #444;
  border-radius: 14px;
  padding: 22px 22px 18px;
  cursor: pointer;
  transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.card:hover:not(.disabled):not(.selected) {
  transform: translateY(-6px);
}

/* ── Reveal animation: bay từ dưới lên + phóng to nhẹ + mờ→rõ ── */
.card.reveal {
  opacity: 0;
  animation: cardIn 480ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes cardIn {
  0%   { opacity: 0; transform: translateY(48px) scale(0.88); }
  60%  { opacity: 1; }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

/* ── Ngoại hình theo hạng ─────────────────────────────────── */
/* Hạng 1 — Thường: xanh lá trầm */
.card.rarity-1 {
  border-color: #3c6e47;
  box-shadow: 0 0 0 1px rgba(76, 175, 80, 0.15) inset;
}
.card.rarity-1:hover:not(.disabled):not(.selected) {
  border-color: #5cae6a; box-shadow: 0 8px 22px rgba(76, 175, 80, 0.22);
}
/* Hạng 2 — Hiếm: xanh dương phát sáng */
.card.rarity-2 {
  border-color: #2f6db0;
  box-shadow: 0 0 14px rgba(33, 150, 243, 0.18);
}
.card.rarity-2:hover:not(.disabled):not(.selected) {
  border-color: #4f9be6; box-shadow: 0 8px 26px rgba(33, 150, 243, 0.4);
}
/* Hạng 3 — Sử thi: tím→hồng, glow đập nhịp + ánh quét */
.card.rarity-3 {
  border-color: #a341d8;
  background: linear-gradient(160deg, #34203f 0%, #241226 100%);
  animation: cardIn 480ms cubic-bezier(0.16,1,0.3,1) forwards, epicGlow 2.2s ease-in-out infinite 0.6s;
}
.card.rarity-3:hover:not(.disabled):not(.selected) {
  border-color: #e36bff;
}
@keyframes epicGlow {
  0%, 100% { box-shadow: 0 0 16px rgba(186, 60, 230, 0.35); }
  50%      { box-shadow: 0 0 30px rgba(236, 64, 180, 0.6); }
}
/* Ánh quét chéo cho Sử thi */
.card.rarity-3::after {
  content: '';
  position: absolute;
  top: -60%; left: -120%;
  width: 60%; height: 220%;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,0.18), transparent);
  transform: rotate(18deg);
  animation: shimmer 3.2s ease-in-out infinite 1s;
}
@keyframes shimmer {
  0%   { left: -120%; }
  55%  { left: 130%; }
  100% { left: 130%; }
}

/* Ruy băng hạng góc trên-phải */
.rarity-ribbon {
  position: absolute;
  top: 14px; right: 14px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1px;
  padding: 3px 9px;
  border-radius: 6px;
  z-index: 2;
}
.rarity-1 .rarity-ribbon { background: rgba(76,175,80,0.18);  color: #8fe39a; }
.rarity-2 .rarity-ribbon { background: rgba(33,150,243,0.20); color: #82c0ff; }
.rarity-3 .rarity-ribbon {
  background: linear-gradient(90deg, #b03cd6, #ec40b4);
  color: #fff; box-shadow: 0 0 10px rgba(236,64,180,0.6);
}

.card.selected {
  background: #e3f2fd;
  border-color: #2196f3;
  color: #333;
  animation: none;
  opacity: 1;
  transform: translateY(0) scale(1);
}
.card.selected h3 { color: #1565c0; }
.card.selected .desc { color: #555; }
.card.selected::after { display: none; }
.card.disabled {
  opacity: 0.45;
  cursor: not-allowed;
  filter: grayscale(90%);
}

.card-icon {
  font-size: 28px;
  margin-bottom: 8px;
  z-index: 1;
}
.card h3 {
  margin: 0 0 8px 0;
  font-size: 20px;
  z-index: 1;
}
.class-color {
  color: #ff7a6b;
}
.desc {
  color: #b8b8b8;
  font-size: 14px;
  margin: 0 0 16px 0;
  line-height: 1.45;
  min-height: 40px;          /* 2 dòng — giữ tag thẳng hàng giữa các thẻ */
  z-index: 1;
}

.tags {
  display: flex;
  gap: 8px;
  margin-bottom: 0;
  flex-wrap: wrap;
  z-index: 1;
}
.tag {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}
.tier-1 { background-color: #e8f5e9; color: #2e7d32; }
.tier-2 { background-color: #e3f2fd; color: #1565c0; }
.tier-3 { background-color: #f3e5f5; color: #8e24aa; }
.class-tag { background-color: #fff3e0; color: #e65100; }
.stack-tag { background-color: #ede7f6; color: #5e35b1; }
.stack-tag.maxed { background-color: #424242; color: #ffca28; }

.picked-check {
  margin-top: 12px;
  font-weight: bold;
  color: #2ecc71;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 5px;
  z-index: 1;
}

/* Gợi ý đang mở thẻ — biến mất khi ready */
.lock-hint {
  text-align: center;
  color: #ffca28;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.5px;
  opacity: 0.85;
  animation: hintPulse 1s ease-in-out infinite;
}
@keyframes hintPulse {
  0%, 100% { opacity: 0.4; }
  50%      { opacity: 0.9; }
}
</style>
