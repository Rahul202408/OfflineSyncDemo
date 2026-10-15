/**
 * Synchronization Controller
 * 
 * Handles batch synchronization requests from the React Native app.
 * Guarantees idempotency via SyncOperation tracking, manages conflict detection,
 * and returns individual status acknowledgements for each queued operation.
 */

const Product = require('../models/Product');
const SyncOperation = require('../models/SyncOperation');

/**
 * POST /api/sync/batch
 * Process an array of queued operations atomically per-operation
 */
async function processBatchSync(req, res) {
  const { operations } = req.body;

  if (!Array.isArray(operations) || operations.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Body must contain a non-empty "operations" array',
    });
  }

  console.log(`[SyncController] Processing batch of ${operations.length} operations...`);

  const results = [];

  for (const op of operations) {
    const { operationId, entityId, operationType, payload } = op;

    // Validate operation payload structure
    if (!operationId || !entityId || !operationType) {
      results.push({
        operationId: operationId || 'unknown',
        entityId: entityId || 'unknown',
        status: 'failed',
        error: 'Missing required operation fields (operationId, entityId, operationType)',
      });
      continue;
    }

    try {
      // 1. Idempotency Check: Has this operation already been processed?
      const existingOp = await SyncOperation.findOne({ operationId });
      if (existingOp) {
        console.log(`[SyncController] Idempotent hit: operation ${operationId} already processed.`);
        results.push({
          operationId,
          entityId,
          status: 'synced',
          serverId: existingOp.result?.serverId,
          idempotentDuplicate: true,
          message: 'Operation was previously processed successfully.',
        });
        continue;
      }

      // 2. Process according to operationType
      let opResult = null;

      if (operationType === 'create') {
        opResult = await handleCreateOperation(entityId, payload);
      } else if (operationType === 'update') {
        opResult = await handleUpdateOperation(entityId, payload);
      } else if (operationType === 'delete') {
        opResult = await handleDeleteOperation(entityId, payload);
      } else {
        throw new Error(`Unsupported operationType "${operationType}"`);
      }

      // 3. Record operation in SyncOperation ledger for future idempotency
      await SyncOperation.create({
        operationId,
        entityId,
        operationType,
        status: opResult.status === 'conflict' ? 'conflict' : 'processed',
        result: opResult,
      });

      results.push({
        operationId,
        entityId,
        status: opResult.status || 'synced',
        serverId: opResult.serverId,
        conflict: opResult.conflict || false,
        message: opResult.message || 'Successfully synchronized',
      });
    } catch (opError) {
      console.error(`[SyncController] Error processing operation ${operationId}:`, opError.message);
      results.push({
        operationId,
        entityId,
        status: 'failed',
        error: opError.message,
      });
    }
  }

  const successCount = results.filter((r) => r.status === 'synced').length;
  const failureCount = results.filter((r) => r.status === 'failed').length;

  console.log(`[SyncController] Batch complete. Synced: ${successCount}, Failed: ${failureCount}`);

  return res.status(200).json({
    success: true,
    totalCount: operations.length,
    successCount,
    failureCount,
    results,
  });
}

/**
 * Handler for create operations
 */
async function handleCreateOperation(localId, payload) {
  if (!payload || !payload.name) {
    throw new Error('Create payload must contain product name');
  }

  // Check if product with localId already exists
  let product = await Product.findOne({ localId });

  if (product) {
    // If it already exists, update properties (safe upsert)
    product.name = payload.name;
    product.price = Number(payload.price);
    product.quantity = Number(payload.quantity);
    product.description = payload.description || '';
    product.isDeleted = false;
    await product.save();

    return {
      serverId: product._id.toString(),
      status: 'synced',
      message: 'Product updated from create operation',
    };
  }

  // Create new product
  product = new Product({
    localId,
    name: payload.name,
    price: Number(payload.price),
    quantity: Number(payload.quantity),
    description: payload.description || '',
    isDeleted: false,
  });

  await product.save();

  return {
    serverId: product._id.toString(),
    status: 'synced',
    message: 'Product created successfully',
  };
}

/**
 * Handler for update operations with conflict policy
 * 
 * Conflict Policy:
 * Uses Last-Write-Wins based on client updatedAt timestamp vs server updatedAt,
 * while incrementing version number for traceability.
 */
async function handleUpdateOperation(localId, payload) {
  const query = {
    $or: [
      { localId },
      { _id: payload?.serverId && payload.serverId.match(/^[0-9a-fA-F]{24}$/) ? payload.serverId : null },
    ],
  };

  let product = await Product.findOne(query);

  if (!product) {
    // Product not found on server; recreate it safely
    product = new Product({
      localId,
      name: payload.name || 'Restored Product',
      price: Number(payload.price || 0),
      quantity: Number(payload.quantity || 0),
      description: payload.description || '',
      isDeleted: false,
    });
    await product.save();

    return {
      serverId: product._id.toString(),
      status: 'synced',
      message: 'Product restored and created',
    };
  }

  // Check conflict if server product has newer updatedAt
  const clientUpdatedAt = payload.updatedAt ? new Date(payload.updatedAt) : new Date();
  if (product.updatedAt && product.updatedAt > clientUpdatedAt) {
    console.warn(`[SyncController] Conflict detected for product ${localId}: server is newer than incoming update.`);
    // Conflict resolution: Server preserves current data if newer
    return {
      serverId: product._id.toString(),
      status: 'synced',
      conflict: true,
      message: 'Server has newer version; server state preserved.',
    };
  }

  // Apply update
  if (payload.name !== undefined) product.name = payload.name;
  if (payload.price !== undefined) product.price = Number(payload.price);
  if (payload.quantity !== undefined) product.quantity = Number(payload.quantity);
  if (payload.description !== undefined) product.description = payload.description;
  product.version = (product.version || 1) + 1;

  await product.save();

  return {
    serverId: product._id.toString(),
    status: 'synced',
    message: 'Product updated successfully',
  };
}

/**
 * Handler for delete operations
 */
async function handleDeleteOperation(localId, payload) {
  const query = {
    $or: [
      { localId },
      { _id: payload?.serverId && payload.serverId.match(/^[0-9a-fA-F]{24}$/) ? payload.serverId : null },
    ],
  };

  const product = await Product.findOne(query);

  if (product) {
    await Product.deleteOne({ _id: product._id });
    return {
      serverId: product._id.toString(),
      status: 'synced',
      deleted: true,
      message: 'Product permanently removed from server MongoDB',
    };
  }

  // Already deleted or never existed - acknowledge as synced
  return {
    serverId: null,
    status: 'synced',
    deleted: true,
    message: 'Product already deleted or not found on server',
  };
}

module.exports = {
  processBatchSync,
};
