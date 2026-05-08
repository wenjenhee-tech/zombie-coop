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

// ─── walk-offset helpers ─────────────────────────────────────────────────────

// 4-frame walk → [leftLegYOff, rightLegYOff]
function wo4(f) {
  return ([[0,0],[-2,2],[0,0],[2,-2]])[f & 3];
}
// 2-frame walk
function wo2(f) { return f === 0 ? [-2, 1] : [1, -2]; }

// ─── atlas builder ────────────────────────────────────────────────────────────

function makeAtlas(scene, key, nFrames, drawFn) {
  const ct = scene.textures.createCanvas(key, FW * nFrames, FH);
  const ctx = ct.getContext('2d');
  ctx.clearRect(0, 0, FW * nFrames, FH);
  for (let i = 0; i < nFrames; i++) {
    ctx.save();
    ctx.translate(i * FW, 0);
    drawFn(ctx, i);
    ctx.restore();
    ct.add(i, 0, i * FW, 0, FW, FH);
  }
  ct.refresh();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLAYER DRAW FUNCTIONS  (frame = dir*4 + walkFrame)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GUNNER — Blue armor, silver helmet ──────────────────────────────────────
function drawGunner(ctx, frame) {
  const dir = (frame / 4) | 0;
  const [lO, rO] = wo4(frame % 4);

  if (dir === 0) { // DOWN — front view
    fc(ctx, 16, 8, 8, '#858585');
    fc(ctx, 16, 7, 6, '#C0C0C0');
    fc(ctx, 14, 5, 2, '#E0E0E0');       // shine
    fr(ctx,  8,  9, 16, 4, '#1A2E90'); // visor
    fr(ctx,  7, 14,  3, 7, '#2A56AA'); // shoulder L
    fr(ctx, 22, 14,  3, 7, '#2A56AA'); // shoulder R
    fr(ctx, 10, 13, 12, 12, '#3A6FD8'); // torso
    fr(ctx, 12, 14,  8,  3, '#6090E8'); // chest plate
    fr(ctx, 14, 18,  4,  4, '#1E3D7A'); // center detail
    fr(ctx, 10, 25, 12,  2, '#1E3D7A'); // belt
    fr(ctx, 10, 27 + lO, 5, 3, '#16214A');
    fr(ctx, 17, 27 + rO, 5, 3, '#16214A');
    fr(ctx,  9, 30 + lO, 7, 2, '#06061A'); // boot L
    fr(ctx, 16, 30 + rO, 7, 2, '#06061A'); // boot R

  } else if (dir === 1) { // UP — back view
    fc(ctx, 16, 8, 8, '#6E6E6E');
    fc(ctx, 16, 6, 5, '#A0A0A0');
    fr(ctx,  9, 12, 14, 2, '#101C60'); // strap
    fr(ctx,  7, 14,  3, 7, '#2A56AA');
    fr(ctx, 22, 14,  3, 7, '#2A56AA');
    fr(ctx, 10, 13, 12, 12, '#2A5DC8');
    fr(ctx, 12, 15,  8,  6, '#1A3898'); // backpack
    fr(ctx, 13, 22,  6,  2, '#3A70D0'); // backpack stripe
    fr(ctx, 10, 25, 12,  2, '#1E3D7A');
    fr(ctx, 10, 27 + lO, 5, 3, '#16214A');
    fr(ctx, 17, 27 + rO, 5, 3, '#16214A');
    fr(ctx,  9, 30 + lO, 7, 2, '#06061A');
    fr(ctx, 16, 30 + rO, 7, 2, '#06061A');

  } else if (dir === 2) { // LEFT
    fc(ctx, 14, 8, 8, '#858585');
    fc(ctx, 13, 7, 6, '#C0C0C0');
    fr(ctx,  6,  9, 15, 4, '#1A2E90');
    fr(ctx,  6, 14,  4, 8, '#2A56AA'); // fwd shoulder
    fr(ctx, 22, 14,  3, 6, '#2A56AA'); // back shoulder
    fr(ctx,  8, 13, 14, 12, '#3A6FD8');
    fr(ctx,  9, 14,  9,  3, '#6090E8');
    fr(ctx,  8, 25, 14,  2, '#1E3D7A');
    fr(ctx, 11, 27 + lO, 5, 3, '#16214A');
    fr(ctx, 17, 27 + rO, 5, 3, '#16214A');
    fr(ctx, 10, 30 + lO, 7, 2, '#06061A');
    fr(ctx, 16, 30 + rO, 7, 2, '#06061A');

  } else { // RIGHT
    fc(ctx, 18, 8, 8, '#858585');
    fc(ctx, 19, 7, 6, '#C0C0C0');
    fr(ctx, 11,  9, 15, 4, '#1A2E90');
    fr(ctx,  7, 14,  3, 6, '#2A56AA');
    fr(ctx, 22, 14,  4, 8, '#2A56AA');
    fr(ctx, 10, 13, 14, 12, '#3A6FD8');
    fr(ctx, 14, 14,  9,  3, '#6090E8');
    fr(ctx, 10, 25, 14,  2, '#1E3D7A');
    fr(ctx, 10, 27 + lO, 5, 3, '#16214A');
    fr(ctx, 17, 27 + rO, 5, 3, '#16214A');
    fr(ctx,  9, 30 + lO, 7, 2, '#06061A');
    fr(ctx, 16, 30 + rO, 7, 2, '#06061A');
  }
}

// ─── TANK — Red armor, wide, gray shield sides ────────────────────────────────
function drawTank(ctx, frame) {
  const dir = (frame / 4) | 0;
  const [lO, rO] = wo4(frame % 4);
  const isDown = dir === 0;
  const isUp   = dir === 1;

  // Head always large-ish square helmet
  if (isDown) {
    fr(ctx,  6,  4, 20, 10, '#AA1A1A'); // helmet
    fr(ctx,  8,  5, 16,  4, '#CC3333'); // helmet highlight
    fr(ctx,  7,  8, 18,  4, '#5A0000'); // visor slit
    fr(ctx,  8,  9,  4,  2, '#FF4444'); // left eye
    fr(ctx, 20,  9,  4,  2, '#FF4444'); // right eye
  } else if (isUp) {
    fr(ctx,  6,  4, 20, 10, '#881414');
    fr(ctx,  8,  5, 16,  3, '#AA2222');
    fr(ctx,  8, 11,  6,  2, '#5A0000'); // back vents L
    fr(ctx, 18, 11,  6,  2, '#5A0000'); // back vents R
  } else if (dir === 2) { // left
    fr(ctx,  5,  4, 18, 10, '#AA1A1A');
    fr(ctx,  6,  5, 12,  4, '#CC3333');
    fr(ctx,  5,  8, 14,  3, '#5A0000');
    fr(ctx,  6,  9,  3,  2, '#FF4444');
  } else { // right
    fr(ctx,  9,  4, 18, 10, '#AA1A1A');
    fr(ctx, 14,  5, 12,  4, '#CC3333');
    fr(ctx, 13,  8, 14,  3, '#5A0000');
    fr(ctx, 23,  9,  3,  2, '#FF4444');
  }

  // Shield sides + wide body
  fr(ctx,  3, 14,  5, 10, '#9A9A9A'); // shield L
  fr(ctx, 24, 14,  5, 10, '#9A9A9A'); // shield R
  fr(ctx,  4, 14,  2, 10, '#C8C8C8'); // shield highlight L
  fr(ctx, 26, 14,  2, 10, '#C8C8C8'); // shield highlight R
  fr(ctx,  8, 14, 16, 11, '#CC2222'); // torso
  fr(ctx, 10, 15, 12,  4, '#EE4444'); // chest plate
  fr(ctx, 13, 20,  6,  3, '#881111'); // center bolt
  fr(ctx,  8, 25, 16,  2, '#771111'); // belt

  // Legs (short, wide)
  fr(ctx,  9, 27 + lO, 6, 4, '#601010');
  fr(ctx, 17, 27 + rO, 6, 4, '#601010');
  fr(ctx,  8, 30 + lO, 8, 2, '#300808');
  fr(ctx, 16, 30 + rO, 8, 2, '#300808');
}

// ─── MEDIC — White coat, green trim, red cross ────────────────────────────────
function drawMedic(ctx, frame) {
  const dir = (frame / 4) | 0;
  const [lO, rO] = wo4(frame % 4);

  // Head
  if (dir === 0) {
    fc(ctx, 16, 8, 8, '#E0E0E0');
    fc(ctx, 16, 7, 6, '#F5F5F5');
    fr(ctx, 10,  9, 12, 3, '#199944'); // green headband
    fr(ctx,  8, 10, 16, 3, '#CCCCCC'); // under headband
    fr(ctx, 14, 10,  4, 2, '#EE2222'); // cross on headband
  } else if (dir === 1) {
    fc(ctx, 16, 8, 8, '#CECECE');
    fc(ctx, 16, 6, 5, '#E8E8E8');
    fr(ctx, 10, 10, 12, 3, '#158A3C'); // headband back
  } else if (dir === 2) {
    fc(ctx, 14, 8, 8, '#E0E0E0');
    fc(ctx, 13, 7, 6, '#F5F5F5');
    fr(ctx,  8,  9, 13, 3, '#199944');
  } else {
    fc(ctx, 18, 8, 8, '#E0E0E0');
    fc(ctx, 19, 7, 6, '#F5F5F5');
    fr(ctx, 11,  9, 13, 3, '#199944');
  }

  // Shoulders (green trim)
  fr(ctx,  7, 13,  3, 8, '#22AA44');
  fr(ctx, 22, 13,  3, 8, '#22AA44');

  // White coat body
  fr(ctx, 10, 13, 12, 12, '#EEEEEE');
  fr(ctx, 11, 14, 10,  3, '#FFFFFF'); // lapel
  // Red cross chest
  fr(ctx, 14, 17,  4,  8, '#EE2222');
  fr(ctx, 11, 19, 10,  4, '#EE2222');
  // Green trim belt
  fr(ctx, 10, 25, 12,  2, '#22AA44');

  // Legs
  fr(ctx, 10, 27 + lO, 5, 3, '#2A7A44');
  fr(ctx, 17, 27 + rO, 5, 3, '#2A7A44');
  fr(ctx,  9, 30 + lO, 7, 2, '#114422'); // dark green boots
  fr(ctx, 16, 30 + rO, 7, 2, '#114422');
}

// ─── TRAPPER — Orange vest, dark hood, brown bag ──────────────────────────────
function drawTrapper(ctx, frame) {
  const dir = (frame / 4) | 0;
  const [lO, rO] = wo4(frame % 4);

  // Dark hood
  if (dir === 0) {
    fc(ctx, 16, 8, 8, '#5A2808');
    fc(ctx, 16, 6, 6, '#7A3D10');
    fr(ctx,  9, 10, 14, 3, '#3C1A04'); // shadow under hood
    fr(ctx, 12, 11,  8, 3, '#6A3010'); // face (partially hidden)
  } else if (dir === 1) {
    fc(ctx, 16, 7, 8, '#4A2006');
    fc(ctx, 16, 5, 6, '#6A3210');
    fr(ctx,  9, 11, 14, 3, '#3C1A04');
  } else if (dir === 2) {
    fc(ctx, 13, 8, 8, '#5A2808');
    fc(ctx, 12, 6, 6, '#7A3D10');
    fr(ctx,  7, 10, 13, 3, '#3C1A04');
  } else {
    fc(ctx, 19, 8, 8, '#5A2808');
    fc(ctx, 20, 6, 6, '#7A3D10');
    fr(ctx, 12, 10, 13, 3, '#3C1A04');
  }

  // Shoulders
  fr(ctx,  7, 13,  3, 8, '#C4621A');
  fr(ctx, 22, 13,  3, 8, '#C4621A');

  // Orange vest body
  fr(ctx, 10, 13, 12, 12, '#D4722A');
  fr(ctx, 12, 14,  8,  3, '#E8924A'); // highlight
  fr(ctx, 14, 18,  4,  5, '#B85A18'); // center pattern (X trap)
  fr(ctx, 10, 25, 12,  2, '#8B4010'); // belt

  // Brown bag on RIGHT side (dir 0 shows it; dir 2 hides it behind body)
  if (dir !== 2) {
    fr(ctx, 22, 16,  6,  7, '#8B5E2A'); // bag body
    fr(ctx, 23, 17,  4,  5, '#A07040'); // bag highlight
    fr(ctx, 23, 22,  4,  1, '#6A4418'); // bag strap
  }

  // Legs (small, sneaky)
  fr(ctx, 11, 27 + lO, 4, 3, '#5A2A0A');
  fr(ctx, 17, 27 + rO, 4, 3, '#5A2A0A');
  fr(ctx, 10, 30 + lO, 6, 2, '#2C1404');
  fr(ctx, 16, 30 + rO, 6, 2, '#2C1404');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ZOMBIE DRAW FUNCTIONS  (frame = dir*2 + walkFrame)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── WALKER — Green-gray, ragged, blood detail ────────────────────────────────
function drawWalker(ctx, frame) {
  const dir = (frame / 2) | 0;
  const [lO, rO] = wo2(frame % 2);

  // Head
  const hx = dir === 2 ? 12 : dir === 3 ? 18 : 16;
  fc(ctx, hx, 8, 8, '#3A6A2A');
  fc(ctx, hx - 2, 6, 5, '#4A8A3A');
  // Blood splat
  fc(ctx, hx + 3, 5, 3, '#881A1A');
  // Sunken eyes
  fr(ctx, hx - 6,  7, 4, 3, '#1A3A10');
  fr(ctx, hx + 2,  7, 4, 3, '#1A3A10');
  fr(ctx, hx - 5,  8, 2, 2, '#CCCCAA'); // eye whites
  fr(ctx, hx + 3,  8, 2, 2, '#CCCCAA');

  // Ragged body
  fr(ctx,  8, 13, 16, 12, '#3A6A2A');
  fr(ctx,  8, 13,  4, 12, '#2A5A1A'); // left dark strip (ragged)
  fr(ctx, 20, 13,  4, 12, '#2A5A1A'); // right dark strip
  fr(ctx, 10, 15,  3,  4, '#4A8A3A'); // rip highlight L
  fr(ctx, 19, 17,  3,  3, '#4A8A3A'); // rip highlight R
  fr(ctx,  8, 25, 16,  2, '#2A4A18'); // hips

  // Legs (shambling - uneven)
  fr(ctx,  9, 27 + lO, 6, 4, '#2A5A1A');
  fr(ctx, 17, 27 + rO, 5, 4, '#2A5A1A');
  fr(ctx,  8, 30 + lO, 8, 2, '#1A3A10');
  fr(ctx, 16, 30 + rO, 7, 2, '#1A3A10');
}

// ─── RUNNER — Yellow-brown, lean, orange eyes ─────────────────────────────────
function drawRunner(ctx, frame) {
  const dir = (frame / 2) | 0;
  const [lO, rO] = wo2(frame % 2);
  const hx = dir === 2 ? 13 : dir === 3 ? 19 : 16;

  // Small head
  fc(ctx, hx, 8, 6, '#8A6A10');
  fc(ctx, hx - 1, 6, 4, '#B08020');
  // Orange glowing eyes
  fc(ctx, hx - 4, 8, 2.5, '#FF4400');
  fc(ctx, hx + 2, 8, 2.5, '#FF4400');
  fc(ctx, hx - 4, 8, 1.2, '#FFAA00');
  fc(ctx, hx + 2, 8, 1.2, '#FFAA00');

  // Lean body (narrow)
  fr(ctx, 11, 13, 10, 12, '#C8A020');
  fr(ctx, 12, 14,  8,  3, '#E8C040'); // highlight
  fr(ctx, 13, 18,  6,  5, '#A07010'); // dark torso center
  fr(ctx, 11, 25, 10,  2, '#806010'); // belt

  // Speed blur lines (when dir is left/right)
  if (dir === 2) {
    fr(ctx,  2, 16, 8, 1, '#FF6600');
    fr(ctx,  3, 18, 6, 1, '#FF6600');
    fr(ctx,  2, 20, 7, 1, '#FF6600');
  } else if (dir === 3) {
    fr(ctx, 22, 16, 8, 1, '#FF6600');
    fr(ctx, 23, 18, 6, 1, '#FF6600');
    fr(ctx, 23, 20, 7, 1, '#FF6600');
  }

  // Long legs
  fr(ctx, 11, 27 + lO, 4, 4, '#8A6A10');
  fr(ctx, 17, 27 + rO, 4, 4, '#8A6A10');
  fr(ctx, 10, 30 + lO, 6, 2, '#4A3808');
  fr(ctx, 16, 30 + rO, 6, 2, '#4A3808');
}

// ─── BRUTE — Dark purple, very wide, protruding fists ────────────────────────
function drawBrute(ctx, frame) {
  const dir = (frame / 2) | 0;
  const [lO, rO] = wo2(frame % 2);

  // Large head
  fc(ctx, 16, 8, 10, '#4A1A88');
  fc(ctx, 16, 6,  8, '#6622AA');
  fc(ctx, 14, 5,  3, '#8844CC'); // shine
  // Glowing eyes
  fc(ctx,  11, 8, 3, '#CC00FF');
  fc(ctx,  21, 8, 3, '#CC00FF');
  fc(ctx,  11, 8, 1.5, '#FFFFFF');
  fc(ctx,  21, 8, 1.5, '#FFFFFF');
  // Thick brow
  fr(ctx,   7, 6, 7, 3, '#3A0A70');
  fr(ctx,  18, 6, 7, 3, '#3A0A70');

  // Fists protruding on sides
  fc(ctx,  3, 18, 5, '#AA55DD'); // fist L
  fc(ctx, 29, 18, 5, '#AA55DD'); // fist R
  fc(ctx,  3, 18, 3, '#8833BB');
  fc(ctx, 29, 18, 3, '#8833BB');

  // Very wide body
  fr(ctx,  6, 13, 20, 13, '#6622AA');
  fr(ctx,  8, 14, 16,  4, '#8844CC'); // chest highlight
  fr(ctx, 11, 19,  4,  4, '#4A1A88'); // left muscle ridge
  fr(ctx, 17, 19,  4,  4, '#4A1A88'); // right muscle ridge
  fr(ctx,  6, 26, 20,  2, '#3A1166'); // belt

  // Stubby legs
  fr(ctx,  8, 28 + lO, 7, 3, '#3A1166');
  fr(ctx, 17, 28 + rO, 7, 3, '#3A1166');
  fr(ctx,  7, 30 + lO, 8, 2, '#200A44');
  fr(ctx, 17, 30 + rO, 8, 2, '#200A44');
}

// ─── SPITTER — Toxic green, round, acid mouth ─────────────────────────────────
function drawSpitter(ctx, frame) {
  const dir = (frame / 2) | 0;
  const [lO, rO] = wo2(frame % 2);
  const hx = dir === 2 ? 13 : dir === 3 ? 19 : 16;

  // Round head
  fc(ctx, hx, 8, 9, '#157A18');
  fc(ctx, hx, 7, 7, '#22BB22');
  fc(ctx, hx - 3, 5, 3, '#44DD44'); // shine
  // Toxic eyes
  fc(ctx, hx - 4, 8, 3, '#AAFF22');
  fc(ctx, hx + 3, 8, 3, '#AAFF22');
  fc(ctx, hx - 4, 8, 1.5, '#005500');
  fc(ctx, hx + 3, 8, 1.5, '#005500');
  // Acid mouth (wide)
  fr(ctx, hx - 5, 12, 10, 4, '#003300');
  fc(ctx, hx,     14, 3.5, '#88FF00');
  // Acid drip
  fc(ctx, hx - 3, 17, 2, '#AAFF22');
  fc(ctx, hx + 2, 18, 1.5, '#AAFF22');

  // Round body (slightly wider than tall)
  fc(ctx, 16, 20, 9, '#1A8A1A');
  fc(ctx, 16, 20, 7, '#22BB22');
  fr(ctx, 10, 14, 12, 13, '#22BB22'); // rectangular part
  fc(ctx,  9, 20, 3, '#22BB22'); // side bulge L
  fc(ctx, 23, 20, 3, '#22BB22'); // side bulge R
  // Acid sacs on sides
  fc(ctx,  8, 19, 4, '#157A18');
  fc(ctx, 24, 19, 4, '#157A18');

  fr(ctx, 11, 27, 10, 2, '#157A18');

  // Short legs
  fr(ctx, 11, 29 + lO, 4, 3, '#0D5010');
  fr(ctx, 17, 29 + rO, 4, 3, '#0D5010');
  fr(ctx, 10, 31 + lO, 6, 1, '#062808');
  fr(ctx, 16, 31 + rO, 6, 1, '#062808');
}

// ─── SCREAMER — Magenta 8-point star (top-down) ───────────────────────────────
function drawScreamer(ctx, frame) {
  const wf = frame % 2;
  // Star rotates slightly between frames
  const rot = wf === 0 ? 0 : Math.PI / 16;
  const cx = 16, cy = 16, ro = 14, ri = 7;

  // Outer star
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  fstar(ctx, 0, 0, ro, ri, 8, '#882288');
  fstar(ctx, 0, 0, ro - 3, ri + 1, 8, '#CC44CC');
  fstar(ctx, 0, 0, ro - 6, ri + 3, 8, '#FF88FF');
  ctx.restore();

  // Core
  fc(ctx, cx, cy, 6, '#CC44CC');
  fc(ctx, cx, cy, 4, '#FF88FF');
  // Screaming mouth (O)
  fc(ctx, cx, cy + 2, 3, '#110011');
  // Eyes
  fr(ctx, cx - 5, cy - 4, 3, 2, '#110011');
  fr(ctx, cx + 2, cy - 4, 3, 2, '#110011');
}

// ─── EXPLODER — Purple round, glow, timer bar ─────────────────────────────────
function drawExploder(ctx, frame) {
  const wf = frame % 2;
  const pulse = wf === 0 ? 0 : 1; // glow pulse per frame

  // Glow ring
  fc(ctx, 16, 17, 15 + pulse, '#330033');
  fc(ctx, 16, 17, 13 + pulse, '#660066');
  // Body
  fc(ctx, 16, 17, 12, '#7722BB');
  fc(ctx, 16, 17, 10, '#9933CC');
  fc(ctx, 16, 17,  8, '#AA44DD');
  fc(ctx, 14, 15,  4, '#CC77EE'); // shine

  // Danger lines radiating
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x1 = 16 + Math.cos(a) * 8;
    const y1 = 17 + Math.sin(a) * 8;
    const x2 = 16 + Math.cos(a) * (14 + pulse);
    const y2 = 17 + Math.sin(a) * (14 + pulse);
    ctx.strokeStyle = '#FF6600';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Eyes (skull style)
  fc(ctx, 12, 15, 3.5, '#330055');
  fc(ctx, 20, 15, 3.5, '#330055');
  fc(ctx, 12, 15, 2,   '#110022');
  fc(ctx, 20, 15, 2,   '#110022');
  // Grimace
  fr(ctx, 11, 21, 10, 2, '#110022');
  fr(ctx, 12, 20,  2, 2, '#110022');
  fr(ctx, 18, 20,  2, 2, '#110022');

  // Timer bar at top (red, animated)
  fr(ctx,  4, 1, 24, 3, '#440000'); // bar background
  const barW = wf === 0 ? 20 : 14;  // "filling up" effect
  fr(ctx,  4, 1, barW, 3, '#FF2200'); // bar fill
  fr(ctx,  4, 1,  4, 1, '#FF8800'); // highlight left
}

// ─── HORDEKING — Black body, gold crown, red eyes ─────────────────────────────
function drawHordeking(ctx, frame) {
  const dir = (frame / 2) | 0;
  const [lO, rO] = wo2(frame % 2);

  // Gold crown (3 spikes)
  fr(ctx,  6, 5, 20, 6, '#C8A000'); // crown base
  fr(ctx,  8, 6, 16, 4, '#FFD700'); // crown highlight
  // 3 crown spikes
  fr(ctx,  7, 1, 5, 5, '#C8A000');
  fr(ctx, 14, 0, 5, 6, '#FFD700'); // center spike (taller, brighter)
  fr(ctx, 21, 1, 5, 5, '#C8A000');
  fr(ctx,  8, 2, 3, 3, '#FFEE44'); // left spike shine
  fr(ctx, 15, 1, 3, 4, '#FFEE44'); // center spike shine
  fr(ctx, 22, 2, 3, 3, '#FFEE44'); // right spike shine

  // Massive dark head
  fr(ctx,  5, 5, 22, 11, '#0A0A0A');
  fr(ctx,  7, 6, 18,  5, '#1A1A1A'); // face
  // Glowing red eyes
  fc(ctx, 12, 10, 4, '#FF0000');
  fc(ctx, 20, 10, 4, '#FF0000');
  fc(ctx, 12, 10, 2, '#FF8800');
  fc(ctx, 20, 10, 2, '#FF8800');
  fc(ctx, 12, 10, 1, '#FFFFFF');
  fc(ctx, 20, 10, 1, '#FFFFFF');
  // Menacing snarl
  fr(ctx,  9, 13, 14, 2, '#3A0000');
  fr(ctx, 11, 12,  3, 2, '#550000'); // teeth gaps

  // Dark aura on sides
  fr(ctx,  0, 13, 6, 16, '#0D0010');
  fr(ctx, 26, 13, 6, 16, '#0D0010');

  // Very wide body (robe/cloak)
  fr(ctx,  4, 15, 24, 14, '#111111');
  fr(ctx,  6, 16, 20, 10, '#1A1A1A'); // lighter center
  fr(ctx,  9, 17, 14,  6, '#222222'); // robe center
  fr(ctx, 12, 18,  8,  4, '#2A2A2A'); // robe highlight
  // Belt/clasp
  fr(ctx,  4, 29, 24,  2, '#C8A000'); // gold belt

  // Heavy legs
  fr(ctx,  7, 27 + lO, 8, 4, '#080808');
  fr(ctx, 17, 27 + rO, 8, 4, '#080808');
  fr(ctx,  6, 30 + lO, 9, 2, '#040404');
  fr(ctx, 17, 30 + rO, 9, 2, '#040404');
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

// ─── ROCK — 32x32 ─────────────────────────────────────────────────────────────
function drawRock(ctx, frame) {
  // Thân đá
  fr(ctx, 4, 10, 24, 16, '#6a6a6a');
  // Bo góc
  fr(ctx, 6, 8, 20, 18, '#7a7a7a');
  fr(ctx, 8, 7, 16, 19, '#7a7a7a');

  // Highlight trên
  fr(ctx, 8, 8, 16, 3, '#aaaaaa');
  fr(ctx, 6, 11, 4, 2, '#999999');

  // Bóng dưới-phải
  fr(ctx, 8, 23, 16, 3, '#4a4a4a');
  fr(ctx, 22, 12, 4, 10, '#555555');

  // Vết nứt nhỏ
  fr(ctx, 13, 13, 1, 5, '#444444');
  fr(ctx, 14, 17, 3, 1, '#444444');
  fr(ctx, 20, 11, 1, 4, '#555555');
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

export function generateAllTextures(scene) {
  makeAtlas(scene, 'player_gunner',  16, drawGunner);
  makeAtlas(scene, 'player_tank',    16, drawTank);
  makeAtlas(scene, 'player_medic',   16, drawMedic);
  makeAtlas(scene, 'player_trapper', 16, drawTrapper);

  makeAtlas(scene, 'zombie_walker',   8, drawWalker);
  makeAtlas(scene, 'zombie_runner',   8, drawRunner);
  makeAtlas(scene, 'zombie_brute',    8, drawBrute);
  makeAtlas(scene, 'zombie_spitter',  8, drawSpitter);
  makeAtlas(scene, 'zombie_screamer', 8, drawScreamer);
  makeAtlas(scene, 'zombie_exploder', 8, drawExploder);
  makeAtlas(scene, 'zombie_hordeking', 8, drawHordeking);

  // ─── Decorations ──────────────────────────────────────────────────────────────

  // Cỏ — 4 frames, dùng makeAtlas bình thường (32×32)
  makeAtlas(scene, 'grass', 4, drawGrass);

  // Đá — 1 frame, 32×32 (dùng makeAtlas được)
  makeAtlas(scene, 'rock', 1, drawRock);

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
  ['gunner', 'tank', 'medic', 'trapper'].forEach(cls => {
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
