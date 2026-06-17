// migrate_class_rename.js
// P1a — Đổi tên 4 class: gunner→ranged, tank→melee, medic→scientist, trapper→engineer.
// Cập nhật dữ liệu CŨ trong MongoDB cho khớp enum mới của game_schema.json.
//
// THỨ TỰ CHẠY:
//   1) node init_db.js          (áp validator enum MỚI lên collection)
//   2) node database/migrate_class_rename.js   (đổi giá trị doc cũ sang tên mới)
//
// An toàn để chạy nhiều lần (idempotent): doc đã đổi rồi sẽ không khớp filter cũ nữa.

const mongoose = require('mongoose');

const MONGO = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/zombie_coop';

const MAP_LC = { gunner: 'ranged', tank: 'melee', medic: 'scientist', trapper: 'engineer' };
const MAP_PC = { Gunner: 'Ranged', Tank: 'Melee', Medic: 'Scientist', Trapper: 'Engineer' };

(async () => {
  await mongoose.connect(MONGO);
  const db = mongoose.connection.db;
  console.log(`🔌 Connected: ${MONGO}`);

  // users.avatar (lowercase)
  for (const [oldV, newV] of Object.entries(MAP_LC)) {
    const r = await db.collection('users').updateMany({ avatar: oldV }, { $set: { avatar: newV } });
    if (r.modifiedCount) console.log(`  users.avatar  ${oldV} → ${newV}: ${r.modifiedCount}`);
  }

  // rooms.players[].class (lowercase) — đổi trong mảng bằng aggregation pipeline
  const roomRes = await db.collection('rooms').updateMany({}, [{
    $set: {
      players: {
        $map: {
          input: '$players', as: 'p',
          in: {
            $mergeObjects: ['$$p', {
              class: {
                $switch: {
                  branches: Object.entries(MAP_LC).map(([o, n]) => ({ case: { $eq: ['$$p.class', o] }, then: n })),
                  default: '$$p.class'
                }
              }
            }]
          }
        }
      }
    }
  }]);
  console.log(`  rooms (players[].class) docs touched: ${roomRes.modifiedCount}`);

  // scores.playerClass (cả lowercase lẫn PascalCase lịch sử)
  for (const [oldV, newV] of [...Object.entries(MAP_LC), ...Object.entries(MAP_PC)]) {
    const r = await db.collection('scores').updateMany({ playerClass: oldV }, { $set: { playerClass: newV } });
    if (r.modifiedCount) console.log(`  scores.playerClass  ${oldV} → ${newV}: ${r.modifiedCount}`);
  }

  console.log('✅ Class-rename migration done.');
  await mongoose.disconnect();
})().catch(e => { console.error('❌ migration error:', e); process.exit(1); });
