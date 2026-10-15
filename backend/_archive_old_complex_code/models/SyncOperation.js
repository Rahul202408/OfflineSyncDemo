/**
 * SyncOperation Mongoose Model (Idempotency Ledger)
 * 
 * Tracks processed sync operations by their unique operationId.
 * Guarantees idempotency so repeated or retransmitted client operations
 * do not produce duplicate entries or redundant updates.
 */

const mongoose = require('mongoose');

const syncOperationSchema = new mongoose.Schema(
  {
    operationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    entityId: {
      type: String,
      required: true,
      index: true,
    },
    operationType: {
      type: String,
      required: true,
      enum: ['create', 'update', 'delete'],
    },
    status: {
      type: String,
      enum: ['processed', 'conflict', 'failed', 'ignored_duplicate'],
      default: 'processed',
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const SyncOperation = mongoose.model('SyncOperation', syncOperationSchema);

module.exports = SyncOperation;
