// PNG nền sáng (caro/trắng nướng cứng) → PNG trong suốt: flood-fill xoá nền sáng từ viền,
// cắt sát, thu nhỏ trung-bình-khối. Dùng: node scripts/keysprite.cjs <in.png> <out.png> [targetMax=64] [lumaBg=200]
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const inPath = process.argv[2], outPath = process.argv[3];
const TARGET = parseInt(process.argv[4] || '64', 10);
const LUMA = parseInt(process.argv[5] || '200', 10);
if (!inPath || !outPath) { console.error('usage: keysprite <in.png> <out.png> [targetMax] [lumaBg]'); process.exit(1); }

new PNG().parse(fs.readFileSync(inPath), (err, img) => {
  if (err) { console.error('parse error:', err.message); process.exit(1); }
  const W = img.width, H = img.height, d = img.data;
  console.log(`PNG: ${W}x${H}`);
  const px = (x, y) => (y * W + x) * 4;
  const luma = (p) => (d[p] * 0.299 + d[p+1] * 0.587 + d[p+2] * 0.114);

  // flood-fill từ viền: pixel "sáng" (nền caro/trắng) → trong suốt
  const isBg = new Uint8Array(W * H);
  const st = [];
  for (let x = 0; x < W; x++) { st.push(x, 0, x, H - 1); }
  for (let y = 0; y < H; y++) { st.push(0, y, W - 1, y); }
  while (st.length) {
    const y = st.pop(), x = st.pop();
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const idx = y * W + x;
    if (isBg[idx]) continue;
    if (luma(px(x, y)) < LUMA) continue;     // chạm nhân vật (tối) → dừng
    isBg[idx] = 1;
    st.push(x+1, y, x-1, y, x, y+1, x, y-1);
  }

  // bbox phần giữ lại
  let minX = W, minY = H, maxX = 0, maxY = 0, cnt = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!isBg[y*W+x]) {
    cnt++; if (x<minX)minX=x; if (x>maxX)maxX=x; if (y<minY)minY=y; if (y>maxY)maxY=y;
  }
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  console.log(`kept ${(cnt/(W*H)*100|0)}%  bbox ${cw}x${ch}`);

  // thu nhỏ trung-bình-khối (bỏ pixel nền), alpha = tỉ lệ pixel giữ lại
  const scale = TARGET / Math.max(cw, ch);
  const fw = Math.max(1, Math.round(cw * scale)), fh = Math.max(1, Math.round(ch * scale));
  const bx = cw / fw, by = ch / fh;
  console.log(`out ${fw}x${fh} (scale ${scale.toFixed(3)})`);
  const out = new PNG({ width: fw, height: fh });
  for (let oy = 0; oy < fh; oy++) for (let ox = 0; ox < fw; ox++) {
    let r=0,g=0,b=0,n=0,tot=0;
    const sx0 = minX + Math.floor(ox*bx), sx1 = minX + Math.max(Math.floor(ox*bx)+1, Math.floor((ox+1)*bx));
    const sy0 = minY + Math.floor(oy*by), sy1 = minY + Math.max(Math.floor(oy*by)+1, Math.floor((oy+1)*by));
    for (let sy = sy0; sy < sy1; sy++) for (let sx = sx0; sx < sx1; sx++) {
      tot++; if (isBg[sy*W+sx]) continue; const p = px(sx,sy); r+=d[p];g+=d[p+1];b+=d[p+2];n++;
    }
    const o = (oy*fw+ox)*4;
    if (n > tot*0.4) { out.data[o]=r/n|0; out.data[o+1]=g/n|0; out.data[o+2]=b/n|0; out.data[o+3]=255; }
    else { out.data[o]=out.data[o+1]=out.data[o+2]=0; out.data[o+3]=0; }
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  out.pack().pipe(fs.createWriteStream(outPath)).on('finish', () =>
    console.log(`✓ wrote ${outPath}  ${fw}x${fh}`));
});
