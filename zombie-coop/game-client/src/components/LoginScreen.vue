<template>
  <div class="hud-screen login-screen">
    <div class="login-card hud-frame">
      <div class="hazard-bar"></div>
      <div class="hud-corners"></div>

      <div class="card-body">
        <div class="brand">
          <div class="brand-glyph">☣</div>
          <h1>DEAD <span class="accent">ZONE</span></h1>
          <p class="brand-sub">TỬ KHU // CO-OP SURVIVAL</p>
          <div class="sys-status">
            <span class="hud-dot"></span>
            <span class="hud-tag">MÁY CHỦ &mdash; TRỰC TUYẾN</span>
          </div>
        </div>

        <div class="tabs">
          <div class="tab" :class="{ active: isLogin }" @click="isLogin = true">ĐĂNG NHẬP</div>
          <div class="tab" :class="{ active: !isLogin }" @click="isLogin = false">ĐĂNG KÝ</div>
        </div>

        <div class="form">
          <div class="input-group">
            <label>TÊN NGƯỜI DÙNG</label>
            <input type="text" v-model="nickname" placeholder="Nhập tên hiệu..." @keyup.enter="handleSubmit" />
          </div>
          <div class="input-group">
            <label>MẬT KHẨU</label>
            <input type="password" v-model="password" placeholder="••••••••" @keyup.enter="handleSubmit" />
          </div>
          <div class="input-group" v-if="!isLogin">
            <label>XÁC NHẬN MẬT KHẨU</label>
            <input type="password" v-model="confirmPassword" placeholder="••••••••" @keyup.enter="handleSubmit" />
          </div>

          <div v-if="errorMessage" class="error-msg">
            ⚠️ {{ errorMessage }}
          </div>
          <div v-if="successMessage" class="success-msg">
            ✅ {{ successMessage }}
          </div>

          <button class="btn-primary" @click="handleSubmit" :disabled="isLoading">
            <span v-if="isLoading" class="spinner"></span>
            <span v-else>{{ isLogin ? '▶  KẾT NỐI MÁY CHỦ' : '＋  TẠO TÀI KHOẢN' }}</span>
          </button>
        </div>
      </div>

      <div class="card-foot">
        <span class="hud-tag">PROTOCOL: SURVIVAL</span>
        <span class="hud-tag">BUILD v1.0</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import axios from 'axios';
import { store } from '../store.js';
import { API_URL as BASE_URL } from '../config.js';

const isLogin = ref(true);
const nickname = ref('');
const password = ref('');
const confirmPassword = ref('');
const isLoading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

const API_URL = BASE_URL + '/api/auth';

const handleSubmit = async () => {
  errorMessage.value = '';
  successMessage.value = '';

  if (!nickname.value || !password.value) {
    errorMessage.value = 'Vui lòng điền đầy đủ thông tin';
    return;
  }

  if (!isLogin.value && password.value !== confirmPassword.value) {
    errorMessage.value = 'Mật khẩu xác nhận không khớp';
    return;
  }

  isLoading.value = true;

  try {
    const endpoint = isLogin.value ? '/login' : '/register';
    const response = await axios.post(`${API_URL}${endpoint}`, {
      nickname: nickname.value,
      password: password.value
    });

    if (response.data.user) {
      if (!isLogin.value) {
        successMessage.value = 'Đăng ký thành công! Đang đăng nhập...';
        setTimeout(() => {
          store.playerStats.nickname = response.data.user.nickname;
          store.playerStats.kills = response.data.user.stats.totalKills;
          store.playerStats.waves = response.data.user.stats.bestWave;
          store.setScreen('lobby');
        }, 1000);
      } else {
        store.playerStats.nickname = response.data.user.nickname;
        store.playerStats.kills = response.data.user.stats.totalKills;
        store.playerStats.waves = response.data.user.stats.bestWave;
        store.setScreen('lobby');
      }
    }
  } catch (error) {
    errorMessage.value = error.response?.data?.error || 'Không thể kết nối đến Server';
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.login-screen {
  display: flex;
  justify-content: center;
  align-items: center;
}

.login-card {
  width: 420px;
  background: var(--hud-panel);
  backdrop-filter: blur(10px);
  border: 1px solid var(--hud-line);
  border-radius: var(--hud-radius);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.6);
  overflow: hidden;
}

.card-body { padding: 34px 40px 28px; }

/* hazard bar nằm sát mép trên card */
.login-card .hazard-bar { margin: 0 0 0 0; }

.brand { text-align: center; margin-bottom: 26px; }
.brand-glyph {
  font-size: 34px;
  color: var(--hud-amber);
  line-height: 1;
  margin-bottom: 6px;
  filter: drop-shadow(0 0 10px rgba(245, 166, 35, 0.4));
}
.brand h1 {
  font-family: var(--font-display);
  font-size: 44px;
  margin: 0;
  letter-spacing: 3px;
  color: #f2f2f2;
  text-shadow: 0 2px 0 #000, 0 0 24px rgba(193, 18, 31, 0.35);
}
.accent { color: var(--hud-blood-2); }
.brand-sub {
  font-family: var(--font-head);
  color: var(--hud-ink-dim);
  margin: 8px 0 0 0;
  letter-spacing: 4px;
  font-size: 12px;
  text-transform: uppercase;
}
.sys-status {
  display: inline-flex; align-items: center; gap: 8px;
  margin-top: 14px;
  padding: 4px 12px;
  border: 1px solid var(--hud-line);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.3);
}

