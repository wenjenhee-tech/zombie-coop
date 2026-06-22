// Tách GIF động → 1 sprite sheet PNG ngang, cắt sát nhân vật + thu nhỏ nearest-neighbor.
// Dùng: node scripts/gif2sheet.cjs <input.gif> <output.png> [targetMax=64]
const fs = require('fs');
const path = require('path');
const { GifReader } = require('omggif');
const { PNG } = require('pngjs');

const inPath = process.argv[2];
const outPath = process.argv[3];
const TARGET = parseInt(process.argv[4] || '64', 10);
if (!inPath || !outPath) { console.error('usage: node gif2sheet.cjs <in.gif> <out.png> [targetMax]'); process.exit(1); }

const buf = fs.readFileSync(inPath);
const reader = new GifReader(buf);
const W = reader.width, H = reader.height, N = reader.numFrames();
console.log(`GIF: ${W}x${H}, ${N} frames`);

// composite tích luỹ (xử lý disposal 2 = xoá vùng frame sau khi chụp)
const canvas = new Uint8Array(W * H * 4);
const frames = [];
for (let i = 0; i < N; i++) {
  const info = reader.frameInfo(i);
  reader.decodeAndBlitFrameRGBA(i, canvas);
  frames.push(Uint8Array.from(canvas));
  if (info.disposal === 2) {
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++) {
        const p = ((info.y + y) * W + (info.x + x)) * 4;
        canvas[p] = canvas[p+1] = canvas[p+2] = canvas[p+3] = 0;
      }
  }
}

// union bbox của pixel không trong suốt (alpha>16) trên MỌI frame
let minX = W, minY = H, maxX = 0, maxY = 0;
for (const fr of frames)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (fr[(y*W+x)*4+3] > 16) {
        if (x<minX)minX=x; if (x>maxX)maxX=x; if (y<minY)minY=y; if (y>maxY)maxY=y;
      }
const cw = maxX - minX + 1, ch = maxY - minY + 1;
console.log(`bbox: x${minX}..${maxX} y${minY}..${maxY} → ${cw}x${ch}`);

// thu nhỏ nearest-neighbor: cạnh dài về TARGET
const scale = TARGET / Math.max(cw, ch);
const fw = Math.max(1, Math.round(cw * scale));
const fh = Math.max(1, Math.round(ch * scale));
console.log(`frame out: ${fw}x${fh} (scale ${scale.toFixed(3)})`);

const sheet = new PNG({ width: fw * N, height: fh });
for (let i = 0; i < N; i++) {
  const fr = frames[i];
  for (let dy = 0; dy < fh; dy++) {
    const sy = minY + Math.min(ch-1, Math.floor(dy / scale));
    for (let dx = 0; dx < fw; dx++) {
      const sx = minX + Math.min(cw-1, Math.floor(dx / scale));
      const src = (sy*W + sx)*4;
      const dst = (dy*(fw*N) + i*fw + dx)*4;
      sheet.data[dst]   = fr[src];
      sheet.data[dst+1] = fr[src+1];
      sheet.data[dst+2] = fr[src+2];
      sheet.data[dst+3] = fr[src+3];
    }
  }
}
fs.mkdirSync(path.dirname(outPath), { recursive: true });
sheet.pack().pipe(fs.createWriteStream(outPath)).on('finish', () =>
  console.log(`✓ wrote ${outPath}  sheet ${fw*N}x${fh}  frame ${fw}x${fh}  frames=${N}`));
