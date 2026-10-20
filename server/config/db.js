const mongoose = require('mongoose');

const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

let listenersAttached = false;

const attachConnectionListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('disconnected', () => {
    console.warn('[Database] MongoDB disconnected. Mongoose will attempt to reconnect automatically.');
  });
  mongoose.connection.on('reconnected', () => {
    console.log('[Database] MongoDB reconnected.');
  });
  mongoose.connection.on('error', (err) => {
    console.error('[Database] MongoDB connection error:', err.message);
  });
};

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!uri) {
    if (isProduction) {
      throw new Error('MONGODB_URI is required in production. Refusing to start with local file storage.');
    }
    console.log('[Database] No MONGODB_URI provided. Using local persistent file storage (development only).');
    return { connected: false, mode: 'local' };
  }

  try {
    const conn = await mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB_NAME || 'testcraft',
      // Fail fast instead of hanging requests for minutes during cold starts.
      serverSelectionTimeoutMS: toInt(process.env.MONGO_SELECTION_TIMEOUT_MS, 8000),
      connectTimeoutMS: toInt(process.env.MONGO_CONNECT_TIMEOUT_MS, 10000),
      socketTimeoutMS: toInt(process.env.MONGO_SOCKET_TIMEOUT_MS, 45000),
      // Reuse a bounded connection pool across requests (default is 100).
      maxPoolSize: toInt(process.env.MONGO_MAX_POOL_SIZE, 10),
      minPoolSize: toInt(process.env.MONGO_MIN_POOL_SIZE, 0),
      maxIdleTimeMS: toInt(process.env.MONGO_MAX_IDLE_MS, 60000),
      // Do not queue operations forever when the cluster is unreachable.
      bufferCommands: true,
      bufferTimeoutMS: toInt(process.env.MONGO_BUFFER_TIMEOUT_MS, 8000),
      retryWrites: true,
      autoIndex: false,
    });

    attachConnectionListeners();
    console.log(`[Database] MongoDB Atlas Connected: ${conn.connection.host}/${conn.connection.name}`);
    return { connected: true, mode: 'mongodb' };
  } catch (error) {
    if (isProduction) {
      // Falling back to the local JSON store in production would silently split data
      // and make user-generated papers disappear on the next deploy.
      throw new Error(`MongoDB connection failed: ${error.message}`);
    }
    console.warn(
      `[Database] MongoDB connection error: ${error.message}. Gracefully falling back to local persistent storage (development only).`
    );
    return { connected: false, mode: 'local', error: error.message };
  }
};

module.exports = connectDB;
