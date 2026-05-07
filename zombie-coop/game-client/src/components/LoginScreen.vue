<template>
  <div class="login-screen">
    <div class="vignette"></div>
    <div class="grain"></div>
    
    <div class="login-card">
      <div class="brand">
        <h1>DEAD <span class="accent">ZONE</span></h1>
        <p>Co-op Survival</p>
      </div>
      
      <div class="tabs">
        <div class="tab" :class="{ active: isLogin }" @click="isLogin = true">LOGIN</div>
        <div class="tab" :class="{ active: !isLogin }" @click="isLogin = false">REGISTER</div>
      </div>

      <div class="form">
        <div class="input-group">
          <label>NICKNAME</label>
          <input type="text" v-model="nickname" placeholder="Enter your alias..." />
        </div>
        <div class="input-group">
          <label>PASSWORD</label>
          <input type="password" v-model="password" placeholder="••••••••" />
        </div>
        <div class="input-group" v-if="!isLogin">
          <label>CONFIRM PASSWORD</label>
          <input type="password" v-model="confirmPassword" placeholder="••••••••" />
        </div>
        
        <div v-if="errorMessage" class="error-msg">
          ⚠️ {{ errorMessage }}
        </div>
        <div v-if="successMessage" class="success-msg">
          ✅ {{ successMessage }}
        </div>

        <button class="btn-primary" @click="handleSubmit" :disabled="isLoading">
          <span v-if="isLoading" class="spinner"></span>
          <span v-else>{{ isLogin ? 'CONNECT TO SERVER' : 'CREATE ACCOUNT' }}</span>
        </button>
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
  width: 100%;
  height: 100%;
  background-color: #0f0f0f;
  display: flex;
  justify-content: center;
  align-items: center;
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

.login-card {
  background: rgba(26, 26, 26, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid #333;
  border-top: 2px solid #b71c1c;
  border-radius: 4px;
  padding: 40px;
  width: 400px;
  z-index: 10;
  box-shadow: 0 15px 35px rgba(0,0,0,0.5);
}

.brand {
  text-align: center;
  margin-bottom: 30px;
}
.brand h1 {
  font-size: 42px;
  margin: 0;
  letter-spacing: 4px;
  font-weight: 800;
}
.accent {
  color: #d32f2f;
}
.brand p {
  color: #888;
  margin: 5px 0 0 0;
  letter-spacing: 2px;
  font-size: 14px;
  text-transform: uppercase;
}

.tabs {
  display: flex;
  margin-bottom: 25px;
  border-bottom: 1px solid #333;
}
.tab {
  flex: 1;
  text-align: center;
  padding: 10px;
  color: #888;
  cursor: pointer;
  font-weight: bold;
  letter-spacing: 1px;
  transition: all 0.2s;
}
.tab:hover {
  color: #ccc;
}
.tab.active {
  color: #d32f2f;
  border-bottom: 2px solid #d32f2f;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.input-group label {
  font-size: 12px;
  color: #888;
  letter-spacing: 1px;
  font-weight: bold;
}
.input-group input {
  background-color: #111;
  border: 1px solid #333;
  color: white;
  padding: 12px 15px;
  border-radius: 4px;
  font-size: 16px;
  font-family: 'Inter', sans-serif;
  transition: all 0.3s;
}
.input-group input:focus {
  outline: none;
  border-color: #d32f2f;
  background-color: #151515;
}

.error-msg {
  color: #ff5252;
  background-color: rgba(183, 28, 28, 0.1);
  border: 1px solid #b71c1c;
  padding: 10px;
  border-radius: 4px;
  font-size: 13px;
  text-align: center;
}
.success-msg {
  color: #4caf50;
  background-color: rgba(76, 175, 80, 0.1);
  border: 1px solid #4caf50;
  padding: 10px;
  border-radius: 4px;
  font-size: 13px;
  text-align: center;
}

.btn-primary {
  margin-top: 10px;
  background-color: #b71c1c;
  color: white;
  border: none;
  padding: 15px;
  border-radius: 4px;
  font-size: 16px;
  font-weight: bold;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.3s;
  font-family: 'Inter', sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 50px;
}
.btn-primary:hover:not(:disabled) {
  background-color: #d32f2f;
  box-shadow: 0 0 15px rgba(211, 47, 47, 0.4);
}
.btn-primary:disabled {
  background-color: #555;
  cursor: not-allowed;
  opacity: 0.7;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
