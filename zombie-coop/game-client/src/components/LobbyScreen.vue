<template>
  <div class="hud-screen lobby-screen">
    <!-- HEADER: dogtag người chơi -->
    <div class="header">
      <div class="dogtag" :class="'cls-' + (selectedClass?.id || 'ranged')">
        <div class="dt-avatar">{{ selectedClass?.icon || '🔫' }}</div>
        <div class="dt-info">
          <h3>{{ store.playerStats.nickname }}</h3>
          <div class="dt-meta">
            <span class="hud-tag">SỐNG SÓT · CẤP {{ store.playerStats.waves || 0 }}</span>
            <span class="dt-stat">☠ {{ store.playerStats.kills || 0 }}</span>
            <span class="dt-stat">🌊 {{ store.playerStats.waves || 0 }}</span>
          </div>
        </div>
      </div>
      <div class="header-right">
        <span class="brand-mini">DEAD <span class="accent">ZONE</span></span>
        <button class="btn-outline" @click="store.setScreen('login')">ĐĂNG XUẤT</button>
      </div>
    </div>

    <div class="content">
      <!-- CLASS SELECTION -->
      <div class="panel class-panel hud-frame">
        <div class="hud-corners"></div>
        <h2 class="panel-title">◢ CHỌN NGHỀ</h2>
        <div class="class-grid">
          <div
            v-for="c in classes"
            :key="c.id"
            class="class-card"
            :class="['cls-' + c.id, { active: store.playerStats.class === c.name }]"
            @click="store.playerStats.class = c.name"
          >
            <div class="class-icon">{{ c.icon }}</div>
            <h4>{{ c.name }}</h4>
            <p>{{ c.desc }}</p>
          </div>
        </div>

        <!-- Class Detail Panel -->
        <div class="class-detail" v-if="selectedClass" :class="'cls-' + selectedClass.id">
          <div class="detail-header">
            <span class="role-badge">{{ selectedClass.role }}</span>
            <span class="class-name-lg">{{ selectedClass.icon }} {{ selectedClass.name }}</span>
          </div>
          <div class="stat-bars">
            <div class="stat-row">
              <span class="stat-label">HP</span>
              <div class="stat-bar-bg">
                <div class="stat-bar-fill hp" :style="{ width: (selectedClass.stats.hp / 150 * 100) + '%' }"></div>
              </div>
              <span class="stat-val">{{ selectedClass.stats.hp }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Speed</span>
              <div class="stat-bar-bg">
                <div class="stat-bar-fill speed" :style="{ width: (selectedClass.stats.speed / 230 * 100) + '%' }"></div>
              </div>
              <span class="stat-val">{{ selectedClass.stats.speed }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">DMG</span>
              <div class="stat-bar-bg">
                <div class="stat-bar-fill dmg" :style="{ width: (selectedClass.stats.dmg / 35 * 100) + '%' }"></div>
              </div>
              <span class="stat-val">{{ selectedClass.stats.dmg }}</span>
            </div>
          </div>
          <div class="skill-list">
            <div class="skill-row" v-for="skill in selectedClass.skills" :key="skill.key + skill.name">
              <span class="skill-key" :class="'key-' + skill.key.toLowerCase()">{{ skill.key }}</span>
              <div class="skill-info">
                <span class="skill-name">{{ skill.name }}</span>
                <span class="skill-desc">{{ skill.desc }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- PUBLIC ROOMS -->
      <div class="panel room-panel hud-frame">
        <div class="hud-corners"></div>
        <div class="panel-header">
          <h2 class="panel-title">◢ BẢNG NHIỆM VỤ</h2>
          <button class="btn-create" @click="createRoom">＋ TẠO PHÒNG</button>
        </div>

        <div class="diff-pick">
          <span class="hud-tag">ĐỘ KHÓ</span>
          <div class="diff-seg">
            <button
              v-for="d in difficulties"
              :key="d.id"
              class="diff-btn"
              :class="[d.id, { active: selectedDifficulty === d.id }]"
              @click="selectedDifficulty = d.id"
            >{{ d.label }}</button>
          </div>
        </div>

        <div class="room-list">
          <div v-if="store.publicRooms.length === 0" class="room-empty">
            <div class="empty-glyph">☣</div>
            <p>KHÔNG CÓ ĐIỂM TẬP KẾT NÀO ĐANG MỞ</p>
            <span>Hãy tạo phòng mới để bắt đầu chiến dịch.</span>
          </div>
          <div v-for="room in store.publicRooms" :key="room.id" class="room-row">
            <div class="room-info">
              <h4>PHÒNG #{{ room.id }} <span class="host-badge">CHỦ: {{ room.name }}</span></h4>
              <p>Wave {{ room.wave }} · <span class="diff-chip" :class="(room.difficulty || 'normal').toLowerCase()">{{ difficultyVi(room.difficulty) }}</span></p>
            </div>
            <div class="room-status">
              <div class="pips">
                <span class="pip" v-for="n in (room.maxPlayers || 4)" :key="n" :class="{ filled: n <= room.players.length }"></span>
              </div>
              <button
                class="btn-join"
                :disabled="room.players.length >= room.maxPlayers || store.joinRequestStatus === 'pending'"
                @click="requestJoin(room.id)"
              >
                {{ store.joinRequestStatus === 'pending' && selectedRoom === room.id ? 'ĐANG YÊU CẦU...' : 'THAM GIA' }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="store.joinRequestStatus === 'pending'" class="status-box">
          <span class="spinner"></span> Đang chờ chủ phòng duyệt...
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { store } from '../store.js';

const DIFFICULTY_VI = { EASY: 'DỄ', NORMAL: 'BÌNH THƯỜNG', HARD: 'KHÓ' };
const difficultyVi = (d) => DIFFICULTY_VI[(d ?? '').toUpperCase()] ?? (d ?? '').toUpperCase();

const difficulties = [
  { id: 'easy', label: 'DỄ' },
  { id: 'normal', label: 'BÌNH THƯỜNG' },
  { id: 'hard', label: 'KHÓ' }
];

const classes = [
  {
    id: 'ranged', name: 'Ranged', icon: '🔫',
    desc: 'Sát thương cao, bắn nhanh', role: 'Tầm xa',
    stats: { hp: 80, speed: 210, dmg: 35 },
    skills: [
      { key: 'Q', name: 'Mưa Đạn', desc: 'Xuyên giáp, tốc độ đạn ×2 trong 3 giây' },
      { key: 'Passive', name: 'Adrenaline', desc: 'HP < 30% → tự động tăng 40% tốc bắn' },
      { key: 'R', name: 'Lựu Đạn Cụm', desc: 'Ném lựu đạn nổ AoE, 60 sát thương cả cụm zombie' }
    ]
  },
  {
    id: 'melee', name: 'Melee', icon: '🛡️',
    desc: 'Máu trâu, giáp dày', role: 'Cận chiến',
    stats: { hp: 150, speed: 150, dmg: 20 },
    skills: [
      { key: 'Q', name: 'Khiên Thép', desc: 'Giảm 60% sát thương nhận trong 5 giây' },
      { key: 'E', name: 'Khiêu Chiến', desc: 'Kéo zombie tập trung vào mình trong 8 giây' },
      { key: 'R', name: 'Giậm Đất', desc: 'Giậm đất gây 35 sát thương + làm chậm zombie quanh mình 2s' },
      { key: 'Passive', name: 'Chặn Đòn', desc: 'Chặn hoàn toàn mỗi đòn thứ 5' }
    ]
  },
  {
    id: 'scientist', name: 'Scientist', icon: '💉',
    desc: 'Hồi máu cho đồng đội', role: 'Tăng/Giảm ích',
    stats: { hp: 90, speed: 230, dmg: 15 },
    skills: [
      { key: 'Q', name: 'Cứu Thương', desc: 'Hồi 30 HP cho bản thân và đồng đội xung quanh' },
      { key: 'Passive', name: 'Khử Rung Tim', desc: 'HP < 10% → tự hồi 30 HP (CD: 30s)' },
      { key: 'R', name: 'Liều Kích Thích', desc: 'Buff cả đội +40% tốc bắn, +20% tốc chạy trong 6s' }
    ]
  },
  {
    id: 'engineer', name: 'Engineer', icon: '🪤',
    desc: 'Đặt mìn, kiểm soát đám đông', role: 'Công trình',
    stats: { hp: 85, speed: 230, dmg: 15 },
    skills: [
      { key: 'Q', name: 'Bãi Mìn', desc: 'Đặt 5 mìn AoE gây sát thương vùng' },
      { key: 'E', name: 'Bẫy Băng', desc: 'Đặt 1 mìn đóng băng zombie trong 3 giây' },
      { key: 'R', name: 'Súng Lưới', desc: 'Bắn lưới đóng băng zombie trong vùng 3s + 20 sát thương' }
    ]
  }
];

const selectedClass = computed(() =>
  classes.find(c => c.name === store.playerStats.class) ?? classes[0]
);

const selectedRoom = ref('');
const selectedDifficulty = ref('normal');

const createRoom = () => {
  store.playerStats.roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  store.playerStats.difficulty = selectedDifficulty.value;

  store.socket.emit('create_room', {
    code: store.playerStats.roomCode,
    hostName: store.playerStats.nickname,
    difficulty: selectedDifficulty.value,
    class: store.playerStats.class
  });

  store.setScreen('room_waiting');
};

const requestJoin = (roomId) => {
  selectedRoom.value = roomId;
  store.joinRequestStatus = 'pending';
  store.playerStats.roomCode = roomId;

  store.socket.emit('join_room', {
    code: roomId,
    nickname: store.playerStats.nickname,
    class: store.playerStats.class
  });

  store.setScreen('room_waiting');
};
</script>

<style scoped>
.lobby-screen {
  display: flex;
  flex-direction: column;
  padding: 32px 72px;
}

/* per-class accent */
.cls-ranged    { --cls: var(--cls-ranged); }
.cls-melee     { --cls: var(--cls-melee); }
.cls-scientist { --cls: var(--cls-scientist); }
.cls-engineer  { --cls: var(--cls-engineer); }

/* ---------- HEADER ---------- */
.header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 26px; padding-bottom: 18px;
  border-bottom: 1px solid var(--hud-line);
}
.dogtag { display: flex; align-items: center; gap: 14px; }
.dt-avatar {
  width: 52px; height: 52px;
  display: flex; align-items: center; justify-content: center;
  font-size: 26px;
  background: #111; border: 2px solid var(--cls, var(--hud-blood));
  border-radius: var(--hud-radius);
  box-shadow: 0 0 16px color-mix(in srgb, var(--cls, var(--hud-blood)) 35%, transparent);
}
.dt-info h3 {
  margin: 0 0 5px 0; font-size: 20px; color: #fff;
  font-family: var(--font-head); letter-spacing: 0.5px;
  max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dt-meta { display: flex; align-items: center; gap: 12px; }
.dt-stat { font-size: 12px; color: var(--hud-ink-dim); }

.header-right { display: flex; align-items: center; gap: 18px; }
.brand-mini {
  font-family: var(--font-display);
  font-size: 18px; letter-spacing: 2px; color: #cfcfcf;
}
.brand-mini .accent { color: var(--hud-blood-2); }
.btn-outline {
  background: transparent; border: 1px solid var(--hud-line-2);
  color: #aaa; padding: 8px 18px; border-radius: var(--hud-radius);
  cursor: pointer; transition: all 0.2s;
  font-family: var(--font-head); letter-spacing: 1px; font-size: 13px;
}
.btn-outline:hover { background: #1c1c1f; color: white; border-color: var(--hud-blood); }

/* ---------- CONTENT ---------- */
.content { display: flex; gap: 28px; flex: 1; min-height: 0; }

.panel {
  background: var(--hud-panel);
  border: 1px solid var(--hud-line);
  border-radius: var(--hud-radius);
  padding: 22px 24px;
  display: flex; flex-direction: column;
  position: relative;
}
.class-panel { flex: 1; }
.room-panel { flex: 1; }

.panel-title {
  font-family: var(--font-head);
  font-size: 16px; color: var(--hud-amber);
  letter-spacing: 3px; margin: 0 0 18px 0;
}

/* ---------- CLASS GRID ---------- */
.class-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.class-card {
  --cls: var(--hud-blood);
  background: #131417;
  border: 1px solid var(--hud-line);
  border-top: 2px solid var(--hud-line-2);
  border-radius: var(--hud-radius);
  padding: 16px; cursor: pointer; transition: all 0.18s; text-align: center;
}
.class-card:hover { border-color: var(--cls); transform: translateY(-2px); }
.class-card.active {
  border-color: var(--cls); border-top-color: var(--cls);
  background: color-mix(in srgb, var(--cls) 12%, #131417);
  box-shadow: 0 0 18px color-mix(in srgb, var(--cls) 28%, transparent);
}
.class-icon { font-size: 30px; margin-bottom: 8px; }
.class-card h4 {
  margin: 0 0 4px 0; color: #fff;
  font-family: var(--font-head); letter-spacing: 1px;
}
.class-card p { margin: 0; font-size: 12px; color: var(--hud-ink-dim); }

/* ---------- CLASS DETAIL ---------- */
.class-detail {
  --cls: var(--hud-blood);
  margin-top: 14px;
  background: color-mix(in srgb, var(--cls) 6%, #0e0f12);
  border: 1px solid var(--hud-line);
  border-left: 3px solid var(--cls);
  border-radius: var(--hud-radius); padding: 16px;
}
.detail-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.role-badge {
  font-size: 11px; font-weight: bold; letter-spacing: 1px;
  font-family: var(--font-head);
  padding: 3px 8px; border-radius: 3px;
  background: color-mix(in srgb, var(--cls) 20%, transparent);
  border: 1px solid var(--cls); color: var(--cls);
}
.class-name-lg { font-size: 16px; font-weight: bold; color: #fff; font-family: var(--font-head); letter-spacing: 1px; }

.stat-bars { display: flex; flex-direction: column; gap: 7px; margin-bottom: 14px; }
.stat-row { display: flex; align-items: center; gap: 8px; }
.stat-label { width: 42px; font-size: 11px; color: var(--hud-ink-dim); letter-spacing: 1px; text-transform: uppercase; }
.stat-bar-bg { flex: 1; height: 6px; background: #1c1d21; border-radius: 3px; overflow: hidden; }
.stat-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s ease; }
.stat-bar-fill.hp    { background: #d32f2f; }
.stat-bar-fill.speed { background: #1565c0; }
.stat-bar-fill.dmg   { background: #e65100; }
.stat-val { width: 28px; font-size: 12px; color: #aaa; text-align: right; }

.skill-list { display: flex; flex-direction: column; gap: 8px; }
.skill-row { display: flex; align-items: flex-start; gap: 10px; }
.skill-key {
  min-width: 48px; font-size: 10px; font-weight: bold; letter-spacing: 0.5px;
  font-family: var(--font-head);
  padding: 3px 6px; border-radius: 3px; text-align: center;
}
.skill-key.key-q       { background: #d32f2f; color: #fff; }
.skill-key.key-e       { background: #bf360c; color: #fff; }
.skill-key.key-r       { background: #6a1b9a; color: #fff; }
.skill-key.key-passive { background: #2a2a2e; color: #aaa; border: 1px solid var(--hud-line-2); }
.skill-info { display: flex; flex-direction: column; gap: 2px; }
.skill-name { font-size: 13px; font-weight: bold; color: var(--hud-ink); }
.skill-desc { font-size: 11px; color: #777; line-height: 1.4; }

/* ---------- ROOM PANEL ---------- */
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.btn-create {
  background: linear-gradient(180deg, var(--hud-amber-2), var(--hud-amber));
  color: #1a1407; border: none;
  padding: 9px 16px; border-radius: var(--hud-radius);
  font-family: var(--font-head); font-weight: 700; letter-spacing: 1px;
  cursor: pointer; transition: all 0.2s;
}
.btn-create:hover { filter: brightness(1.08); box-shadow: 0 0 18px rgba(245, 166, 35, 0.4); }

.diff-pick { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.diff-seg { display: flex; gap: 6px; }
.diff-btn {
  background: #131417; border: 1px solid var(--hud-line);
  color: var(--hud-ink-dim); padding: 6px 12px;
  border-radius: var(--hud-radius); cursor: pointer;
  font-family: var(--font-head); font-size: 12px; letter-spacing: 1px;
  transition: all 0.15s;
}
.diff-btn:hover { color: #ccc; }
.diff-btn.active.easy   { background: rgba(70,200,122,0.16); border-color: var(--hud-ok); color: var(--hud-ok); }
.diff-btn.active.normal { background: var(--hud-amber-dim); border-color: var(--hud-amber); color: var(--hud-amber-2); }
.diff-btn.active.hard   { background: var(--hud-blood-dim); border-color: var(--hud-blood); color: var(--hud-blood-2); }

.room-list { display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
.room-empty {
  text-align: center; padding: 40px 20px; color: var(--hud-ink-faint);
  border: 1px dashed var(--hud-line-2); border-radius: var(--hud-radius);
}
.empty-glyph { font-size: 38px; color: var(--hud-amber); opacity: 0.5; margin-bottom: 10px; }
.room-empty p { margin: 0 0 6px 0; font-family: var(--font-head); letter-spacing: 1px; color: #888; }
.room-empty span { font-size: 13px; }

.room-row {
  display: flex; justify-content: space-between; align-items: center;
  background: #131417; border: 1px solid var(--hud-line);
  border-left: 3px solid var(--hud-blood);
  padding: 14px 16px; border-radius: var(--hud-radius);
  transition: all 0.15s;
}
.room-row:hover { border-left-color: var(--hud-amber); background: #16171b; }
.room-info h4 {
  margin: 0 0 6px 0; font-size: 15px; color: #fff;
  font-family: var(--font-head); letter-spacing: 1px;
  display: flex; align-items: center; gap: 10px;
}
.host-badge { font-size: 11px; background: #26282e; padding: 2px 6px; border-radius: 2px; color: #aaa; font-family: var(--font-body); letter-spacing: 0; }
.room-info p { margin: 0; font-size: 13px; color: var(--hud-ink-dim); }
.diff-chip { padding: 1px 7px; border-radius: 3px; font-size: 11px; font-weight: bold; }
.diff-chip.easy   { background: rgba(70,200,122,0.16); color: var(--hud-ok); }
.diff-chip.normal { background: var(--hud-amber-dim); color: var(--hud-amber-2); }
.diff-chip.hard   { background: var(--hud-blood-dim); color: var(--hud-blood-2); }

.room-status { display: flex; align-items: center; gap: 16px; }
.pips { display: flex; gap: 4px; }
.pip { width: 9px; height: 9px; border-radius: 2px; background: #2a2c31; border: 1px solid #34373f; }
.pip.filled { background: var(--hud-blood-2); border-color: var(--hud-blood-2); box-shadow: 0 0 6px rgba(239,59,59,0.5); }
.btn-join {
  background: #26282e; color: white; border: 1px solid var(--hud-line-2);
  padding: 8px 16px; border-radius: var(--hud-radius); cursor: pointer;
  font-family: var(--font-head); letter-spacing: 1px; font-size: 13px;
  transition: all 0.15s;
}
.btn-join:hover:not(:disabled) { background: var(--hud-blood); border-color: var(--hud-blood-2); }
.btn-join:disabled { opacity: 0.4; cursor: not-allowed; }

.status-box {
  margin-top: 16px; padding: 14px;
  background: var(--hud-amber-dim); border: 1px solid var(--hud-amber);
  color: var(--hud-amber-2); border-radius: var(--hud-radius);
  text-align: center; font-size: 14px;
  display: flex; justify-content: center; align-items: center; gap: 10px;
}
.spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(245,166,35,0.3); border-top-color: var(--hud-amber-2);
  border-radius: 50%; animation: hud-spin 1s linear infinite;
}
</style>
