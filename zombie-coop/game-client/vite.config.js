import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// API URL được đọc qua import.meta.env.VITE_API_URL trong src/config.js
export default defineConfig({
  plugins: [vue()],
  server: { port: 3000 },
  build: {
    rollupOptions: {
      output: {
        // Tách Phaser ra chunk riêng để cache tốt hơn giữa các lần deploy
        manualChunks: { phaser: ['phaser'] }
      }
    }
  }
});
