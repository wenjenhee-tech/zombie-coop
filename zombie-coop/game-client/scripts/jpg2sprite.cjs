// JPG (nền đặc) → PNG sprite trong suốt: tách nền bằng flood-fill từ viền, cắt sát,
// thu nhỏ trung-bình-khối để khử nhiễu JPG. Dùng: node scripts/jpg2sprite.cjs <in.jpg> <out.png> [targetMax=64] [tol=52]
const fs = require('fs');
const path = require('path');
const jpeg = require('jpeg-js');
const { PNG } = require('pngjs');

const inPath = process.argv[2], outPath = process.argv[3];
const TARGET = parseInt(process.argv[4] || '64', 10);
const TOL = parseInt(process.argv[5] || '52', 10);
if (!inPath || !outPath) { console.error('usage: jpg2sprite <in.jpg> <out.png> [targetMax] [tol]'); process.exit(1); }

const raw = jpeg.decode(fs.readFileSync(inPath), { useTArray: true });
const W = raw.width, H = raw.height, d = raw.data; // RGBA
console.log(`JPG: ${W}x${H}`);

const px = (x, y) => (y * W + x) * 4;
// màu nền tham chiếu = trung bình 4 góc
let br=0,bg=0,bb=0;
for (const [x,y] of [[0,0],[W-1,0],[0,H-1],[W-1,H-1]]) { const p=px(x,y); br+=d[p];bg+=d[p+1];bb+=d[p+2]; }
br/=4; bg/=4; bb/=4;
console.log(`bg ~ rgb(${br|0},${bg|0},${bb|0}) tol=${TOL}`);
const near = (p) => Math.hypot(d[p]-br, d[p+1]-bg, d[p+2]-bb) < TOL;

// flood-fill từ mọi pixel viền
const isBg = new Uint8Array(W*H);
const stack = [];
for (let x=0;x<W;x++){ stack.push(x,0); stack.push(x,H-1); }
for (let y=0;y<H;y++){ stack.push(0,y); stack.push(W-1,y); }
while (stack.length) {
  const y = stack.pop(), x = stack.pop();
  if (x<0||y<0||x>=W||y>=H) continue;
  const idx = y*W+x;
  if (isBg[idx]) continue;
  if (!near(px(x,y))) continue;
  isBg[idx] = 1;
  stack.push(x+1,y, x-1,y, x,y+1, x,y-1);
}

// bbox phần giữ lại
let minX=W,minY=H,maxX=0,maxY=0,cnt=0;
for (let y=0;y<H;y++) for (let x=0;x<W;x++) if (!isBg[y*W+x]) {
  cnt++; if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y;
}
const cw=maxX-minX+1, ch=maxY-minY+1;
console.log(`kept ${cnt}px  bbox ${cw}x${ch}`);

// thu nhỏ trung-bình-khối
const scale = TARGET / Math.max(cw, ch);
const fw = Math.max(1, Math.round(cw*scale)), fh = Math.max(1, Math.round(ch*scale));
const bx = cw/fw, by = ch/fh;
console.log(`out ${fw}x${fh} (scale ${scale.toFixed(3)})`);
const out = new PNG({ width: fw, height: fh });
for (let oy=0; oy<fh; oy++) for (let ox=0; ox<fw; ox++) {
  let r=0,g=0,b=0,n=0,tot=0;
  const sx0=minX+Math.floor(ox*bx), sx1=minX+Math.floor((ox+1)*bx);
  const sy0=minY+Math.floor(oy*by), sy1=minY+Math.floor((oy+1)*by);
  for (let sy=sy0; sy<Math.max(sy0+1,sy1); sy++) for (let sx=sx0; sx<Math.max(sx0+1,sx1); sx++) {
    tot++; if (isBg[sy*W+sx]) continue; const p=px(sx,sy); r+=d[p];g+=d[p+1];b+=d[p+2];n++;
  }
  const o=(oy*fw+ox)*4;
  if (n > tot*0.4) { out.data[o]=r/n|0; out.data[o+1]=g/n|0; out.data[o+2]=b/n|0; out.data[o+3]=255; }
  else { out.data[o]=out.data[o+1]=out.data[o+2]=out.data[o+3]=0; }
}
fs.mkdirSync(path.dirname(outPath), { recursive: true });
out.pack().pipe(fs.createWriteStream(outPath)).on('finish', () =>
  console.log(`✓ wrote ${outPath}  ${fw}x${fh}`));
