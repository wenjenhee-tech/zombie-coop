// PixelArtTextures.js
// Runtime pixel-art canvas texture + Phaser animation generator.
// All sprites are 32×32 px. Frame layout per texture:
//   Players  : 16 frames  (4 dirs × 4 walk frames), dir order: down/up/left/right
//   Zombies  : 8 frames   (4 dirs × 2 walk frames), same order

// ─── constants ───────────────────────────────────────────────────────────────

const FW = 32;
const FH = 32;

// ─── canvas 2-D helpers ──────────────────────────────────────────────────────

function fr(ctx, x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
}

function fc(ctx, cx, cy, r, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function fstar(ctx, cx, cy, ro, ri, pts, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const a = (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? ro : ri;
    i === 0 ? ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
            : ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}

// ─── advanced fills (gradient shading + glow) ────────────────────────────────
// Nguồn sáng quy ước: trên-trái → highlight lệch lên-trái, đáy tối dần.

// Chữ nhật tô gradient dọc (top → bottom)
function grect(ctx, x, y, w, h, top, bot) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
}

// Tròn tô gradient xuyên tâm (sáng lệch trên-trái → tối ở rìa) → tạo khối
function gcircle(ctx, cx, cy, r, inner, outer) {
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.15, cx, cy, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

// Chạy drawFn với hiệu ứng phát sáng mềm (an toàn nhờ clip ở makeAtlas)
function glow(ctx, color, blur, drawFn) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  drawFn();
  ctx.restore();
}

// ─── walk-offset helpers ─────────────────────────────────────────────────────

// 4-frame walk → [leftLegYOff, rightLegYOff]
function wo4(f) {
  return ([[0,0],[-2,2],[0,0],[2,-2]])[f & 3];
}
// 2-frame walk
function wo2(f) { return f === 0 ? [-2, 1] : [1, -2]; }

// ─── atlas builder ────────────────────────────────────────────────────────────

function makeAtlas(scene, key, nFrames, drawFn, fw = FW, fh = FH) {
  const ct = scene.textures.createCanvas(key, fw * nFrames, fh);
  const ctx = ct.getContext('2d');
  ctx.clearRect(0, 0, fw * nFrames, fh);
  for (let i = 0; i < nFrames; i++) {
    ctx.save();
    ctx.translate(i * fw, 0);
    ctx.beginPath();
    ctx.rect(0, 0, fw, fh);
    ctx.clip(); // chặn glow/shadowBlur tràn sang ô frame bên cạnh
    drawFn(ctx, i);
    ctx.restore();
    ct.add(i, 0, i * fw, 0, fw, fh);
  }
  ct.refresh();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLAYER DRAW FUNCTIONS  (frame = dir*4 + walkFrame)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GUNNER — 48px SOUL KNIGHT (theo ảnh tham chiếu): survivor đội nón/khăn ĐỎ, kính
// phi công gác trán (lens xanh thép — chút accent), mặt lộ + 2 mắt, mặt nạ lọc khí olive
// có gân dọc che miệng, áo khoác nâu + vạt sáng dưới. Mảng màu PHẲNG, viền silhouette đậm.
const G = {
  OL:    '#15100c',                                              // viền nâu-đen
  CAP:   '#8e3b32', CAP_HI: '#b25a4a', CAP_DK: '#5e261f',        // nón/khăn đỏ
  GOG:   '#6b4a2e', GOG_DK: '#46301d',                          // gọng kính nâu
  LENS:  '#7fa6bc', LENS_HI:'#c8dee9', LENS_DK:'#3f5c6e',        // kính xanh thép (accent)
  SKIN:  '#e8c59a', SKIN_DK:'#c79f72',                          // da
  EYE:   '#241c16',
  MASK:  '#8a7a44', MASK_HI:'#a89a5e', MASK_DK:'#5d5430',        // mặt nạ lọc olive
  COAT:  '#7a4e30', COAT_HI:'#946142', COAT_DK:'#4c3020',        // áo khoác nâu
  COATL: '#b89a6e', COATL_DK:'#94774f',                         // vạt áo sáng dưới
  GLOVE: '#3c2a1c', BOOT: '#2a1d14',
  ACC:   '#8e3b32'                                              // patch đỏ vai
};

// Đầu to vừa kiểu Soul Knight, mặt lộ. Khung 48×48.
function drawGunner(ctx, frame) {
  const dir = (frame / 4) | 0;
  const wf  = frame % 4;
  const w4  = wo4(wf);
  const lO  = w4[0];
  const rO  = w4[1];
  const bob = (wf === 1 || wf === 3) ? 1 : 0;
  const arm = [0, 2, 0, -2][wf];
  const hy  = 16 + bob;                          // tâm đầu

  fc(ctx, 24, 45, 9, 'rgba(0,0,0,0.16)');        // bóng mặt đất

  // ── helper: thân + tay + chân + vạt áo (dùng chung 4 hướng, đổi vài tham số) ──
  const legs = () => {
    fr(ctx, 16, 38 + lO, 7, 7, G.OL);  fr(ctx, 25, 38 + rO, 7, 7, G.OL);
    fr(ctx, 17, 38 + lO, 5, 4, G.COATL);  fr(ctx, 17, 42 + lO, 5, 3, G.BOOT);
    fr(ctx, 26, 38 + rO, 5, 4, G.COATL);  fr(ctx, 26, 42 + rO, 5, 3, G.BOOT);
  };

  if (dir === 0) { // DOWN — front (bám sát ảnh)
    // silhouette
    fr(ctx, 9, 27 + bob, 7, 13, G.OL);   fr(ctx, 32, 27 + bob, 7, 13, G.OL); // 2 tay
    legs();
    fr(ctx, 12, 25 + bob, 24, 16, G.OL);                                     // thân
    fc(ctx, 24, hy, 11, G.OL);                                               // đầu

    // tay áo + găng
    fr(ctx, 10, 28 + bob, 5, 10, G.COAT);  fr(ctx, 10, 28 + bob, 5, 4, G.COAT_HI);  fr(ctx, 10, 36 + bob, 5, 3, G.GLOVE);
    fr(ctx, 33, 28 + bob, 5, 10, G.COAT);  fr(ctx, 33, 28 + bob, 5, 4, G.COAT_DK);  fr(ctx, 33, 36 + bob, 5, 3, G.GLOVE);

    // áo khoác
    fr(ctx, 13, 26 + bob, 22, 15, G.COAT);
    fr(ctx, 13, 26 + bob, 8, 15, G.COAT_HI);            // nửa trái sáng
    fr(ctx, 13, 37 + bob, 22, 4, G.COATL);              // vạt sáng dưới
    fr(ctx, 13, 37 + bob, 22, 1, G.COAT_DK);
    fr(ctx, 22, 28 + bob, 4, 11, G.COATL_DK);           // mép áo trước
    fr(ctx, 14, 26 + bob, 7, 4, G.ACC);  fr(ctx, 14, 26 + bob, 7, 1, G.CAP_DK); // patch đỏ vai

    // ── mặt (da) ──
    fc(ctx, 24, 19, 9, G.SKIN);
    fr(ctx, 15, 17, 18, 7, G.SKIN);
    fr(ctx, 15, 22, 18, 2, G.SKIN_DK);                  // bóng dưới gò má
    // mắt
    fr(ctx, 20, 18, 2, 3, G.EYE);  fr(ctx, 27, 18, 2, 3, G.EYE);
    fr(ctx, 20, 18, 1, 1, '#ffffff');  fr(ctx, 27, 18, 1, 1, '#ffffff');

    // ── mặt nạ lọc (che miệng/cằm) — gân dọc ──
    fr(ctx, 18, 22, 12, 8, G.MASK);
    fr(ctx, 18, 22, 12, 1, G.MASK_HI);
    fr(ctx, 18, 29, 12, 1, G.MASK_DK);
    fr(ctx, 21, 23, 1, 6, G.MASK_DK);  fr(ctx, 24, 23, 1, 6, G.MASK_DK);  fr(ctx, 27, 23, 1, 6, G.MASK_DK);
    fr(ctx, 17, 28, 1, 2, G.OL);  fr(ctx, 30, 28, 1, 2, G.OL);           // bo góc đáy

    // ── kính phi công gác trán ──
    fr(ctx, 15, 13, 18, 4, G.GOG);  fr(ctx, 15, 13, 18, 1, G.GOG_DK);    // dây kính
    fc(ctx, 19, 14, 3.4, G.GOG_DK);  fc(ctx, 29, 14, 3.4, G.GOG_DK);     // gọng tròn
    fc(ctx, 19, 14, 2.4, G.LENS);    fc(ctx, 29, 14, 2.4, G.LENS);
    fr(ctx, 17.5, 12.5, 2, 2, G.LENS_HI);  fr(ctx, 27.5, 12.5, 2, 2, G.LENS_HI);

    // ── nón/khăn đỏ (trên cùng) ──
    fc(ctx, 24, 11, 11, G.CAP);                          // vòm nón
    fr(ctx, 13, 12, 22, 2, G.CAP_DK);                    // mép nón
    fc(ctx, 20, 8, 4, G.CAP_HI);                         // highlight
    fr(ctx, 11, 12, 5, 3, G.CAP_DK);                     // chóp lệch trái

  } else if (dir === 1) { // UP — back
    fr(ctx, 9, 27 + bob, 7, 13, G.OL);   fr(ctx, 32, 27 + bob, 7, 13, G.OL);
    legs();
    fr(ctx, 12, 25 + bob, 24, 16, G.OL);
    fc(ctx, 24, hy, 11, G.OL);

    fr(ctx, 10, 28 + bob, 5, 10, G.COAT);  fr(ctx, 10, 36 + bob, 5, 3, G.GLOVE);
    fr(ctx, 33, 28 + bob, 5, 10, G.COAT);  fr(ctx, 33, 36 + bob, 5, 3, G.GLOVE);
    fr(ctx, 13, 26 + bob, 22, 15, G.COAT);
    fr(ctx, 13, 26 + bob, 8, 15, G.COAT_HI);
    fr(ctx, 15, 28 + bob, 18, 9, G.COAT_DK);            // ba lô
    fr(ctx, 15, 28 + bob, 18, 1, G.COAT);
    fr(ctx, 20, 31 + bob, 8, 4, G.ACC);                // tag đỏ
    fr(ctx, 13, 37 + bob, 22, 4, G.COATL);  fr(ctx, 13, 37 + bob, 22, 1, G.COAT_DK);

    // sau đầu: nón đỏ + dây kính
    fc(ctx, 24, 15, 11, G.CAP);
    fc(ctx, 24, 17, 9, G.CAP_DK);                       // tóc/gáy tối trong nón
    fr(ctx, 15, 13, 18, 3, G.GOG);  fr(ctx, 15, 13, 18, 1, G.GOG_DK); // dây kính vòng sau
    fc(ctx, 20, 9, 4, G.CAP_HI);
    fr(ctx, 11, 13, 5, 3, G.CAP_DK);

  } else if (dir === 2) { // LEFT
    fr(ctx, 26, 27 + bob, 6, 13, G.OL);                 // tay sau
    legs();
    fr(ctx, 13, 25 + bob, 21, 16, G.OL);
    fr(ctx, 9, 28 + bob, 6, 12, G.OL);                  // tay trước
    fc(ctx, 22, hy, 11, G.OL);

    fr(ctx, 27, 28 + bob, 4, 11, G.COAT_DK);            // tay sau
    fr(ctx, 14, 26 + bob, 19, 15, G.COAT);
    fr(ctx, 14, 26 + bob, 19, 3, G.COAT_HI);
    fr(ctx, 14, 37 + bob, 19, 4, G.COATL);  fr(ctx, 14, 37 + bob, 19, 1, G.COAT_DK);
    fr(ctx, 10, 29 + bob, 5, 10, G.COAT);  fr(ctx, 10, 37 + bob, 5, 3, G.GLOVE); // tay trước

    // mặt nghiêng
    fc(ctx, 20, 19, 8, G.SKIN);
    fr(ctx, 11, 17, 13, 7, G.SKIN);
    fr(ctx, 16, 18, 2, 3, G.EYE);  fr(ctx, 16, 18, 1, 1, '#ffffff'); // 1 mắt
    // mặt nạ trước
    fr(ctx, 10, 22, 9, 7, G.MASK);  fr(ctx, 10, 22, 9, 1, G.MASK_HI);  fr(ctx, 10, 28, 9, 1, G.MASK_DK);
    fr(ctx, 12, 23, 1, 5, G.MASK_DK);  fr(ctx, 15, 23, 1, 5, G.MASK_DK);
    // kính gác trán (1 lens)
    fr(ctx, 12, 13, 16, 4, G.GOG);  fr(ctx, 12, 13, 16, 1, G.GOG_DK);
    fc(ctx, 16, 14, 3.2, G.GOG_DK);  fc(ctx, 16, 14, 2.2, G.LENS);  fr(ctx, 14.5, 12.5, 2, 2, G.LENS_HI);
    // nón
    fc(ctx, 22, 11, 11, G.CAP);  fr(ctx, 11, 12, 22, 2, G.CAP_DK);
    fc(ctx, 18, 8, 4, G.CAP_HI);  fr(ctx, 9, 13, 5, 3, G.CAP_DK);    // chóp ra trước

  } else { // RIGHT
    fr(ctx, 16, 27 + bob, 6, 13, G.OL);                 // tay sau
    legs();
    fr(ctx, 14, 25 + bob, 21, 16, G.OL);
    fr(ctx, 33, 28 + bob, 6, 12, G.OL);                 // tay trước
    fc(ctx, 26, hy, 11, G.OL);

    fr(ctx, 17, 28 + bob, 4, 11, G.COAT_DK);            // tay sau
    fr(ctx, 15, 26 + bob, 19, 15, G.COAT);
    fr(ctx, 15, 26 + bob, 19, 3, G.COAT_HI);
    fr(ctx, 15, 37 + bob, 19, 4, G.COATL);  fr(ctx, 15, 37 + bob, 19, 1, G.COAT_DK);
    fr(ctx, 33, 29 + bob, 5, 10, G.COAT);  fr(ctx, 33, 37 + bob, 5, 3, G.GLOVE); // tay trước

    fc(ctx, 28, 19, 8, G.SKIN);
    fr(ctx, 24, 17, 13, 7, G.SKIN);
    fr(ctx, 30, 18, 2, 3, G.EYE);  fr(ctx, 30, 18, 1, 1, '#ffffff');
    fr(ctx, 29, 22, 9, 7, G.MASK);  fr(ctx, 29, 22, 9, 1, G.MASK_HI);  fr(ctx, 29, 28, 9, 1, G.MASK_DK);
    fr(ctx, 32, 23, 1, 5, G.MASK_DK);  fr(ctx, 35, 23, 1, 5, G.MASK_DK);
    fr(ctx, 20, 13, 16, 4, G.GOG);  fr(ctx, 20, 13, 16, 1, G.GOG_DK);
    fc(ctx, 32, 14, 3.2, G.GOG_DK);  fc(ctx, 32, 14, 2.2, G.LENS);  fr(ctx, 30.5, 12.5, 2, 2, G.LENS_HI);
    fc(ctx, 26, 11, 11, G.CAP);  fr(ctx, 15, 12, 22, 2, G.CAP_DK);
    fc(ctx, 22, 8, 4, G.CAP_HI);  fr(ctx, 34, 13, 5, 3, G.CAP_DK);
  }
}

// ─── TANK — 48px "Riot Bulwark": survivor giáp bạo động, đỏ, to nặng ─────────────
const TK = {
  OL: '#0A0C12',
  ARMOR: '#4a3f3a', ARMOR_HI: '#5f524b', ARMOR_DK: '#2a2420',
  PLATE: '#5a5f66', PLATE_HI: '#7a818b', PLATE_DK: '#34383f',
  PANTS: '#2b2e35', BOOT: '#14151b',
  ACC: '#d23b2e', ACC_DK: '#8e2018', ACC_GLOW: '#ff5a3c', VISOR: '#ff6a4d'
};
function drawTank(ctx, frame) {
  const dir = (frame / 4) | 0, wf = frame % 4, w4 = wo4(wf);
  const lO = w4[0] * 1.5, rO = w4[1] * 1.5;
  const bob = (wf === 1 || wf === 3) ? 1.5 : 0, arm = [0, 3, 0, -3][wf], hy = 16 + bob;

  if (dir === 0) { // DOWN
    fc(ctx, 24, hy, 15, TK.OL);
    fr(ctx, 9, 24 + bob, 30, 20, TK.OL);
    grect(ctx, 16, 41 + lO, 7, 6, TK.PANTS, '#1b1d23');
    grect(ctx, 25, 41 + rO, 7, 6, TK.PANTS, '#1b1d23');
    fr(ctx, 15, 46 + lO, 9, 2, TK.BOOT); fr(ctx, 25, 46 + rO, 9, 2, TK.BOOT);
    grect(ctx, 8 + arm, 26 + bob, 6, 14, TK.ARMOR, TK.ARMOR_DK);
    grect(ctx, 34 - arm, 26 + bob, 6, 14, TK.ARMOR, TK.ARMOR_DK);
    fr(ctx, 8 + arm, 33 + bob, 6, 3, TK.PLATE); fr(ctx, 34 - arm, 33 + bob, 6, 3, TK.PLATE);
    grect(ctx, 13, 25 + bob, 22, 17, TK.ARMOR_HI, TK.ARMOR);
    grect(ctx, 9, 23 + bob, 10, 8, TK.PLATE_HI, TK.PLATE_DK);  // pauldron
    grect(ctx, 29, 23 + bob, 10, 8, TK.PLATE_HI, TK.PLATE_DK);
    grect(ctx, 16, 27 + bob, 16, 12, TK.PLATE, TK.PLATE_DK);   // chest plate
    fr(ctx, 16, 27 + bob, 16, 1, TK.PLATE_HI);
    fr(ctx, 19, 28 + bob, 2, 12, TK.ARMOR_DK); fr(ctx, 27, 28 + bob, 2, 12, TK.ARMOR_DK);
    glow(ctx, TK.ACC_GLOW, 3, () => fr(ctx, 22, 31 + bob, 4, 4, TK.ACC)); // emblem đỏ
    fr(ctx, 23, 32 + bob, 2, 2, TK.ACC_DK);
    gcircle(ctx, 24, hy, 13, TK.PLATE_HI, TK.PLATE);           // mũ bạo động
    fr(ctx, 12, hy + 1, 24, 7, TK.OL);                         // hốc kính
    glow(ctx, TK.ACC_GLOW, 5, () => fr(ctx, 14, hy + 3, 20, 3, TK.VISOR)); // khe kính đỏ
    fr(ctx, 14, hy + 3, 20, 1, '#ffd2c4');
    fc(ctx, 18, hy - 6, 3, TK.PLATE_HI);
    fr(ctx, 15, hy + 8, 18, 2, TK.PLATE_DK);

  } else if (dir === 1) { // UP
    fc(ctx, 24, hy, 15, TK.OL);
    fr(ctx, 9, 24 + bob, 30, 20, TK.OL);
    grect(ctx, 16, 41 + lO, 7, 6, TK.PANTS, '#1b1d23');
    grect(ctx, 25, 41 + rO, 7, 6, TK.PANTS, '#1b1d23');
    fr(ctx, 15, 46 + lO, 9, 2, TK.BOOT); fr(ctx, 25, 46 + rO, 9, 2, TK.BOOT);
    grect(ctx, 8 + arm, 26 + bob, 6, 14, TK.ARMOR, TK.ARMOR_DK);
    grect(ctx, 34 - arm, 26 + bob, 6, 14, TK.ARMOR, TK.ARMOR_DK);
    grect(ctx, 13, 25 + bob, 22, 17, TK.ARMOR_HI, TK.ARMOR);
    grect(ctx, 9, 23 + bob, 10, 8, TK.PLATE_HI, TK.PLATE_DK);
    grect(ctx, 29, 23 + bob, 10, 8, TK.PLATE_HI, TK.PLATE_DK);
    grect(ctx, 16, 26 + bob, 16, 14, TK.PLATE_DK, '#22252b');  // khiên sau lưng
    fr(ctx, 16, 26 + bob, 16, 1, TK.PLATE);
    glow(ctx, TK.ACC_GLOW, 3, () => fr(ctx, 22, 30 + bob, 4, 6, TK.ACC));
    gcircle(ctx, 24, hy, 13, TK.PLATE_HI, TK.PLATE);
    fc(ctx, 18, hy - 6, 3, TK.PLATE_HI);
    fr(ctx, 15, hy + 6, 18, 2, TK.PLATE_DK);

  } else if (dir === 2) { // LEFT
    fc(ctx, 22, hy, 14, TK.OL);
    fr(ctx, 9, 24 + bob, 28, 20, TK.OL);
    grect(ctx, 16, 41 + lO, 7, 6, TK.PANTS, '#1b1d23');
    grect(ctx, 24, 41 + rO, 7, 6, TK.PANTS, '#1b1d23');
    fr(ctx, 14, 46 + lO, 9, 2, TK.BOOT); fr(ctx, 23, 46 + rO, 9, 2, TK.BOOT);
    fr(ctx, 28, 26 + bob, 6, 13, TK.ARMOR_DK);
    grect(ctx, 12, 25 + bob, 22, 17, TK.ARMOR_HI, TK.ARMOR);
    grect(ctx, 10, 23 + bob, 11, 8, TK.PLATE_HI, TK.PLATE_DK);
    grect(ctx, 8 + arm, 28 + bob, 6, 12, TK.ARMOR, TK.ARMOR_DK);
    gcircle(ctx, 22, hy, 13, TK.PLATE_HI, TK.PLATE);
    fr(ctx, 8, hy + 1, 16, 7, TK.OL);
    glow(ctx, TK.ACC_GLOW, 5, () => fr(ctx, 9, hy + 3, 12, 3, TK.VISOR));
    fc(ctx, 16, hy - 6, 3, TK.PLATE_HI);

  } else { // RIGHT
    fc(ctx, 26, hy, 14, TK.OL);
    fr(ctx, 11, 24 + bob, 28, 20, TK.OL);
    grect(ctx, 17, 41 + lO, 7, 6, TK.PANTS, '#1b1d23');
    grect(ctx, 25, 41 + rO, 7, 6, TK.PANTS, '#1b1d23');
    fr(ctx, 16, 46 + lO, 9, 2, TK.BOOT); fr(ctx, 25, 46 + rO, 9, 2, TK.BOOT);
    fr(ctx, 14, 26 + bob, 6, 13, TK.ARMOR_DK);
    grect(ctx, 14, 25 + bob, 22, 17, TK.ARMOR_HI, TK.ARMOR);
    grect(ctx, 27, 23 + bob, 11, 8, TK.PLATE_HI, TK.PLATE_DK);
    grect(ctx, 34 - arm, 28 + bob, 6, 12, TK.ARMOR, TK.ARMOR_DK);
    gcircle(ctx, 26, hy, 13, TK.PLATE_HI, TK.PLATE);
    fr(ctx, 24, hy + 1, 16, 7, TK.OL);
    glow(ctx, TK.ACC_GLOW, 5, () => fr(ctx, 27, hy + 3, 12, 3, TK.VISOR));
    fc(ctx, 20, hy - 6, 3, TK.PLATE_HI);
  }
}

// ─── MEDIC — 48px "Field Medic" survivor: mặt nạ + lăng kính lục + chữ thập ───────
const MD = {
  OL: '#0A0F0C',
  COAT: '#3a4640', COAT_HI: '#4e5b53', COAT_DK: '#212a25',
  PANTS: '#2a2f2c', BOOT: '#14191a',
  MASK: '#5a626c', MASK_HI: '#79828e', MASK_DK: '#383e46',
  HOOD: '#36423c', HOOD_HI: '#4c5850',
  ACC: '#2ec26a', ACC_DK: '#1a7a40', ACC_GLOW: '#5cff9e', CROSS: '#e8efe9'
};
function drawMedic(ctx, frame) {
  const dir = (frame / 4) | 0, wf = frame % 4, w4 = wo4(wf);
  const lO = w4[0] * 1.5, rO = w4[1] * 1.5;
  const bob = (wf === 1 || wf === 3) ? 1.5 : 0, arm = [0, 3, 0, -3][wf], hy = 16 + bob;

  if (dir === 0) { // DOWN
    fc(ctx, 24, hy, 15, MD.OL);
    fr(ctx, 13, 25 + bob, 22, 19, MD.OL);
    grect(ctx, 16, 40 + lO, 6, 6, MD.PANTS, '#191e1b');
    grect(ctx, 26, 40 + rO, 6, 6, MD.PANTS, '#191e1b');
    fr(ctx, 15, 45 + lO, 8, 3, MD.BOOT); fr(ctx, 25, 45 + rO, 8, 3, MD.BOOT);
    grect(ctx, 11 + arm, 26 + bob, 5, 12, MD.COAT, MD.COAT_DK);
    grect(ctx, 32 - arm, 26 + bob, 5, 12, MD.COAT, MD.COAT_DK);
    grect(ctx, 14, 25 + bob, 20, 17, MD.COAT_HI, MD.COAT);
    fr(ctx, 20, 27 + bob, 8, 12, MD.CROSS);                 // bảng trắng ngực
    glow(ctx, MD.ACC_GLOW, 3, () => {                       // chữ thập lục
      fr(ctx, 23, 28 + bob, 2, 9, MD.ACC); fr(ctx, 20, 31 + bob, 8, 2, MD.ACC);
    });
    fr(ctx, 15, 26 + bob, 2, 15, MD.ACC_DK);               // dây túi
    gcircle(ctx, 24, hy, 14, MD.HOOD_HI, MD.HOOD);
    fc(ctx, 24, hy + 2, 10, MD.OL);
    grect(ctx, 17, hy - 3, 14, 11, MD.MASK_HI, MD.MASK);
    fr(ctx, 17, hy - 3, 14, 1, MD.MASK_DK);
    fc(ctx, 24, hy + 8, 4, MD.MASK); fc(ctx, 24, hy + 8, 2.3, MD.MASK_DK);
    glow(ctx, MD.ACC_GLOW, 5, () => { fc(ctx, 20, hy + 1, 3, MD.ACC); fc(ctx, 28, hy + 1, 3, MD.ACC); });
    fc(ctx, 20, hy + 1, 1.5, MD.ACC_DK); fc(ctx, 28, hy + 1, 1.5, MD.ACC_DK);
    fc(ctx, 19.2, hy + 0.2, 0.9, '#fff'); fc(ctx, 27.2, hy + 0.2, 0.9, '#fff');
    fc(ctx, 17, hy - 7, 3, MD.HOOD_HI);

  } else if (dir === 1) { // UP
    fc(ctx, 24, hy, 15, MD.OL);
    fr(ctx, 13, 25 + bob, 22, 19, MD.OL);
    grect(ctx, 16, 40 + lO, 6, 6, MD.PANTS, '#191e1b');
    grect(ctx, 26, 40 + rO, 6, 6, MD.PANTS, '#191e1b');
    fr(ctx, 15, 45 + lO, 8, 3, MD.BOOT); fr(ctx, 25, 45 + rO, 8, 3, MD.BOOT);
    grect(ctx, 11 + arm, 26 + bob, 5, 12, MD.COAT, MD.COAT_DK);
    grect(ctx, 32 - arm, 26 + bob, 5, 12, MD.COAT, MD.COAT_DK);
    grect(ctx, 14, 25 + bob, 20, 17, MD.COAT_HI, MD.COAT);
    grect(ctx, 16, 27 + bob, 16, 12, MD.COAT_DK, '#1a211d'); // ba lô y tế
    glow(ctx, MD.ACC_GLOW, 3, () => { fr(ctx, 22, 29 + bob, 2, 7, MD.ACC); fr(ctx, 20, 31 + bob, 6, 2, MD.ACC); });
    gcircle(ctx, 24, hy, 14, MD.HOOD_HI, MD.HOOD);
    fr(ctx, 19, hy + 5, 10, 2, MD.HOOD);
    fc(ctx, 17, hy - 7, 3, MD.HOOD_HI);

  } else if (dir === 2) { // LEFT
    fc(ctx, 22, hy, 14, MD.OL);
    fr(ctx, 13, 25 + bob, 21, 19, MD.OL);
    grect(ctx, 16, 40 + lO, 6, 6, MD.PANTS, '#191e1b');
    grect(ctx, 24, 40 + rO, 6, 6, MD.PANTS, '#191e1b');
    fr(ctx, 14, 45 + lO, 8, 3, MD.BOOT); fr(ctx, 23, 45 + rO, 8, 3, MD.BOOT);
    fr(ctx, 18, 26 + bob, 5, 13, MD.COAT_DK);
    grect(ctx, 10, 25 + bob, 14, 17, MD.COAT_HI, MD.COAT);
    grect(ctx, 8 + arm, 28 + bob, 5, 11, MD.COAT, MD.COAT_DK);
    gcircle(ctx, 22, hy, 14, MD.HOOD_HI, MD.HOOD);
    fc(ctx, 18, hy + 2, 9, MD.OL);
    grect(ctx, 9, hy - 2, 12, 9, MD.MASK_HI, MD.MASK);
    fc(ctx, 10, hy + 6, 3.5, MD.MASK); fc(ctx, 10, hy + 6, 2, MD.MASK_DK);
    glow(ctx, MD.ACC_GLOW, 5, () => fc(ctx, 14, hy + 1, 3, MD.ACC));
    fc(ctx, 14, hy + 1, 1.5, MD.ACC_DK);
    fc(ctx, 20, hy - 7, 3, MD.HOOD_HI);

  } else { // RIGHT
    fc(ctx, 26, hy, 14, MD.OL);
    fr(ctx, 14, 25 + bob, 21, 19, MD.OL);
    grect(ctx, 18, 40 + lO, 6, 6, MD.PANTS, '#191e1b');
    grect(ctx, 26, 40 + rO, 6, 6, MD.PANTS, '#191e1b');
    fr(ctx, 17, 45 + lO, 8, 3, MD.BOOT); fr(ctx, 26, 45 + rO, 8, 3, MD.BOOT);
    fr(ctx, 25, 26 + bob, 5, 13, MD.COAT_DK);
    grect(ctx, 24, 25 + bob, 14, 17, MD.COAT_HI, MD.COAT);
    grect(ctx, 35 - arm, 28 + bob, 5, 11, MD.COAT, MD.COAT_DK);
    gcircle(ctx, 26, hy, 14, MD.HOOD_HI, MD.HOOD);
    fc(ctx, 30, hy + 2, 9, MD.OL);
    grect(ctx, 27, hy - 2, 12, 9, MD.MASK_HI, MD.MASK);
    fc(ctx, 38, hy + 6, 3.5, MD.MASK); fc(ctx, 38, hy + 6, 2, MD.MASK_DK);
    glow(ctx, MD.ACC_GLOW, 5, () => fc(ctx, 34, hy + 1, 3, MD.ACC));
    fc(ctx, 34, hy + 1, 1.5, MD.ACC_DK);
    fc(ctx, 28, hy - 7, 3, MD.HOOD_HI);
  }
}

// ─── TRAPPER — 48px "Scavenger" survivor: mũ trùm + kính bảo hộ cam + đồ bẫy ──────
const TP = {
  OL: '#0F0A05',
  JACK: '#43392c', JACK_HI: '#574b3a', JACK_DK: '#251e15',
  HOOD: '#3a3326', HOOD_HI: '#4e4534',
  PANTS: '#2c2820', BOOT: '#171410', SKIN: '#caa078',
  GOG: '#1a1d22', GLASS: '#ff9e2e',
  ACC: '#e8821e', ACC_DK: '#a85610', ACC_GLOW: '#ffb24a', STRAP: '#5a4632'
};
function drawTrapper(ctx, frame) {
  const dir = (frame / 4) | 0, wf = frame % 4, w4 = wo4(wf);
  const lO = w4[0] * 1.5, rO = w4[1] * 1.5;
  const bob = (wf === 1 || wf === 3) ? 1.5 : 0, arm = [0, 3, 0, -3][wf], hy = 16 + bob;

  if (dir === 0) { // DOWN
    fc(ctx, 24, hy, 15, TP.OL);
    fr(ctx, 13, 25 + bob, 22, 19, TP.OL);
    grect(ctx, 16, 40 + lO, 6, 6, TP.PANTS, '#15120d');
    grect(ctx, 26, 40 + rO, 6, 6, TP.PANTS, '#15120d');
    fr(ctx, 15, 45 + lO, 8, 3, TP.BOOT); fr(ctx, 25, 45 + rO, 8, 3, TP.BOOT);
    grect(ctx, 11 + arm, 26 + bob, 5, 12, TP.JACK, TP.JACK_DK);
    grect(ctx, 32 - arm, 26 + bob, 5, 12, TP.JACK, TP.JACK_DK);
    grect(ctx, 14, 25 + bob, 20, 17, TP.JACK_HI, TP.JACK);
    fr(ctx, 18, 26 + bob, 2, 15, TP.STRAP); fr(ctx, 27, 26 + bob, 2, 15, TP.STRAP); // đai
    fr(ctx, 15, 33 + bob, 18, 2, TP.JACK_DK);                                       // thắt lưng
    glow(ctx, TP.ACC_GLOW, 2, () => fr(ctx, 11 + arm, 28 + bob, 5, 2, TP.ACC));      // băng tay cam
    fc(ctx, 31, 37 + bob, 3, TP.ACC); fc(ctx, 31, 37 + bob, 1.5, TP.JACK_DK);        // cuộn bẫy ở hông
    gcircle(ctx, 24, hy, 14, TP.HOOD_HI, TP.HOOD);
    fr(ctx, 15, hy, 18, 7, TP.SKIN);                                                // mặt
    fr(ctx, 15, hy - 1, 18, 5, TP.GOG);                                             // kính bảo hộ
    glow(ctx, TP.ACC_GLOW, 4, () => { fc(ctx, 20, hy + 1, 2.6, TP.GLASS); fc(ctx, 28, hy + 1, 2.6, TP.GLASS); });
    fc(ctx, 20, hy + 1, 1.3, '#7a3d00'); fc(ctx, 28, hy + 1, 1.3, '#7a3d00');
    fc(ctx, 19.3, hy + 0.2, 0.8, '#fff'); fc(ctx, 27.3, hy + 0.2, 0.8, '#fff');
    fr(ctx, 18, hy + 5, 12, 2, TP.JACK_DK);                                         // khăn che miệng
    fc(ctx, 17, hy - 7, 3, TP.HOOD_HI);

  } else if (dir === 1) { // UP
    fc(ctx, 24, hy, 15, TP.OL);
    fr(ctx, 13, 25 + bob, 22, 19, TP.OL);
    grect(ctx, 16, 40 + lO, 6, 6, TP.PANTS, '#15120d');
    grect(ctx, 26, 40 + rO, 6, 6, TP.PANTS, '#15120d');
    fr(ctx, 15, 45 + lO, 8, 3, TP.BOOT); fr(ctx, 25, 45 + rO, 8, 3, TP.BOOT);
    grect(ctx, 11 + arm, 26 + bob, 5, 12, TP.JACK, TP.JACK_DK);
    grect(ctx, 32 - arm, 26 + bob, 5, 12, TP.JACK, TP.JACK_DK);
    grect(ctx, 14, 25 + bob, 20, 17, TP.JACK_HI, TP.JACK);
    grect(ctx, 16, 27 + bob, 16, 12, TP.JACK_DK, '#1b160f');  // ba lô đồ nghề
    fc(ctx, 24, 31 + bob, 3, TP.STRAP); fc(ctx, 24, 31 + bob, 1.6, TP.JACK_DK); // cuộn dây
    glow(ctx, TP.ACC_GLOW, 2, () => fr(ctx, 21, 36 + bob, 6, 2, TP.ACC));
    gcircle(ctx, 24, hy, 14, TP.HOOD_HI, TP.HOOD);
    fr(ctx, 19, hy + 5, 10, 2, TP.HOOD);
    fc(ctx, 17, hy - 7, 3, TP.HOOD_HI);

  } else if (dir === 2) { // LEFT
    fc(ctx, 22, hy, 14, TP.OL);
    fr(ctx, 13, 25 + bob, 21, 19, TP.OL);
    grect(ctx, 16, 40 + lO, 6, 6, TP.PANTS, '#15120d');
    grect(ctx, 24, 40 + rO, 6, 6, TP.PANTS, '#15120d');
    fr(ctx, 14, 45 + lO, 8, 3, TP.BOOT); fr(ctx, 23, 45 + rO, 8, 3, TP.BOOT);
    fr(ctx, 18, 26 + bob, 5, 13, TP.JACK_DK);
    grect(ctx, 10, 25 + bob, 14, 17, TP.JACK_HI, TP.JACK);
    grect(ctx, 8 + arm, 28 + bob, 5, 11, TP.JACK, TP.JACK_DK);
    gcircle(ctx, 22, hy, 14, TP.HOOD_HI, TP.HOOD);
    fr(ctx, 8, hy, 12, 6, TP.SKIN);
    fr(ctx, 8, hy - 1, 13, 5, TP.GOG);
    glow(ctx, TP.ACC_GLOW, 4, () => fc(ctx, 13, hy + 1, 2.6, TP.GLASS));
    fc(ctx, 13, hy + 1, 1.3, '#7a3d00');
    fc(ctx, 20, hy - 7, 3, TP.HOOD_HI);

  } else { // RIGHT
    fc(ctx, 26, hy, 14, TP.OL);
    fr(ctx, 14, 25 + bob, 21, 19, TP.OL);
    grect(ctx, 18, 40 + lO, 6, 6, TP.PANTS, '#15120d');
    grect(ctx, 26, 40 + rO, 6, 6, TP.PANTS, '#15120d');
    fr(ctx, 17, 45 + lO, 8, 3, TP.BOOT); fr(ctx, 26, 45 + rO, 8, 3, TP.BOOT);
    fr(ctx, 25, 26 + bob, 5, 13, TP.JACK_DK);
    grect(ctx, 24, 25 + bob, 14, 17, TP.JACK_HI, TP.JACK);
    grect(ctx, 35 - arm, 28 + bob, 5, 11, TP.JACK, TP.JACK_DK);
    gcircle(ctx, 26, hy, 14, TP.HOOD_HI, TP.HOOD);
    fr(ctx, 28, hy, 12, 6, TP.SKIN);
    fr(ctx, 27, hy - 1, 13, 5, TP.GOG);
    glow(ctx, TP.ACC_GLOW, 4, () => fc(ctx, 35, hy + 1, 2.6, TP.GLASS));
    fc(ctx, 35, hy + 1, 1.3, '#7a3d00');
    fc(ctx, 28, hy - 7, 3, TP.HOOD_HI);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ZOMBIE DRAW FUNCTIONS  (frame = dir*2 + walkFrame)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── WALKER — 48px xác thối gầy guộc (thịt lộ, vết thương hở, mắt sáng) ───────────
const WK = {
  OL: '#0A0E08',
  SKIN: '#5a6a44', SKIN_HI: '#71834f', SKIN_DK: '#34401f',
  CLOTH: '#3a3a32', CLOTH_DK: '#21211b',
  WOUND: '#6a1410', BONE: '#cabf9e', EYE: '#aaff44', EYE_GLOW: '#88dd22', BLOOD: '#560c08'
};
function drawWalker(ctx, frame) {
  const dir = (frame / 2) | 0, wf = frame % 2, w2 = wo2(wf);
  const lO = w2[0] * 1.5, rO = w2[1] * 1.5;
  const hx = dir === 2 ? 20 : dir === 3 ? 28 : 24;

  fc(ctx, 24, 16, 13, WK.OL);
  fr(ctx, 13, 24, 22, 20, WK.OL);
  grect(ctx, 16, 40 + lO, 6, 7, WK.SKIN, WK.SKIN_DK);        // chân lê
  grect(ctx, 26, 40 + rO, 6, 7, WK.SKIN, WK.SKIN_DK);
  fr(ctx, 15, 46 + lO, 8, 2, WK.OL); fr(ctx, 25, 46 + rO, 8, 2, WK.OL);
  grect(ctx, 10, 27, 5, 14, WK.SKIN, WK.SKIN_DK);            // tay buông
  grect(ctx, 33, 27, 5, 14, WK.SKIN, WK.SKIN_DK);
  fc(ctx, 12, 41, 3, WK.SKIN_HI); fc(ctx, 36, 41, 3, WK.SKIN_HI);
  grect(ctx, 14, 25, 20, 17, WK.SKIN_HI, WK.SKIN);           // thân
  fr(ctx, 14, 25, 7, 17, WK.CLOTH);                          // áo rách
  fr(ctx, 27, 28, 6, 12, WK.CLOTH);
  fr(ctx, 20, 30, 5, 5, WK.WOUND);                           // vết thương hở
  fc(ctx, 22, 33, 1.5, WK.BLOOD);
  fr(ctx, 18, 35, 3, 4, WK.SKIN_DK);                         // bóng sườn
  fc(ctx, hx, 16, 8, WK.SKIN_DK);                            // đầu
  fc(ctx, hx, 15, 7, WK.SKIN);
  fc(ctx, hx - 3, 13, 2.5, WK.SKIN_HI);
  fc(ctx, hx + 3, 12, 2, WK.BLOOD);
  fr(ctx, hx - 5, 15, 4, 3, WK.OL); fr(ctx, hx + 1, 15, 4, 3, WK.OL); // hốc mắt
  glow(ctx, WK.EYE_GLOW, 3, () => { fc(ctx, hx - 3, 16, 1.4, WK.EYE); fc(ctx, hx + 3, 16, 1.4, WK.EYE); });
  fr(ctx, hx - 3, 20, 6, 3, WK.OL);                          // hàm há
  fr(ctx, hx - 2, 20, 1, 2, WK.BONE); fr(ctx, hx, 20, 1, 2, WK.BONE); fr(ctx, hx + 2, 20, 1, 2, WK.BONE);
}

// ─── RUNNER — 48px xác gầy phi nhanh (vuốt, mắt cam rực, vệt tốc độ) ──────────────
const RN = {
  OL: '#0D0A04',
  SKIN: '#9a7a30', SKIN_HI: '#b89a45', SKIN_DK: '#5a4310',
  CLAW: '#cabf9e', EYE: '#ff6a00', EYE_GLOW: '#ff8a1e', BLOOD: '#560c08'
};
function drawRunner(ctx, frame) {
  const dir = (frame / 2) | 0, wf = frame % 2, w2 = wo2(wf);
  const lO = w2[0] * 1.5, rO = w2[1] * 1.5;
  const hx = dir === 2 ? 20 : dir === 3 ? 28 : 24;

  if (dir === 2) { for (let i = 0; i < 4; i++) fr(ctx, 2, 20 + i * 4, 9 - i, 1, RN.EYE_GLOW); }
  else if (dir === 3) { for (let i = 0; i < 4; i++) fr(ctx, 37 + i, 20 + i * 4, 9 - i, 1, RN.EYE_GLOW); }

  fc(ctx, 24, 16, 11, RN.OL);
  fr(ctx, 16, 24, 16, 18, RN.OL);                            // thân gầy
  grect(ctx, 17, 40 + lO, 5, 8, RN.SKIN, RN.SKIN_DK);        // chân dài
  grect(ctx, 26, 40 + rO, 5, 8, RN.SKIN, RN.SKIN_DK);
  fr(ctx, 16, 47 + lO, 7, 1, RN.OL); fr(ctx, 25, 47 + rO, 7, 1, RN.OL);
  grect(ctx, 11, 28, 5, 13, RN.SKIN, RN.SKIN_DK);            // tay dài + vuốt
  grect(ctx, 32, 28, 5, 13, RN.SKIN, RN.SKIN_DK);
  [-2, 1].forEach(o => { fr(ctx, 11 + o, 41, 1.3, 4, RN.CLAW); fr(ctx, 33 + o, 41, 1.3, 4, RN.CLAW); });
  grect(ctx, 17, 25, 14, 16, RN.SKIN_HI, RN.SKIN);           // ngực hốc hác
  fr(ctx, 21, 28, 6, 9, RN.SKIN_DK);                         // hốc bụng
  fr(ctx, 19, 30, 2, 6, RN.SKIN_DK); fr(ctx, 27, 30, 2, 6, RN.SKIN_DK); // sườn
  fc(ctx, hx, 16, 7, RN.SKIN_DK);                            // đầu nhỏ
  fc(ctx, hx, 15, 5.5, RN.SKIN);
  fr(ctx, hx - 4, 19, 8, 3, RN.OL);                          // mõm há
  fr(ctx, hx - 3, 19, 1, 2, RN.CLAW); fr(ctx, hx, 19, 1, 2, RN.CLAW); fr(ctx, hx + 2, 19, 1, 2, RN.CLAW);
  glow(ctx, RN.EYE_GLOW, 4, () => { fc(ctx, hx - 3, 14, 1.8, RN.EYE); fc(ctx, hx + 3, 14, 1.8, RN.EYE); });
}

// ─── BRUTE — 48px zombie khổng lồ hung tợn (thịt lộ, móng xương, mắt đỏ) ──────────
const BR = {
  OL: '#0A0705',
  FLESH: '#5a3a30', FLESH_HI: '#754a3c', FLESH_DK: '#321d16',
  MUSCLE: '#7a2e26', MUSCLE_DK: '#4a1611',
  BONE: '#ccbf9e', EYE: '#ff3a1e', EYE_GLOW: '#ff5a2e', BLOOD: '#560c08'
};
function drawBrute(ctx, frame) {
  const dir = (frame / 2) | 0, wf = frame % 2, w2 = wo2(wf);
  const lO = w2[0] * 1.5, rO = w2[1] * 1.5;

  if (dir === 1) { // UP — lưng gù, gai xương sống
    fr(ctx, 8, 18, 32, 24, BR.OL);
    grect(ctx, 15, 40 + lO, 8, 7, BR.FLESH, BR.FLESH_DK);
    grect(ctx, 25, 40 + rO, 8, 7, BR.FLESH, BR.FLESH_DK);
    grect(ctx, 3, 22, 9, 18, BR.FLESH, BR.FLESH_DK);
    grect(ctx, 36, 22, 9, 18, BR.FLESH, BR.FLESH_DK);
    grect(ctx, 10, 18, 28, 22, BR.FLESH_HI, BR.FLESH);
    fr(ctx, 22, 18, 4, 22, BR.MUSCLE_DK);
    [20, 26, 32, 38].forEach(y => fc(ctx, 24, y, 2.5, BR.BONE));
    fc(ctx, 24, 15, 7, BR.FLESH_DK);
    return;
  }

  const hx = dir === 2 ? 20 : dir === 3 ? 28 : 24;

  fr(ctx, 8, 18, 32, 24, BR.OL);                              // khối thân
  grect(ctx, 15, 40 + lO, 8, 7, BR.FLESH, BR.FLESH_DK);       // chân
  grect(ctx, 25, 40 + rO, 8, 7, BR.FLESH, BR.FLESH_DK);
  fr(ctx, 14, 45 + lO, 10, 3, BR.OL); fr(ctx, 24, 45 + rO, 10, 3, BR.OL);
  grect(ctx, 3, 22, 9, 18, BR.FLESH, BR.FLESH_DK);            // tay khổng lồ
  grect(ctx, 36, 22, 9, 18, BR.FLESH, BR.FLESH_DK);
  fc(ctx, 8, 40, 6, BR.FLESH_HI); fc(ctx, 40, 40, 6, BR.FLESH_HI); // nắm đấm
  [-4, -1, 2].forEach(o => {                                  // móng xương
    fr(ctx, 7 + o, 42, 1.5, 5, BR.BONE);
    fr(ctx, 39 + o, 42, 1.5, 5, BR.BONE);
  });
  grect(ctx, 10, 20, 28, 20, BR.FLESH_HI, BR.FLESH);          // ngực bự
  fr(ctx, 16, 24, 16, 3, BR.MUSCLE);                          // cơ lộ
  fr(ctx, 15, 28, 3, 8, BR.MUSCLE_DK);                        // khe sườn
  fr(ctx, 22, 28, 3, 8, BR.MUSCLE_DK);
  fr(ctx, 29, 28, 3, 8, BR.MUSCLE_DK);
  fc(ctx, 20, 34, 3, BR.BLOOD); fc(ctx, 29, 31, 2, BR.BLOOD); // máu
  fc(ctx, hx, 16, 7, BR.FLESH_DK);                            // đầu thụt
  fr(ctx, hx - 5, 16, 10, 4, BR.OL);                          // miệng há
  fr(ctx, hx - 4, 16, 1, 3, BR.BONE);                         // răng
  fr(ctx, hx - 1, 16, 1, 3, BR.BONE);
  fr(ctx, hx + 2, 16, 1, 3, BR.BONE);
  glow(ctx, BR.EYE_GLOW, 5, () => {                           // mắt đỏ rực
    fc(ctx, hx - 3, 12, 2.2, BR.EYE);
    fc(ctx, hx + 3, 12, 2.2, BR.EYE);
  });
}

// ─── SPITTER — 48px xác phồng độc (túi axit, miệng phun xanh phát sáng) ───────────
const SP = {
  OL: '#04130A',
  SKIN: '#1f7a26', SKIN_HI: '#33a83a', SKIN_DK: '#0e4514',
  SAC: '#2faa30', SAC_HI: '#5cd84e',
  ACID: '#aaff22', ACID_GLOW: '#88ff00', EYE: '#ccff44', PUS: '#d8f06a'
};
function drawSpitter(ctx, frame) {
  const dir = (frame / 2) | 0, wf = frame % 2, w2 = wo2(wf);
  const lO = w2[0] * 1.5, rO = w2[1] * 1.5;
  const hx = dir === 2 ? 20 : dir === 3 ? 28 : 24;

  fc(ctx, 24, 26, 19, SP.OL);                                // khối phồng
  grect(ctx, 17, 41 + lO, 5, 6, SP.SKIN, SP.SKIN_DK);        // chân ngắn
  grect(ctx, 26, 41 + rO, 5, 6, SP.SKIN, SP.SKIN_DK);
  gcircle(ctx, 24, 28, 16, SP.SKIN_HI, SP.SKIN);             // bụng tròn bự
  // túi axit hai bên phát sáng
  glow(ctx, SP.ACID_GLOW, 5, () => { fc(ctx, 9, 28, 6, SP.SAC); fc(ctx, 39, 28, 6, SP.SAC); });
  fc(ctx, 9, 26, 2.5, SP.SAC_HI); fc(ctx, 39, 26, 2.5, SP.SAC_HI);
  // mụn mủ trên bụng
  fc(ctx, 18, 26, 2, SP.PUS); fc(ctx, 29, 31, 2.5, SP.PUS); fc(ctx, 22, 34, 1.8, SP.PUS);
  fc(ctx, 24, 16, 10, SP.SKIN_DK);                           // đầu
  fc(ctx, 24, 15, 8, SP.SKIN);
  fr(ctx, hx - 6, 17, 12, 5, SP.OL);                         // miệng rộng
  glow(ctx, SP.ACID_GLOW, 5, () => fc(ctx, hx, 19, 3.5, SP.ACID_GLOW));
  fc(ctx, hx - 4, 24, 2, SP.ACID); fc(ctx, hx + 3, 26, 1.6, SP.ACID); // nhỏ axit
  glow(ctx, SP.ACID_GLOW, 4, () => { fc(ctx, hx - 4, 13, 2.4, SP.EYE); fc(ctx, hx + 4, 13, 2.4, SP.EYE); });
  fc(ctx, hx - 4, 13, 1.2, '#0a3a0a'); fc(ctx, hx + 4, 13, 1.2, '#0a3a0a');
}

// ─── SCREAMER — 48px bóng ma gào thét (mặt hốc hác, miệng há, sóng âm) ────────────
const SC = {
  OL: '#1a1208',
  SKIN: '#c9c4a0', SKIN_HI: '#e2ddba', SKIN_DK: '#8a8460',
  MAW: '#2a0e0e', EYE: '#fff04a', EYE_GLOW: '#ffe000'
};
function drawScreamer(ctx, frame) {
  const wf = frame % 2, pulse = wf === 0 ? 0 : 2.5;
  const cx = 24;

  // sóng âm phát ra từ miệng, lan dữ dội (pulse)
  ctx.lineWidth = 2;
  [9, 15, 21].forEach((r, i) => {
    ctx.strokeStyle = `rgba(255,236,90,${0.6 - i * 0.17})`;
    ctx.beginPath(); ctx.arc(cx, 16, r + pulse, -Math.PI * 0.8, Math.PI * 0.8); ctx.stroke();
  });

  // thân gầy guộc, lồng sườn lộ
  grect(ctx, 18, 28, 12, 13, SC.SKIN, SC.SKIN_DK);
  [31, 34, 37].forEach(y => fr(ctx, 19, y, 10, 1.4, SC.SKIN_DK));
  grect(ctx, 17, 39, 5, 6, SC.SKIN, SC.SKIN_DK);             // chân khẳng khiu
  grect(ctx, 26, 39, 5, 6, SC.SKIN, SC.SKIN_DK);

  // tay gầy giơ lên ôm hai bên đầu (tư thế gào điên loạn)
  ctx.strokeStyle = SC.SKIN; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(19, 29); ctx.lineTo(12, 20); ctx.lineTo(15, 11); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(29, 29); ctx.lineTo(36, 20); ctx.lineTo(33, 11); ctx.stroke();

  // đầu ngửa ra sau gào thét
  fc(ctx, cx, 15, 11, SC.OL);
  fc(ctx, cx, 14, 10, SC.SKIN);
  fc(ctx, cx - 3, 10, 3, SC.SKIN_HI);
  fr(ctx, cx - 11, 13, 3, 5, SC.SKIN_DK);                    // má hóp
  fr(ctx, cx + 8, 13, 3, 5, SC.SKIN_DK);

  // MIỆNG gào khổng lồ chạy dọc (sun/giãn theo nhịp)
  ctx.fillStyle = SC.MAW;
  ctx.beginPath(); ctx.ellipse(cx, 17, 4.5, 8 + pulse, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 4; i++) {                              // răng lởm chởm hai hàm
    fr(ctx, cx - 3.5 + i * 2.3, 10, 1, 2.4, SC.SKIN_HI);
    fr(ctx, cx - 3.5 + i * 2.3, 22, 1, 2.4, SC.SKIN_HI);
  }

  // mắt hốc trống cháy sáng
  glow(ctx, SC.EYE_GLOW, 6, () => { fc(ctx, cx - 6, 10, 2.4, SC.EYE); fc(ctx, cx + 6, 10, 2.4, SC.EYE); });
  fc(ctx, cx - 6, 10, 1, SC.OL); fc(ctx, cx + 6, 10, 1, SC.OL);
}

// ─── EXPLODER — 48px xác phồng sắp nổ (mụn rộp, nứt phát sáng đập theo nhịp) ──────
const EX = {
  OL: '#1a0a22',
  SKIN: '#6a3a7a', SKIN_HI: '#8a4f9a', SKIN_DK: '#3a1f48',
  CRACK: '#ff7a2e', CRACK_GLOW: '#ffb24a', BLISTER: '#b46ad0', PUS: '#d89af0', EYE: '#ff5a2e'
};
function drawExploder(ctx, frame) {
  const wf = frame % 2, p = wf === 0 ? 0 : 2.5;
  const cx = 24, cy = 27;

  // hơi nóng rò rỉ — quầng sáng đập theo nhịp (sắp nổ)
  glow(ctx, EX.CRACK_GLOW, 9 + p * 2, () => fc(ctx, cx, cy, 3, EX.CRACK_GLOW));

  grect(ctx, 16, 41, 6, 6, EX.SKIN, EX.SKIN_DK);             // chân ngắn ngủn
  grect(ctx, 26, 41, 6, 6, EX.SKIN, EX.SKIN_DK);

  fc(ctx, cx, cy, 19, EX.OL);                                // thân phồng khổng lồ
  gcircle(ctx, cx, cy, 18, EX.SKIN_HI, EX.SKIN);

  grect(ctx, 3, 26, 7, 5, EX.SKIN, EX.SKIN_DK);              // tay bé tí giơ ngang
  grect(ctx, 38, 26, 7, 5, EX.SKIN, EX.SKIN_DK);

  // mụn rộp căng phồng
  fc(ctx, 13, 22, 4, EX.BLISTER); fc(ctx, 35, 25, 5, EX.BLISTER);
  fc(ctx, 18, 38, 4, EX.BLISTER); fc(ctx, 31, 37, 3.5, EX.BLISTER);
  fc(ctx, 13, 21, 1.6, EX.PUS); fc(ctx, 35, 24, 2, EX.PUS); fc(ctx, 18, 37, 1.5, EX.PUS);

  // mạng nứt phát sáng TỎA RA từ lõi (đập theo nhịp)
  glow(ctx, EX.CRACK_GLOW, 4 + p, () => {
    ctx.strokeStyle = EX.CRACK; ctx.lineWidth = 1.5 + (p ? 1 : 0); ctx.lineCap = 'round';
    [[14, 13], [34, 14], [10, 31], [39, 30], [20, 41], [32, 40]].forEach(([x1, y1]) => {
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x1, y1); ctx.stroke();
    });
  });

  // LÕI nóng chảy lộ qua da nứt — tâm điểm vụ nổ
  glow(ctx, EX.CRACK_GLOW, 6 + p * 2, () => gcircle(ctx, cx, cy, 6 + p, EX.CRACK_GLOW, EX.CRACK));

  // đầu thụt bé nhăn nhó trên đỉnh
  fc(ctx, cx, 12, 6, EX.SKIN_DK);
  fr(ctx, cx - 4, 13, 8, 2, EX.OL);
  glow(ctx, EX.EYE, 4, () => { fc(ctx, cx - 3, 11, 1.8, EX.EYE); fc(ctx, cx + 3, 11, 1.8, EX.EYE); });
}

// ─── HORDEKING — 48px BOSS: vua zombie hắc ám, vương miện vàng, mắt đỏ rực ────────
const HK = {
  OL: '#050507',
  BODY: '#14131a', BODY_HI: '#262430', BODY_DK: '#0a0a0e',
  GOLD: '#d8a81e', GOLD_HI: '#ffd24a', GOLD_DK: '#8a6810',
  EYE: '#ff2a1e', EYE_GLOW: '#ff5a2e', CLOAK: '#1a0e1e', BONE: '#cabf9e'
};
function drawHordeking(ctx, frame) {
  const dir = (frame / 2) | 0, wf = frame % 2, w2 = wo2(wf);
  const lO = w2[0] * 1.5, rO = w2[1] * 1.5;
  const hx = dir === 2 ? 20 : dir === 3 ? 28 : 24;

  fc(ctx, 24, 22, 19, HK.OL);
  fr(ctx, 7, 22, 34, 24, HK.OL);
  grect(ctx, 15, 42 + lO, 8, 6, HK.BODY, HK.BODY_DK);        // chân nặng
  grect(ctx, 25, 42 + rO, 8, 6, HK.BODY, HK.BODY_DK);
  grect(ctx, 8, 24, 32, 22, HK.BODY_HI, HK.CLOAK);           // áo choàng rộng
  [10, 17, 24, 31, 37].forEach(x => fr(ctx, x, 44, 4, 3, HK.CLOAK)); // viền rách
  grect(ctx, 5, 24, 8, 16, HK.BODY, HK.BODY_DK);             // vai/tay bự
  grect(ctx, 35, 24, 8, 16, HK.BODY, HK.BODY_DK);
  glow(ctx, HK.GOLD_HI, 3, () => fc(ctx, 24, 30, 3.5, HK.GOLD)); // móc cài vàng
  fc(ctx, 24, 30, 1.8, HK.GOLD_DK);
  fr(ctx, 18, 26, 2, 8, HK.BONE); fr(ctx, 28, 26, 2, 8, HK.BONE); // xương sườn
  fc(ctx, hx, 16, 10, HK.BODY_DK);                           // đầu khổng lồ
  fc(ctx, hx, 16, 8.5, HK.BODY);
  fr(ctx, hx - 9, 6, 18, 4, HK.GOLD); fr(ctx, hx - 9, 6, 18, 1, HK.GOLD_HI); // vương miện
  [-8, -3, 2, 7].forEach((o, i) => {
    const tall = (i === 1 || i === 2) ? 6 : 4;
    fr(ctx, hx + o, 6 - tall, 3, tall, i % 2 ? HK.GOLD : HK.GOLD_HI);
  });
  glow(ctx, HK.GOLD_HI, 3, () => fc(ctx, hx, 2, 1.6, HK.GOLD_HI));
  fr(ctx, hx - 5, 20, 10, 3, HK.OL);                         // gầm gừ
  for (let i = 0; i < 4; i++) fr(ctx, hx - 4 + i * 2.5, 20, 1, 2, HK.BONE);
  glow(ctx, HK.EYE_GLOW, 6, () => { fc(ctx, hx - 4, 15, 2.8, HK.EYE); fc(ctx, hx + 4, 15, 2.8, HK.EYE); });
  fc(ctx, hx - 4, 15, 1.3, '#ffffff'); fc(ctx, hx + 4, 15, 1.3, '#ffffff');
}

// ─── GRASS — 4 variations ───────────────────────────────────────────────────────
function drawGrass(ctx, frame) {
  // Màu nền theo frame
  const bases = ['#4a7a3a', '#5a8a4a', '#3a6020', '#4f7d40'];
  fr(ctx, 0, 0, 32, 32, bases[frame]);

  // Pixel tối tạo bóng cỏ
  const darks = '#3a6020';
  const lights = '#6aaa5a';

  if (frame === 0) {
    fr(ctx, 4, 6, 3, 2, darks); fr(ctx, 14, 3, 2, 3, darks);
    fr(ctx, 22, 10, 3, 2, darks); fr(ctx, 8, 18, 2, 3, darks);
    fr(ctx, 26, 20, 3, 2, darks); fr(ctx, 3, 26, 4, 2, darks);
  } else if (frame === 1) {
    fr(ctx, 6, 4, 3, 2, lights); fr(ctx, 18, 8, 2, 3, lights);
    fr(ctx, 10, 16, 3, 2, lights); fr(ctx, 24, 22, 4, 2, lights);
    fr(ctx, 2, 24, 3, 2, darks); fr(ctx, 20, 2, 2, 3, darks);
  } else if (frame === 2) {
    fr(ctx, 5, 8, 4, 2, lights); fr(ctx, 20, 5, 2, 4, lights);
    fr(ctx, 12, 20, 3, 2, lights); fr(ctx, 27, 14, 3, 2, darks);
    fr(ctx, 8, 27, 4, 2, darks);
  } else {
    fr(ctx, 10, 5, 3, 2, darks); fr(ctx, 3, 14, 2, 3, darks);
    fr(ctx, 22, 18, 3, 2, darks); fr(ctx, 15, 25, 4, 2, lights);
    fr(ctx, 28, 6, 2, 3, lights);
  }
}

// ─── TREE — 48x48 ─────────────────────────────────────────────────────────────
function drawTree(ctx, frame) {
  // Bóng mờ
  ctx.globalAlpha = 0.3;
  fc(ctx, 26, 26, 19, '#000000');
  ctx.globalAlpha = 1;

  // Tán cây ngoài (tối)
  fc(ctx, 24, 24, 20, '#1a4a0a');
  // Tán cây trong (trung)
  fc(ctx, 24, 24, 15, '#2a6a1a');
  // Highlight trên-trái
  fc(ctx, 18, 18, 7, '#4a9a3a');
  fc(ctx, 16, 16, 3, '#6ab84a');

  // Gốc cây nhỏ ở giữa
  fc(ctx, 24, 24, 4, '#5a3010');
  fc(ctx, 23, 23, 2, '#7a4820');

  // Pixel lá lẻ rải quanh viền tán để tạo cảm giác xù xì
  const leafColor = '#2a6a1a';
  fr(ctx, 5, 14, 2, 2, leafColor); fr(ctx, 40, 12, 2, 2, leafColor);
  fr(ctx, 8, 36, 2, 2, leafColor); fr(ctx, 38, 38, 2, 2, leafColor);
  fr(ctx, 4, 22, 2, 3, '#1a4a0a'); fr(ctx, 42, 20, 2, 3, '#1a4a0a');
}

// ─── RUBBLE — đống gạch vụn bê-tông 32×32 (thay đá) ─────────────────────────────
function drawRock(ctx) {
  fc(ctx, 16, 23, 12, 'rgba(0,0,0,0.35)');     // bóng nền
  // các khối bê-tông vỡ
  fr(ctx, 6, 16, 9, 8, '#454a52'); fr(ctx, 6, 16, 9, 2, '#575c64');
  fr(ctx, 15, 18, 8, 8, '#3c414a'); fr(ctx, 15, 18, 8, 2, '#4e535b');
  fr(ctx, 11, 12, 7, 7, '#434851'); fr(ctx, 11, 12, 7, 2, '#555a62');
  fr(ctx, 20, 13, 6, 6, '#383d45'); fr(ctx, 20, 13, 6, 2, '#4a4f57');
  // cọng thép lòi (gỉ)
  ctx.strokeStyle = '#6b4326'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(9, 15); ctx.lineTo(7, 9); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(22, 13); ctx.lineTo(25, 8); ctx.stroke();
  // viền các khối
  ctx.strokeStyle = '#16181c'; ctx.lineWidth = 1;
  ctx.strokeRect(6, 16, 9, 8); ctx.strokeRect(15, 18, 8, 8); ctx.strokeRect(11, 12, 7, 7);
}

// ─── BARREL — thùng phuy 32×32 (frame 0 gỉ, frame 1 độc phát sáng) ──────────────
function drawBarrel(ctx, frame) {
  const toxic = frame === 1;
  fc(ctx, 16, 28, 8, 'rgba(0,0,0,0.35)');       // bóng
  grect(ctx, 9, 7, 14, 22, toxic ? '#3a5a2a' : '#6b4326', toxic ? '#1f3315' : '#3c2616');
  fr(ctx, 9, 12, 14, 2, toxic ? '#2a3f1d' : '#4d3019'); // đai
  fr(ctx, 9, 22, 14, 2, toxic ? '#2a3f1d' : '#4d3019');
  fr(ctx, 12, 9, 2, 18, toxic ? '#28401c' : '#3c2616'); // vệt gỉ dọc
  ctx.fillStyle = toxic ? '#4a7032' : '#7a4e2c';        // nắp trên
  ctx.beginPath(); ctx.ellipse(16, 7, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#100c08'; ctx.lineWidth = 1; ctx.strokeRect(9, 7, 14, 22);
  if (toxic) {
    glow(ctx, '#9bd83a', 5, () => {
      ctx.fillStyle = '#bff05a';
      ctx.beginPath(); ctx.ellipse(16, 7, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
    });
  }
}

// ─── DECAL — vệt phẳng 32×32 (frame 0 máu, frame 1 cháy) — không có physics ──────
function drawDecal(ctx, frame) {
  if (frame === 0) { // máu khô
    fc(ctx, 16, 16, 9, 'rgba(92,12,12,0.5)');
    fc(ctx, 12, 13, 4, 'rgba(70,8,8,0.55)');
    fc(ctx, 21, 19, 3, 'rgba(70,8,8,0.5)');
    fc(ctx, 23, 11, 1.5, 'rgba(82,10,10,0.5)');
    fc(ctx, 9, 22, 1.5, 'rgba(82,10,10,0.5)');
  } else {            // vệt cháy
    fc(ctx, 16, 16, 10, 'rgba(10,8,6,0.55)');
    fc(ctx, 16, 16, 6, 'rgba(4,3,2,0.6)');
    fc(ctx, 11, 12, 2, 'rgba(22,16,10,0.4)');
  }
}

// ─── WATER — 48x48 ────────────────────────────────────────────────────────────
function drawWater(ctx, frame) {
  ctx.globalAlpha = 0.75;

  // Viền nước
  ctx.fillStyle = '#1a3a7a';
  ctx.beginPath();
  ctx.ellipse(24, 24, 22, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Thân nước
  ctx.fillStyle = '#2255aa';
  ctx.beginPath();
  ctx.ellipse(24, 24, 19, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ánh sáng phản chiếu (shimmer dịch theo frame)
  const shimmerX = frame === 0 ? 14 : 16;
  ctx.globalAlpha = 0.9;
  fr(ctx, shimmerX, 18, 5, 2, '#88aaff');
  fr(ctx, shimmerX + 8, 22, 3, 2, '#aaccff');
  fr(ctx, shimmerX - 2, 24, 2, 1, '#aaccff');

  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

// ─── URBAN GROUND — nhựa đường nứt (4 frames: base + nứt + vết dầu + vạch kẻ) ────
function drawAsphalt(ctx, frame) {
  fr(ctx, 0, 0, 32, 32, '#26282C');          // base asphalt tối
  fr(ctx, 0, 0, 16, 16, '#2A2C30');          // khối tông nhẹ
  fr(ctx, 16, 16, 16, 16, '#2A2C30');
  const spk = [[4, 6], [20, 10], [12, 24], [28, 18], [8, 28], [24, 4]];
  spk.forEach(([x, y]) => fr(ctx, x, y, 1, 1, (x + y + frame) % 2 ? '#34373C' : '#1E2024'));
  if (frame === 1) {                          // vết nứt
    ctx.strokeStyle = '#15171A'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(2, 8); ctx.lineTo(12, 14); ctx.lineTo(18, 12); ctx.lineTo(30, 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, 14); ctx.lineTo(14, 26); ctx.stroke();
  } else if (frame === 2) {                    // vết dầu loang
    fc(ctx, 16, 16, 9, 'rgba(8,8,12,0.55)');
    fc(ctx, 13, 14, 4, 'rgba(4,4,7,0.6)');
  } else if (frame === 3) {                    // vạch kẻ đường mờ
    fr(ctx, 13, 0, 5, 32, 'rgba(184,160,86,0.16)');
    fr(ctx, 13, 4, 5, 8, 'rgba(0,0,0,0.18)');
  }
}

// ─── WRECK — xác xe cháy 48×48 (collidable) ──────────────────────────────────────
function drawWreck(ctx) {
  fr(ctx, 7, 9, 38, 33, 'rgba(0,0,0,0.4)');         // bóng đổ
  grect(ctx, 8, 6, 32, 36, '#3A2A26', '#241815');   // thân xe cháy
  fr(ctx, 10, 8, 28, 7, '#33241F');                 // capo
  fr(ctx, 10, 33, 28, 7, '#2C201C');                // cốp
  grect(ctx, 12, 16, 24, 16, '#2A1E1B', '#1A1210'); // khoang cabin
  fr(ctx, 14, 17, 20, 6, '#0A0A0C');                // kính vỡ (lỗ tối)
  fr(ctx, 14, 24, 20, 6, '#0A0A0C');
  fc(ctx, 13, 12, 3, '#5A3A1E');                    // gỉ sét
  fc(ctx, 35, 36, 3, '#5A3A1E');
  fr(ctx, 5, 11, 4, 8, '#101012');                  // bánh xe
  fr(ctx, 39, 11, 4, 8, '#101012');
  fr(ctx, 5, 29, 4, 8, '#101012');
  fr(ctx, 39, 29, 4, 8, '#101012');
  ctx.strokeStyle = '#0A0A0C'; ctx.lineWidth = 1; ctx.strokeRect(8, 6, 32, 36);
  glow(ctx, '#FF6A22', 4, () => fc(ctx, 24, 24, 2, 'rgba(255,120,40,0.55)')); // than hồng âm ỉ
}

// ─── STREETLIGHT — đèn đường 48×48 (collidable ở chân cột) ───────────────────────
function drawStreetlight(ctx) {
  fc(ctx, 24, 34, 9, 'rgba(0,0,0,0.4)');             // bóng chân cột
  fc(ctx, 24, 32, 6, '#3a3e44');                      // bệ bê-tông
  fc(ctx, 24, 32, 4, '#2a2d32');
  grect(ctx, 22, 10, 4, 24, '#565b62', '#33373c');    // cột
  fr(ctx, 22, 10, 13, 3, '#44484e');                  // tay đèn
  grect(ctx, 31, 7, 9, 7, '#666b72', '#3a3e44');      // chụp đèn
  glow(ctx, '#ffd27a', 6, () => fc(ctx, 35, 12, 2.6, '#ffe9b0')); // bóng đèn ấm
  fc(ctx, 35, 12, 1.4, '#fff6db');
}

export function generateAllTextures(scene) {
  // Tất cả model redesign ở 48px (survivor + zombie hung tợn)
  makeAtlas(scene, 'player_ranged',    16, drawGunner, 48, 48);
  makeAtlas(scene, 'player_melee',     16, drawTank, 48, 48);
  makeAtlas(scene, 'player_scientist', 16, drawMedic, 48, 48);
  makeAtlas(scene, 'player_engineer',  16, drawTrapper, 48, 48);

  makeAtlas(scene, 'zombie_walker',   8, drawWalker, 48, 48);
  makeAtlas(scene, 'zombie_runner',   8, drawRunner, 48, 48);
  makeAtlas(scene, 'zombie_brute',    8, drawBrute, 48, 48);
  makeAtlas(scene, 'zombie_spitter',  8, drawSpitter, 48, 48);
  makeAtlas(scene, 'zombie_screamer', 8, drawScreamer, 48, 48);
  makeAtlas(scene, 'zombie_exploder', 8, drawExploder, 48, 48);
  makeAtlas(scene, 'zombie_hordeking', 8, drawHordeking, 48, 48);

  // ─── Decorations ──────────────────────────────────────────────────────────────

  // Cỏ — 4 frames, dùng makeAtlas bình thường (32×32)
  makeAtlas(scene, 'grass', 4, drawGrass);

  // Đá — 1 frame, 32×32 (dùng makeAtlas được)
  makeAtlas(scene, 'rock', 1, drawRock);

  // Nhựa đường — 4 frames (base + nứt + dầu + vạch kẻ)
  makeAtlas(scene, 'asphalt', 4, drawAsphalt);

  // Thùng phuy — 2 frames (gỉ / độc); Decal máu-cháy — 2 frames
  makeAtlas(scene, 'barrel', 2, drawBarrel);
  makeAtlas(scene, 'decal', 2, drawDecal);

  // Xác xe cháy — 48×48, 1 frame
  const wreckCt = scene.textures.createCanvas('wreck', 48, 48);
  drawWreck(wreckCt.getContext('2d'));
  wreckCt.refresh();

  // Đèn đường — 48×48, 1 frame
  const slCt = scene.textures.createCanvas('streetlight', 48, 48);
  drawStreetlight(slCt.getContext('2d'));
  slCt.refresh();

  // Quầng sáng ấm (radial) — dùng cho đèn đường, blend ADD để "rọi" qua bóng đêm
  if (!scene.textures.exists('lightpool')) {
    const lp = 160;
    const lpCt = scene.textures.createCanvas('lightpool', lp, lp);
    const lctx = lpCt.getContext('2d');
    const lg = lctx.createRadialGradient(lp / 2, lp / 2, 6, lp / 2, lp / 2, lp / 2);
    lg.addColorStop(0,   'rgba(255,209,122,0.55)');
    lg.addColorStop(0.5, 'rgba(255,180,80,0.22)');
    lg.addColorStop(1,   'rgba(255,170,70,0)');
    lctx.fillStyle = lg;
    lctx.fillRect(0, 0, lp, lp);
    lpCt.refresh();
  }

  // Cây — 48×48, tạo thủ công (khác kích thước FW/FH)
  const treeCt = scene.textures.createCanvas('tree', 48, 48);
  drawTree(treeCt.getContext('2d'), 0);
  treeCt.refresh();

  // Nước — 48×48, 2 frames shimmer
  const waterCt = scene.textures.createCanvas('water', 96, 48);
  const wCtx = waterCt.getContext('2d');
  wCtx.clearRect(0, 0, 96, 48);
  [0, 1].forEach(i => {
    wCtx.save();
    wCtx.translate(i * 48, 0);
    drawWater(wCtx, i);
    wCtx.restore();
    waterCt.add(i, 0, i * 48, 0, 48, 48);
  });
  waterCt.refresh();
}

export function registerAnims(scene) {
  const dirs = ['down', 'up', 'left', 'right'];

  // Player walk anims (8 fps, 4 frames/dir)
  ['ranged', 'melee', 'scientist', 'engineer'].forEach(cls => {
    dirs.forEach((dir, di) => {
      scene.anims.create({
        key: `player_${cls}_walk_${dir}`,
        frames: scene.anims.generateFrameNumbers(`player_${cls}`, {
          start: di * 4, end: di * 4 + 3
        }),
        frameRate: 8,
        repeat: -1
      });
    });
  });

  // Zombie walk anims (2 frames/dir, variable fps)
  const zFps = {
    walker: 6, runner: 10, brute: 4,
    spitter: 6, screamer: 8, exploder: 4, hordeking: 3
  };
  Object.keys(zFps).forEach(type => {
    dirs.forEach((dir, di) => {
      scene.anims.create({
        key: `zombie_${type}_walk_${dir}`,
        frames: scene.anims.generateFrameNumbers(`zombie_${type}`, {
          start: di * 2, end: di * 2 + 1
        }),
        frameRate: zFps[type],
        repeat: -1
      });
    });
  });
}
