/**
 * Synchronization Service Engine
 * 
 * Coordinates offline-first data synchronization between SQLite and MongoDB.
 * Features:
 * - Deterministic, chronological batch execution
 * - Automatic background sync upon network reconnection
 * - Mutual exclusion (mutex) preventing duplicate concurrent sync runs
 * - Server acknowledgement verification before marking local records synced
 * - Partial batch failure handling (resilience)
 * - Event subscription for UI reactivity
 */

import { getPendingOperations, markOperationSyncing, markOperationSynced, recordSyncError } from '../database/syncQueueRepository';
import { updateProductSyncStatus, purgeDeletedProduct } from '../database/productRepository';
import { sendBatchSync, checkServerHealth } from './api';
import { isOnline, subscribeToNetwork } from './networkService';

let isSyncing = false;
let lastSyncTime = null;
let lastSyncResult = null;
const syncListeners = new Set();

/**
 * Notify all subscribed UI components about sync state changes
 */
function notifyListeners(event, data = {}) {
  const state = getSyncState();
  syncListeners.forEach((listener) => {
    try {
      listener(event, { ...state, ...data });
    } catch (err) {
      console.error('[SyncService] Listener notification error:', err);
    }
  });
}

/**
 * Subscribe to synchronization events
 * 
 * @param {Function} callback - function(event, state)
 * @returns {Function} unsubscribe function
 */
export function subscribeToSync(callback) {
  syncListeners.add(callback);
  // Initial callback with current state
  callback('state_change', getSyncState());
  return () => {
    syncListeners.delete(callback);
  };
}

/**
 * Get current synchronization status and timestamps
 */
export function getSyncState() {
  return {
    isSyncing,
    lastSyncTime,
    lastSyncResult,
  };
}

/**
 * Core Synchronization Routine
 * 
 * Executes the offline-first synchronization workflow:
 * SQLite -> Pending Operations -> REST API Batch -> MongoDB -> ACK -> SQLite Updated
 */
export async function syncNow() {
  // 1. Mutex Check: Prevent concurrent sync processes
  if (isSyncing) {
    console.log('[SyncService] Sync already in progress. Skipping request.');
    return { status: 'already_syncing', message: 'Synchronization is already in progress' };
  }

  // 2. Connectivity Check: Is the device online?
  if (!isOnline()) {
    console.log('[SyncService] Device is offline. Sync deferred.');
    return { status: 'offline', message: 'No internet connection available' };
  }

  // 3. Server Availability Check: Is the backend server reachable?
  const health = await checkServerHealth();
  if (!health.reachable) {
    console.log(`[SyncService] API server unreachable (${health.error}). Sync deferred.`);
    notifyListeners('server_unreachable', { error: health.error });
    return { status: 'server_unreachable', message: `Server unreachable: ${health.error}` };
  }

  // 4. Retrieve pending operations from SQLite in chronological order
  const pendingOps = await getPendingOperations(50);
  if (!pendingOps || pendingOps.length === 0) {
    console.log('[SyncService] No pending operations in queue. SQLite is completely synced.');
    lastSyncTime = new Date().toISOString();
    notifyListeners('up_to_date', { count: 0 });
    return { status: 'up_to_date', count: 0, message: 'All local changes are already synced' };
  }

  // 5. Begin synchronization process
  isSyncing = true;
  notifyListeners('sync_started', { totalPending: pendingOps.length });
  console.log(`[SyncService] Starting sync for ${pendingOps.length} pending operations...`);

  // Mark all operations as 'syncing' locally
  for (const op of pendingOps) {
    await markOperationSyncing(op.operationId);
  }

  try {
    // 6. Submit batch payload to backend REST API
    const response = await sendBatchSync(pendingOps);
    const results = response?.results || [];
    const syncTimestamp = new Date().toISOString();

    let successCount = 0;
    let failureCount = 0;

    // 7. Process individual server acknowledgements
    for (const res of results) {
      const correspondingOp = pendingOps.find((op) => op.operationId === res.operationId);
      const entityId = res.entityId || correspondingOp?.entityId;
      const opType = correspondingOp?.operationType;

      if (res.status === 'synced') {
        successCount++;
        // Mark operation synced in queue
        await markOperationSynced(res.operationId);

        // Update corresponding local product
        if (opType === 'delete') {
          // Permanently purge soft-deleted product from SQLite once server confirms
          await purgeDeletedProduct(entityId);
        } else {
          // Mark product as synced with serverId and timestamp
          await updateProductSyncStatus(entityId, 'synced', res.serverId, syncTimestamp);
        }
      } else {
        failureCount++;
        const errorMsg = res.error || 'Server failed to process operation';
        console.warn(`[SyncService] Operation ${res.operationId} failed on server: ${errorMsg}`);
        
        // Record error and increment retry count in queue
        await recordSyncError(res.operationId, errorMsg);
        // Mark product as failed
        await updateProductSyncStatus(entityId, 'failed');
      }
    }

    lastSyncTime = syncTimestamp;
    lastSyncResult = {
      status: failureCount === 0 ? 'success' : 'partial_success',
      total: pendingOps.length,
      synced: successCount,
      failed: failureCount,
      timestamp: syncTimestamp,
    };

    console.log(
      `[SyncService] Sync finished: ${successCount} synced, ${failureCount} failed.`
    );

    notifyListeners('sync_completed', { summary: lastSyncResult });
    return lastSyncResult;
  } catch (error) {
    console.error('[SyncService] Batch sync request failed:', error.message);

    // Record failure on each attempted operation
    for (const op of pendingOps) {
      await recordSyncError(op.operationId, error.message);
    }

    lastSyncResult = {
      status: 'error',
      total: pendingOps.length,
      synced: 0,
      failed: pendingOps.length,
      error: error.message,
      timestamp: new Date().toISOString(),
    };

    notifyListeners('sync_error', { error: error.message, summary: lastSyncResult });
    return lastSyncResult;
  } finally {
    isSyncing = false;
    notifyListeners('state_change', getSyncState());
  }
}

/**
 * Initialize automatic background sync triggers:
 * 1. Automatically triggers sync when network reconnects (offline -> online transition)
 * 2. Automatically triggers sync when app starts up
 */
export function initSyncService() {
  console.log('[SyncService] Initializing sync service and auto-sync listeners...');

  // Subscribe to network changes
  subscribeToNetwork((networkState, { wasOffline }) => {
    if (networkState.isConnected && wasOffline) {
      console.log('[SyncService] Internet connection restored! Triggering automatic background sync...');
      syncNow();
    }
  });

  // Trigger sync on application startup if online
  if (isOnline()) {
    console.log('[SyncService] App startup: network available. Triggering initial sync...');
    syncNow();
  }
}

export default {
  initSyncService,
  syncNow,
  getSyncState,
  subscribeToSync,
};
