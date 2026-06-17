// Vẽ vũ khí theo class vào một Phaser.Graphics (forward = +x). Dùng chung cho
// player của mình (Player._redrawWeapon) lẫn người chơi khác (GameScene player_moved),
// tránh nhân đôi code. KHÔNG đụng gameplay — chỉ hình.

function hands(g, foreX, glove = 0x23201b) {
  // 2 bàn tay nắm súng: tay cò (sau) + tay trước giữ nòng — đốm tròn viền tối
  g.fillStyle(0x100d0a, 1);
  g.fillCircle(4, 2.5, 3.6); g.fillCircle(foreX, 0, 3.6);
  g.fillStyle(glove, 1);
  g.fillCircle(4, 2.5, 2.5); g.fillCircle(foreX, 0, 2.5);
}

function muzzleFlash(g, tipX) {
  g.fillStyle(0xfff3b0, 1);   g.fillCircle(tipX + 2, 0, 4.5);
  g.fillStyle(0xffc23a, 0.9); g.fillCircle(tipX + 6, 0, 2.8);
  g.fillStyle(0xff7a1e, 0.75); g.fillTriangle(tipX, -3.5, tipX, 3.5, tipX + 13, 0);
}

// g: Phaser.Graphics đã set position/rotation; cls: 'ranged'|'melee'|'scientist'|'engineer'
export function drawWeapon(g, cls, { active = false, muzzle = false } = {}) {
  g.clear();
  let tip;
  switch (cls) {
    case 'melee': // dao quắm bản rộng (cận chiến) — cán gỗ + lưỡi thép vát
      g.fillStyle(0x3a2416, 1); g.fillRect(-4, -2, 16, 4);          // cán
      g.fillStyle(0x241712, 1); g.fillRect(10, -2.5, 3, 5);        // chắn tay
      g.fillStyle(0x8a929c, 1); g.fillRect(13, -7, 13, 14);        // lưỡi bản rộng
      g.fillStyle(0xccd2d9, 1); g.fillRect(13, -7, 13, 3);         // ánh sáng sống lưỡi
      g.fillStyle(0x6a7079, 1); g.fillTriangle(26, -7, 26, 7, 33, 1); // mũi vát
      g.fillStyle(0x9aa3ad, 1); g.fillTriangle(13, 7, 26, 7, 26, 3);  // bụng lưỡi
      hands(g, 7, 0x2a1a12); tip = 0; break;                        // melee không có muzzle

    case 'scientist': // súng ngắn accent lục y tế
      g.fillStyle(0x222a25, 1); g.fillRect(2, -2.5, 13, 5);
      g.fillStyle(0x161c18, 1); g.fillRect(3, 2, 4, 7);
      g.fillStyle(0x33403a, 1); g.fillRect(15, -1.5, 6, 3);
      g.fillStyle(0x2ecc71, 1); g.fillRect(5, -3.5, 5, 1.5); g.fillCircle(11, 0, 1.4);
      hands(g, 13, 0x1d3a2a); tip = 21; break;

    case 'engineer': // nỏ: cánh nỏ + dây cung + mũi bolt cam
      g.fillStyle(0x4a3a14, 1); g.fillRect(-2, -2, 20, 4);
      g.lineStyle(2.5, 0x6a4a18, 1); g.lineBetween(14, -8, 14, 8);
      g.lineStyle(1, 0xccb98a, 1); g.lineBetween(14, -8, 4, 0); g.lineBetween(14, 8, 4, 0);
      g.fillStyle(0xe67e22, 1); g.fillRect(4, -1, 22, 2);
      g.fillStyle(0xf39c12, 1); g.fillTriangle(26, -2.5, 26, 2.5, 31, 0);
      hands(g, 16, 0x3a2810); tip = 31; break;

    default: { // ranged: súng trường xanh (sáng lên khi Rain of Bullets)
      const body = active ? 0x2a4a6a : 0x1c2c3c;
      const steel = active ? 0x3a6fa0 : 0x24465f;
      const acc = active ? 0x46c8ff : 0x2a93d8;
      g.fillStyle(0x12100d, 1); g.fillRect(-3, -2, 6, 4);
      g.fillStyle(body, 1);     g.fillRect(0, -2.5, 22, 5);
      g.fillStyle(steel, 1);    g.fillRect(9, 2, 5, 7);
      g.fillStyle(steel, 1);    g.fillRect(22, -1.5, 12, 3);
      g.fillStyle(acc, 1);      g.fillRect(6, -3.5, 9, 1.5);
      hands(g, 24); tip = 34; break;
    }
  }
  if (muzzle) muzzleFlash(g, tip);
}
