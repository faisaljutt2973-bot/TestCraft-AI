const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('[Database] No MONGODB_URI provided in environment. Utilizing Local Persistent File Storage Engine.');
    return { connected: false, mode: 'local' };
  }

  try {
    const conn = await mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB_NAME || 'testcraft',
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[Database] MongoDB Atlas Connected: ${conn.connection.host}/${conn.connection.name}`);
    return { connected: true, mode: 'mongodb' };
  } catch (error) {
    console.warn(`[Database] MongoDB connection error: ${error.message}. Gracefully falling back to Local Persistent Storage.`);
    return { connected: false, mode: 'local', error: error.message };
  }
};

module.exports = connectDB;
