<template>
  <div class="game-wrapper">
    <div id="phaser-container"></div>

    <!-- HUD Overlay -->
    <div class="hud-overlay">
      <div class="hud-bottom">
        <!-- Health Bar -->
        <div class="health-bar-container">
          <div class="hp-text">{{ store.playerStats.hp }} / {{ store.playerStats.maxHp }} HP</div>
          <div class="health-bar-bg">
            <div
              class="health-bar-fill"
              :style="{ width: (store.playerStats.hp / store.playerStats.maxHp * 100) + '%' }"
              :class="{ 'low-hp': store.playerStats.hp <= 30 }"
            ></div>
          </div>
        </div>

        <!-- Skill Buttons -->
        <div class="skill-buttons">
          <!-- Primary Skill (Q) -->
          <div class="skill-btn" :class="{ ready: primaryReady }">
            <span class="skill-key-badge key-q">Q</span>
            <span class="skill-btn-name">{{ skills[0]?.name }}</span>
            <div class="cd-bar-bg">
              <div
                class="cd-bar-fill"
                :style="{ width: ((store.playerStats.primaryCDReadyRatio ?? 1) * 100) + '%' }"
              ></div>
            </div>
            <span class="cd-time" :class="{ 'ready-text': primaryReady }">
              {{ primaryReady ? 'READY' : primaryRemaining + 's' }}
            </span>
          </div>

          <!-- Secondary Skill (E or Passive) -->
          <div class="skill-btn" :class="{ ready: secondaryReady, 'is-passive': skills[1]?.passive }">
            <span class="skill-key-badge" :class="skills[1]?.passive ? 'key-passive' : 'key-e'">
              {{ skills[1]?.key }}
            </span>
            <span class="skill-btn-name">{{ skills[1]?.name }}</span>
            <div class="cd-bar-bg">
              <div
                class="cd-bar-fill passive-fill"
                :style="{ width: ((store.playerStats.secondaryCDReadyRatio ?? 1) * 100) + '%' }"
              ></div>
            </div>
            <span class="cd-time" :class="{ 'ready-text': secondaryReady && !skills[1]?.passive, 'passive-ready': secondaryReady && skills[1]?.passive }">
              {{ secondaryReady ? (skills[1]?.passive ? 'AUTO' : 'READY') : secondaryRemaining + 's' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, computed } from 'vue';
import Phaser from 'phaser';
import GameScene from '../game/scenes/GameScene';
import { store } from '../store';

let game = null;

const CLASS_SKILLS = {
  Gunner:  [
    { key: 'Q', name: 'Mưa Đạn',    passive: false },
    { key: 'Passive', name: 'Adrenaline', passive: true }
  ],
  Tank:    [
    { key: 'Q', name: 'Khiên Thép',  passive: false },
    { key: 'E', name: 'Khiêu Chiến', passive: false }
  ],
  Medic:   [
    { key: 'Q', name: 'Cứu Thương',  passive: false },
    { key: 'Passive', name: 'Khử Rung Tim', passive: true }
  ],
  Trapper: [
    { key: 'Q', name: 'Bãi Mìn',    passive: false },
    { key: 'E', name: 'Bẫy Băng',   passive: false }
  ]
};

const skills = computed(() => CLASS_SKILLS[store.playerStats.class] ?? CLASS_SKILLS.Gunner);

const primaryReady    = computed(() => (store.playerStats.primaryCDReadyRatio  ?? 1) >= 1);
const secondaryReady  = computed(() => (store.playerStats.secondaryCDReadyRatio ?? 1) >= 1);

const primaryRemaining = computed(() => {
  const ratio = store.playerStats.primaryCDReadyRatio ?? 1;
  const cd    = store.playerStats.primaryCooldownMs   ?? 0;
  return Math.max(0, (cd * (1 - ratio) / 1000)).toFixed(1);
});
const secondaryRemaining = computed(() => {
  const ratio = store.playerStats.secondaryCDReadyRatio ?? 1;
  const cd    = store.playerStats.secondaryCooldownMs   ?? 0;
  return Math.max(0, (cd * (1 - ratio) / 1000)).toFixed(1);
});

onMounted(() => {
  const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'phaser-container',
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: [GameScene]
  };
  game = new Phaser.Game(config);
});

onUnmounted(() => {
  if (game) { game.destroy(true); game = null; }
});
</script>

<style scoped>
.game-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

#phaser-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
:deep(canvas) {
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.8);
}

.hud-overlay {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 24px 30px;
  box-sizing: border-box;
}

.hud-bottom {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: fit-content;
}

/* ── Health Bar ── */
.health-bar-container { width: 300px; }

.hp-text {
  color: white;
  font-family: 'Inter', sans-serif;
  font-weight: bold;
  font-size: 15px;
  margin-bottom: 5px;
  text-shadow: 1px 1px 2px black;
}

.health-bar-bg {
  width: 100%;
  height: 18px;
  background-color: rgba(0, 0, 0, 0.6);
  border: 1px solid #444;
  border-radius: 3px;
  overflow: hidden;
}

.health-bar-fill {
  height: 100%;
  background-color: #4CAF50;
  transition: width 0.25s ease, background-color 0.3s ease;
}

.health-bar-fill.low-hp {
  background-color: #f44336;
  animation: pulse 0.8s infinite;
}

@keyframes pulse {
  0%,100% { opacity: 1; }
  50%      { opacity: 0.6; }
}

/* ── Skill Buttons ── */
.skill-buttons {
  display: flex;
  gap: 8px;
}

.skill-btn {
  width: 126px;
  background: rgba(0, 0, 0, 0.72);
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  padding: 8px 10px 6px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.skill-btn.ready {
  border-color: #d32f2f;
  box-shadow: 0 0 8px rgba(211, 47, 47, 0.35);
}

.skill-btn.is-passive.ready {
  border-color: #555;
  box-shadow: none;
}

.skill-key-badge {
  align-self: flex-start;
  font-size: 10px;
  font-weight: bold;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  border-radius: 2px;
  font-family: 'Inter', monospace;
}
.key-q       { background: #b71c1c; color: #fff; }
.key-e       { background: #bf360c; color: #fff; }
.key-passive { background: #2a2a2a; color: #888; border: 1px solid #555; }

.skill-btn-name {
  font-size: 12px;
  font-weight: 600;
  color: #d0d0d0;
  font-family: 'Inter', sans-serif;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cd-bar-bg {
  height: 4px;
  background: #1a1a1a;
  border-radius: 2px;
  overflow: hidden;
}

.cd-bar-fill {
  height: 100%;
  background: #d32f2f;
  transition: width 0.12s linear;
  border-radius: 2px;
}

.passive-fill { background: #555; }

.cd-time {
  font-size: 11px;
  color: #777;
  font-family: 'Inter', monospace;
  text-align: right;
}

.cd-time.ready-text   { color: #ef5350; font-weight: bold; }
.cd-time.passive-ready { color: #666; }
</style>
