/**
 * Health Check Routes
 * 
 * Provides server health and MongoDB connection status.
 */

const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/', (req, res) => {
  const dbStateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const dbState = mongoose.connection.readyState;
  const dbStatus = dbStateMap[dbState] || 'unknown';

  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: {
      status: dbStatus,
      connected: dbState === 1,
    },
    service: 'OfflineSyncDemo Backend API',
  });
});

module.exports = router;
