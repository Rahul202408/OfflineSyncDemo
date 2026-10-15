/**
 * Synchronization API Routes
 * 
 * Maps POST /api/sync/batch for bulk idempotent sync processing.
 */

const express = require('express');
const syncController = require('../controllers/syncController');

const router = express.Router();

router.post('/batch', syncController.processBatchSync);

module.exports = router;
