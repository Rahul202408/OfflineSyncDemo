/**
 * Synchronization Queue Repository
 * 
 * Manages pending operations in SQLite for resilient offline-first syncing.
 * All mutations (create, update, delete) are queued here transactionally.
 */

import { executeQuery } from './database';
import { generateUUID } from '../utils/uuid';

/**
 * Add an operation to the sync queue.
 * Can be called with an active transaction context (tx) or standalone.
 */
export async function enqueueOperation(
  { entityId, operationType, payload, operationId = generateUUID() },
  tx = null
) {
  const now = new Date().toISOString();
  const sql = `
    INSERT INTO sync_queue (
      operationId, entityId, operationType, payload, createdAt, retryCount, status
    ) VALUES (?, ?, ?, ?, ?, 0, 'pending');
  `;
  const params = [
    operationId,
    entityId,
    operationType,
    typeof payload === 'object' ? JSON.stringify(payload) : payload,
    now,
  ];

  if (tx) {
    await tx.execute(sql, params);
  } else {
    await executeQuery(sql, params);
  }

  return {
    operationId,
    entityId,
    operationType,
    createdAt: now,
    status: 'pending',
  };
}

/**
 * Get all pending operations waiting to be synchronized,
 * ordered by createdAt ASC so operations are processed chronologically.
 */
export async function getPendingOperations(limit = 50) {
  const sql = `
    SELECT * FROM sync_queue 
    WHERE status IN ('pending', 'failed')
    ORDER BY createdAt ASC 
    LIMIT ?;
  `;
  const result = await executeQuery(sql, [limit]);
  return result.rows.map((row) => ({
    ...row,
    payload: row.payload ? JSON.parse(row.payload) : null,
  }));
}

/**
 * Get all operations in queue (for Sync Activity screen)
 */
export async function getAllQueueOperations() {
  const sql = `
    SELECT q.*, p.name as productName 
    FROM sync_queue q
    LEFT JOIN products p ON q.entityId = p.id
    ORDER BY q.createdAt DESC;
  `;
  const result = await executeQuery(sql);
  return result.rows.map((row) => ({
    ...row,
    payload: row.payload ? JSON.parse(row.payload) : null,
  }));
}

/**
 * Mark operation as syncing (in-flight)
 */
export async function markOperationSyncing(operationId) {
  const now = new Date().toISOString();
  const sql = `
    UPDATE sync_queue 
    SET status = 'syncing', lastAttemptAt = ? 
    WHERE operationId = ?;
  `;
  await executeQuery(sql, [now, operationId]);
}

/**
 * Mark operation as successfully synced
 */
export async function markOperationSynced(operationId) {
  const now = new Date().toISOString();
  const sql = `
    UPDATE sync_queue 
    SET status = 'synced', lastError = NULL, lastAttemptAt = ? 
    WHERE operationId = ?;
  `;
  await executeQuery(sql, [now, operationId]);
}

/**
 * Record a synchronization error and increment retry count
 */
export async function recordSyncError(operationId, errorMessage) {
  const now = new Date().toISOString();
  const sql = `
    UPDATE sync_queue 
    SET status = 'failed', 
        lastError = ?, 
        retryCount = retryCount + 1, 
        lastAttemptAt = ? 
    WHERE operationId = ?;
  `;
  await executeQuery(sql, [errorMessage, now, operationId]);
}

/**
 * Reset all failed operations back to pending for manual retry
 */
export async function retryAllFailedOperations() {
  const sql = `
    UPDATE sync_queue 
    SET status = 'pending', lastError = NULL 
    WHERE status = 'failed';
  `;
  const result = await executeQuery(sql);
  return result.rowsAffected;
}

/**
 * Reset a single operation to pending for retry
 */
export async function retryOperation(operationId) {
  const sql = `
    UPDATE sync_queue 
    SET status = 'pending', lastError = NULL 
    WHERE operationId = ?;
  `;
  const result = await executeQuery(sql, [operationId]);
  return result.rowsAffected;
}

/**
 * Get queue metrics for dashboard
 */
export async function getQueueStats() {
  const sql = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'synced' THEN 1 ELSE 0 END) as synced,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'syncing' THEN 1 ELSE 0 END) as syncing,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM sync_queue;
  `;
  const result = await executeQuery(sql);
  const row = result.rows[0] || {};
  return {
    total: row.total || 0,
    synced: row.synced || 0,
    pending: row.pending || 0,
    syncing: row.syncing || 0,
    failed: row.failed || 0,
  };
}

export default {
  enqueueOperation,
  getPendingOperations,
  getAllQueueOperations,
  markOperationSyncing,
  markOperationSynced,
  recordSyncError,
  retryAllFailedOperations,
  retryOperation,
  getQueueStats,
};
