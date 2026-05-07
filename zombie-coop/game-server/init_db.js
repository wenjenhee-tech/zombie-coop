const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Đổi URI này nếu bạn dùng MongoDB Atlas hoặc port khác
const MONGO_URI = 'mongodb://127.0.0.1:27017/zombie_coop'; 

async function setupDatabase() {
  try {
    console.log('Đang kết nối tới MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Kết nối MongoDB thành công!');

    const db = mongoose.connection.db;
    
    // Đọc file game_schema.json
    const schemaPath = path.join(__dirname, 'database/game_schema.json');
    const schemas = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

    for (const schemaDef of schemas) {
      const collectionName = schemaDef.collection;
      console.log(`\n📦 Đang xử lý collection: ${collectionName}...`);

      // Kiểm tra xem collection đã tồn tại chưa
      const collections = await db.listCollections({ name: collectionName }).toArray();
      
      if (collections.length === 0) {
        // Tạo mới collection kèm validation
        await db.createCollection(collectionName, {
          validator: schemaDef.validation
        });
        console.log(` ↳ Đã tạo collection mới kèm validation rule.`);
      } else {
        // Cập nhật validation cho collection đã tồn tại (giống như dán vào tab Validation trong MongoDB Compass)
        await db.command({
          collMod: collectionName,
          validator: schemaDef.validation
        });
        console.log(` ↳ Đã cập nhật (apply) validation rule vào collection hiện tại.`);
      }

      // Tạo Indexes
      if (schemaDef.indexes && schemaDef.indexes.length > 0) {
        for (const indexDef of schemaDef.indexes) {
          try {
            await db.collection(collectionName).createIndex(indexDef.keys, indexDef.options);
          } catch (idxErr) {
            console.log(` ↳ Lỗi khi tạo index:`, idxErr.message);
          }
        }
        console.log(` ↳ Đã tạo ${schemaDef.indexes.length} indexes.`);
      }
    }

    console.log('\n🎉 Hoàn tất nạp schema validation và indexes vào MongoDB!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  }
}

setupDatabase();
