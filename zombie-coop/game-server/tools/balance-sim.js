#!/usr/bin/env node
/* ============================================================================
 * balance-sim.js — Công cụ đo cân bằng 4 class (tiền đề: TTK lệch ≤ ~20%).
 *
 * KHÔNG đụng game. Là mô hình first-order để TRANH LUẬN BẰNG SỐ thay vì cảm
 * giác (game không có test suite). Chạy:  node tools/balance-sim.js
 *
 * Hai cột quan trọng:
 *   clearDPS_now   — sức dọn quái với KIT HIỆN TẠI (P1b-1, mọi class còn bắn súng)
 *   clearDPS_proj  — khi các mechanic P1b-2/3/4 đã land (Melee chém-cleave+hút máu,
 *                    Scientist debuff Suy Nhược, Engineer turret). Đây là cột để
 *                    tune cho spread ≤20%; cột _now sẽ còn lệch tới khi mechanic xong.
 *
 * ĐÂY LÀ NGUỒN SỰ THẬT cho số liệu cân bằng — khi đổi stat ở PlayerClasses.js
 * nhớ mirror vào bảng STATS bên dưới (và ngược lại).
 * ========================================================================== */

// --- Giả định mô hình (dễ chỉnh) ---------------------------------------------
const AVG_AOE_TARGETS = 2;   // số quái trung bình một đòn AoE/cleave trúng (thực tế, không phải lúc nào cũng xếp hàng)
const CRIT_MULT       = 2;   // chí mạng nhân đôi sát thương

// --- Kịch bản dọn 1 đợt chuẩn (mix lẻ + cụm) ---------------------------------
const WAVE = { walker: 18, runner: 6, brute: 1 };           // số lượng
const ZHP  = { walker: 30, runner: 20, brute: 200 };         // khớp HP_TABLE server
const WAVE_TOTAL_HP = Object.entries(WAVE).reduce((s, [t, n]) => s + n * ZHP[t], 0);

// --- BẢNG STAT 4 CLASS (P1b-1 đề xuất) ---------------------------------------
// auto* = bắn súng thường; cleave/debuff/turret = mechanic theo bản sắc (proj).
const STATS = {
  ranged: {
    label: 'Ranged', hp: 85, speed: 200, dmg: 20, fireRate: 165, crit: 0.15,
    skills: [{ name: 'Lựu Đạn Cụm', dmg: 60, cd: 14000, aoe: true }], // R
  },
  melee: {
    label: 'Melee', hp: 160, speed: 155, dmg: 22, fireRate: 200, crit: 0,
    skills: [{ name: 'Giậm Đất', dmg: 35, cd: 16000, aoe: true }],   // R
    // proj: bỏ súng → chém vòng cung
    cleave: { dmg: 52, rate: 500, targets: AVG_AOE_TARGETS, uptime: 0.7 }, lifesteal: 0.25,
  },
  scientist: {
    label: 'Scientist', hp: 95, speed: 215, dmg: 18, fireRate: 160, crit: 0,
    skills: [], // Q hồi máu / R team stim: không gây dmg trực tiếp
    // proj: Vùng Suy Nhược (E) → +vuln% lên quái bị dính (uptime hữu hiệu) + độc DoT
    debuff: { vuln: 0.40, uptime: 0.7 },
    poison: { dps: 5, dur: 5000, cd: 14000, targets: AVG_AOE_TARGETS },
  },
  engineer: {
    label: 'Engineer', hp: 95, speed: 210, dmg: 16, fireRate: 150, crit: 0,
    skills: [],                // Q→Súng Máy, R→Tháp K.Đại: không gây dmg trực tiếp
    minePassiveDPS: 5,         // Đinh Tán (auto-mìn khi di chuyển), amortized
    turretDPS: 30,             // proj: Dựng Súng Máy (1 turret ~uptime, 18dmg/0.6s)
    pylon: { fr: 0.30, uptime: 0.53 }, // proj: Tháp Khuếch Đại tự buff tốc bắn (8s/15s cd)
  },
};

// --- Mô hình DPS -------------------------------------------------------------
const autoDPS = (s) => s.dmg / (s.fireRate / 1000) * (1 + s.crit * (CRIT_MULT - 1));

function skillDPS(s) {
  return (s.skills || []).reduce((sum, sk) => {
    const targets = sk.aoe ? AVG_AOE_TARGETS : 1;
    const count = sk.count || 1;
    return sum + (sk.dmg * targets * count) / (sk.cd / 1000);
  }, 0);
}

function clearDPS(key, projected) {
  const s = STATS[key];
  let base;
  if (projected && s.cleave) {
    // Melee proj: chém cleave thay súng
    base = s.cleave.dmg * s.cleave.targets / (s.cleave.rate / 1000) * s.cleave.uptime;
  } else {
    base = autoDPS(s);
    if (projected && s.debuff) base *= (1 + s.debuff.vuln * s.debuff.uptime); // Scientist proj
    if (projected && s.pylon)  base *= (1 + s.pylon.fr * s.pylon.uptime);      // Engineer proj
  }
  let dps = base + skillDPS(s) + (s.minePassiveDPS || 0);
  if (projected && s.poison) {
    const p = s.poison; // độc DoT amortized theo cooldown E
    dps += (p.dps * (p.dur / 1000) * p.targets) / (p.cd / 1000);
  }
  if (projected && s.turretDPS) dps += s.turretDPS; // Engineer proj
  return dps;
}

// eHP thô: HP + bù sống sót định tính (chỉ để THAM CHIẾU trục risk, không vào TTK)
function effHP(key) {
  const s = STATS[key];
  let m = 1;
  if (key === 'melee') m = 1.6;     // block đòn-thứ-5 + Khiên Thép + hút máu
  if (key === 'scientist') m = 1.2; // Hào Quang hồi + Auto-Defib
  return Math.round(s.hp * m);
}

// --- In bảng -----------------------------------------------------------------
function row(key) {
  const s = STATS[key];
  const now = clearDPS(key, false), proj = clearDPS(key, true);
  return {
    Class: s.label, HP: s.hp, eHP: effHP(key), Spd: s.speed,
    'auto': Math.round(autoDPS(s)),
    'clearDPS_now': Math.round(now),
    'clearDPS_proj': Math.round(proj),
    'TTK_proj(s)': +(WAVE_TOTAL_HP / proj).toFixed(1),
  };
}

function spread(vals) {
  const min = Math.min(...vals), max = Math.max(...vals), avg = vals.reduce((a, b) => a + b) / vals.length;
  return { min, max, avg: +avg.toFixed(1), spreadPct: +(((max - min) / avg) * 100).toFixed(1) };
}

const keys = Object.keys(STATS);
const rows = keys.map(row);
console.table(rows);

console.log(`\nWave chuẩn: ${JSON.stringify(WAVE)}  → tổng HP = ${WAVE_TOTAL_HP}`);
const sNow  = spread(rows.map(r => r['clearDPS_now']));
const sProj = spread(rows.map(r => r['clearDPS_proj']));
console.log(`clearDPS_now :  avg ${sNow.avg}  spread ${sNow.spreadPct}%  (kỳ vọng còn lệch tới khi mechanic land)`);
console.log(`clearDPS_proj:  avg ${sProj.avg}  spread ${sProj.spreadPct}%  ${sProj.spreadPct <= 20 ? '✅ ≤20% — đạt tiền đề' : '❌ >20% — cần tune'}`);
