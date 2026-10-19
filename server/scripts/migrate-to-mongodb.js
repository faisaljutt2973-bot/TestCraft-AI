require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const STORE_PATH = path.join(__dirname, '..', 'data', 'store.json');
const COLLECTIONS = ['users', 'boards', 'books', 'syllabuses', 'questions', 'testPapers', 'examPlans', 'supportTickets'];

const run = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in server/.env');
  }
  if (!fs.existsSync(STORE_PATH)) {
    throw new Error(`Local store not found at ${STORE_PATH}`);
  }

  const raw = fs.readFileSync(STORE_PATH, 'utf-8');
  const store = JSON.parse(raw);

  const dbName = process.env.MONGODB_DB_NAME || 'testcraft';
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  console.log(`[Migration] Connected to MongoDB database: ${db.databaseName}`);

  for (const name of COLLECTIONS) {
    const docs = Array.isArray(store[name]) ? store[name] : [];
    const collection = db.collection(name);
    const deleted = await collection.deleteMany({});
    if (docs.length) {
      const prepared = docs.map((doc) => {
        const copy = { ...doc };
        if (!copy._id) copy._id = copy.id || new mongoose.Types.ObjectId().toString();
        if (!copy.id) copy.id = copy._id;
        return copy;
      });
      await collection.insertMany(prepared, { ordered: false });
    }
    console.log(`[Migration] ${name}: ${docs.length} documents (cleared ${deleted.deletedCount})`);
  }

  const settings = store.settings || {};
  const now = new Date().toISOString();
  await db.collection('settings').updateOne(
    { _id: 'global' },
    {
      $set: { ...settings, id: 'global', updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );
  console.log('[Migration] settings: 1 document');

  await mongoose.disconnect();
  console.log('[Migration] Completed successfully.');
};

run().catch(async (err) => {
  console.error('[Migration] Failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
