// Backend chuyển từ Railway (hết credit) → Render free. URL theo name trong render.yaml.
// Nếu Render cấp URL khác, đổi chuỗi fallback này (hoặc set VITE_API_URL trên Vercel).
export const API_URL = import.meta.env.VITE_API_URL || 'https://zombie-coop-server.onrender.com';
