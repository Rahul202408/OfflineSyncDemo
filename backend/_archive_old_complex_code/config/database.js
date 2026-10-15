/**
 * MongoDB Database Connection Manager
 * 
 * Attempts to connect to local MongoDB or MongoDB Atlas.
 * If local MongoDB is not running (ECONNREFUSED), it automatically launches
 * an embedded in-memory MongoDB server (mongodb-memory-server) so that
 * synchronization works 100% out of the box without manual DB setup!
 */

const mongoose = require('mongoose');

let mongoMemoryServer = null;

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/offline_sync_demo';

  try {
    console.log(`[MongoDB] Connecting to: ${uri}...`);
    
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2500, // Quick 2.5s check for local Mongo
    });

    console.log('====================================================');
    console.log('[MongoDB] Connected successfully to primary MongoDB.');
    console.log('====================================================');

    setupEvents();
    return mongoose.connection;
  } catch (error) {
    console.warn(`[MongoDB] Primary connection (${uri}) unavailable: ${error.message}`);
    
    // Automatic fallback: Launch embedded in-memory MongoDB server!
    try {
      console.log('[MongoDB] Starting automatic embedded MongoDB instance (mongodb-memory-server)...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongoMemoryServer = await MongoMemoryServer.create();
      const memoryUri = mongoMemoryServer.getUri();

      console.log(`[MongoDB] Embedded MongoDB ready at: ${memoryUri}`);
      await mongoose.connect(memoryUri);

      console.log('====================================================');
      console.log('✅ [MongoDB] Embedded MongoDB is ONLINE & CONNECTED!');
      console.log('✅ All online product sync operations are active.');
      console.log('====================================================');

      setupEvents();
      return mongoose.connection;
    } catch (memErr) {
      console.error('[MongoDB] Embedded MongoDB fallback error:', memErr.message);
      console.warn('[MongoDB] Backend running in offline-only fallback mode.');
    }
  }
}

function setupEvents() {
  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] Connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Disconnected from MongoDB.');
  });
}

async function disconnectDB() {
  try {
    await mongoose.disconnect();
    if (mongoMemoryServer) {
      await mongoMemoryServer.stop();
      console.log('[MongoDB] Embedded MongoDB stopped.');
    }
    console.log('[MongoDB] Closed MongoDB connection.');
  } catch (err) {
    console.error('[MongoDB] Error during disconnect:', err.message);
  }
}

module.exports = {
  connectDB,
  disconnectDB,
};