.tabs { display: flex; margin-bottom: 22px; border-bottom: 1px solid var(--hud-line); }
.tab {
  flex: 1; text-align: center; padding: 11px;
  color: var(--hud-ink-dim); cursor: pointer;
  font-family: var(--font-head); font-weight: 600;
  letter-spacing: 2px; transition: all 0.2s;
}
.tab:hover { color: #ccc; }
.tab.active {
  color: var(--hud-blood-2);
  border-bottom: 2px solid var(--hud-blood-2);
  text-shadow: 0 0 12px rgba(239, 59, 59, 0.4);
}

.form { display: flex; flex-direction: column; gap: 15px; }
.input-group { display: flex; flex-direction: column; gap: 7px; }
.input-group label {
  font-family: var(--font-head);
  font-size: 11px; color: var(--hud-ink-dim);
  letter-spacing: 2px; font-weight: 600;
}
.input-group input {
  background-color: #0c0d10;
  border: 1px solid var(--hud-line);
  border-left: 2px solid var(--hud-line-2);
  color: white;
  padding: 12px 14px;
  border-radius: var(--hud-radius);
  font-size: 15px;
  font-family: var(--font-body);
  transition: all 0.2s;
}
.input-group input::placeholder { color: #4f535b; }
.input-group input:focus {
  outline: none;
  border-color: var(--hud-amber);
  border-left-color: var(--hud-amber);
  background-color: #111;
  box-shadow: 0 0 0 1px var(--hud-amber-dim), 0 0 14px rgba(245, 166, 35, 0.12);
}

.error-msg {
  color: #ff6b6b;
  background-color: var(--hud-blood-dim);
  border: 1px solid var(--hud-blood);
  border-left: 3px solid var(--hud-blood-2);
  padding: 10px; border-radius: var(--hud-radius);
  font-size: 13px; text-align: left;
}
.success-msg {
  color: #6bdc8c;
  background-color: rgba(70, 200, 122, 0.1);
  border: 1px solid var(--hud-ok);
  border-left: 3px solid var(--hud-ok);
  padding: 10px; border-radius: var(--hud-radius);
  font-size: 13px; text-align: left;
}

.btn-primary {
  margin-top: 8px;
  background: linear-gradient(180deg, var(--hud-blood-2), var(--hud-blood));
  color: white; border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.25);
  padding: 15px; border-radius: var(--hud-radius);
  font-family: var(--font-head);
  font-size: 16px; font-weight: 700; letter-spacing: 2px;
  cursor: pointer; transition: all 0.2s;
  display: flex; justify-content: center; align-items: center;
  height: 52px;
}
.btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
  box-shadow: 0 0 22px rgba(239, 59, 59, 0.45);
}
.btn-primary:active:not(:disabled) { transform: translateY(1px); }
.btn-primary:disabled { background: #3a3a3a; color: #777; cursor: not-allowed; }

.card-foot {
  display: flex; justify-content: space-between;
  padding: 12px 40px;
  border-top: 1px solid var(--hud-line);
  background: var(--hud-panel-2);
}

.spinner {
  width: 20px; height: 20px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: white; border-radius: 50%;
  animation: hud-spin 1s linear infinite;
}
</style>
