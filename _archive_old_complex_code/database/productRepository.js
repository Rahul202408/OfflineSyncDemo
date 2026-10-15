/**
 * Product Repository
 * 
 * Manages all local SQLite CRUD operations for Products.
 * All mutations (create, update, delete) are executed inside atomic
 * transactions alongside their corresponding sync_queue operations.
 */

import { executeQuery, executeTransaction } from './database';
import { enqueueOperation } from './syncQueueRepository';
import { generateUUID } from '../utils/uuid';
import { validateProduct } from '../utils/validation';

/**
 * Create a new product locally and enqueue a create sync operation.
 * Executed atomically in a transaction.
 */
export async function createProduct(productInput) {
  const validation = validateProduct(productInput);
  if (!validation.isValid) {
    const errorMsg = Object.values(validation.errors).join(', ');
    throw new Error(`Validation failed: ${errorMsg}`);
  }

  const id = generateUUID();
  const now = new Date().toISOString();
  const product = {
    id,
    serverId: null,
    name: productInput.name.trim(),
    price: Number(productInput.price),
    quantity: Number(productInput.quantity),
    description: (productInput.description || '').trim(),
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
    lastSyncAt: null,
    isDeleted: 0,
  };

  await executeTransaction(async (tx) => {
    // 1. Insert product into local SQLite
    const insertSql = `
      INSERT INTO products (
        id, serverId, name, price, quantity, description, 
        createdAt, updatedAt, syncStatus, lastSyncAt, isDeleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    await tx.execute(insertSql, [
      product.id,
      product.serverId,
      product.name,
      product.price,
      product.quantity,
      product.description,
      product.createdAt,
      product.updatedAt,
      product.syncStatus,
      product.lastSyncAt,
      product.isDeleted,
    ]);

    // 2. Enqueue create operation in sync_queue
    await enqueueOperation(
      {
        entityId: product.id,
        operationType: 'create',
        payload: {
          localId: product.id,
          name: product.name,
          price: product.price,
          quantity: product.quantity,
          description: product.description,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        },
      },
      tx
    );
  });

  return product;
}

/**
 * Get all active products with optional search and syncStatus filter
 */
export async function getProducts({ search = '', status = 'all' } = {}) {
  let sql = `
    SELECT * FROM products 
    WHERE isDeleted = 0
  `;
  const params = [];

  if (search && search.trim().length > 0) {
    sql += ` AND (name LIKE ? OR description LIKE ?)`;
    const searchPattern = `%${search.trim()}%`;
    params.push(searchPattern, searchPattern);
  }

  if (status && status !== 'all') {
    sql += ` AND syncStatus = ?`;
    params.push(status);
  }

  sql += ` ORDER BY updatedAt DESC;`;

  const result = await executeQuery(sql, params);
  return result.rows;
}

/**
 * Get single product by local ID
 */
export async function getProductById(id) {
  const sql = `SELECT * FROM products WHERE id = ? LIMIT 1;`;
  const result = await executeQuery(sql, [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Update an existing product and enqueue an update sync operation.
 * Executed atomically in a transaction.
 */
export async function updateProduct(id, changes) {
  const existing = await getProductById(id);
  if (!existing || existing.isDeleted === 1) {
    throw new Error(`Product with ID "${id}" not found.`);
  }

  // Merge changes with existing data to validate
  const merged = {
    name: changes.name !== undefined ? changes.name : existing.name,
    price: changes.price !== undefined ? changes.price : existing.price,
    quantity: changes.quantity !== undefined ? changes.quantity : existing.quantity,
    description: changes.description !== undefined ? changes.description : existing.description,
  };

  const validation = validateProduct(merged);
  if (!validation.isValid) {
    const errorMsg = Object.values(validation.errors).join(', ');
    throw new Error(`Validation failed: ${errorMsg}`);
  }

  const now = new Date().toISOString();
  const updatedProduct = {
    ...existing,
    name: merged.name.trim(),
    price: Number(merged.price),
    quantity: Number(merged.quantity),
    description: (merged.description || '').trim(),
    updatedAt: now,
    syncStatus: 'pending',
  };

  await executeTransaction(async (tx) => {
    // 1. Update product in SQLite
    const updateSql = `
      UPDATE products 
      SET name = ?, price = ?, quantity = ?, description = ?, 
          updatedAt = ?, syncStatus = 'pending'
      WHERE id = ?;
    `;
    await tx.execute(updateSql, [
      updatedProduct.name,
      updatedProduct.price,
      updatedProduct.quantity,
      updatedProduct.description,
      updatedProduct.updatedAt,
      id,
    ]);

    // 2. Enqueue update operation in sync_queue
    await enqueueOperation(
      {
        entityId: id,
        operationType: 'update',
        payload: {
          localId: id,
          serverId: existing.serverId,
          name: updatedProduct.name,
          price: updatedProduct.price,
          quantity: updatedProduct.quantity,
          description: updatedProduct.description,
          updatedAt: updatedProduct.updatedAt,
        },
      },
      tx
    );
  });

  return updatedProduct;
}

/**
 * Delete a product locally and enqueue a delete sync operation.
 * A soft-delete (isDeleted = 1) is used locally until sync is confirmed.
 */
export async function deleteProduct(id) {
  const existing = await getProductById(id);
  if (!existing) {
    throw new Error(`Product with ID "${id}" not found.`);
  }

  const now = new Date().toISOString();

  await executeTransaction(async (tx) => {
    // 1. Mark as deleted locally
    const softDeleteSql = `
      UPDATE products 
      SET isDeleted = 1, syncStatus = 'pending', updatedAt = ? 
      WHERE id = ?;
    `;
    await tx.execute(softDeleteSql, [now, id]);

    // 2. Enqueue delete operation in sync_queue
    await enqueueOperation(
      {
        entityId: id,
        operationType: 'delete',
        payload: {
          localId: id,
          serverId: existing.serverId,
        },
      },
      tx
    );
  });

  return { success: true, id };
}

/**
 * Update sync status and serverId for a product after server acknowledgement
 */
export async function updateProductSyncStatus(id, status, serverId = null, lastSyncAt = null) {
  const syncTime = lastSyncAt || new Date().toISOString();
  let sql = `
    UPDATE products 
    SET syncStatus = ?, lastSyncAt = ?
  `;
  const params = [status, syncTime];

  if (serverId) {
    sql += `, serverId = ?`;
    params.push(serverId);
  }

  sql += ` WHERE id = ?;`;
  params.push(id);

  await executeQuery(sql, params);
}

/**
 * Permanently purge a deleted product once server confirms delete
 */
export async function purgeDeletedProduct(id) {
  const sql = `DELETE FROM products WHERE id = ? AND isDeleted = 1;`;
  await executeQuery(sql, [id]);
}

/**
 * Get product counts for dashboard summary
 */
export async function getProductStats() {
  const sql = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN syncStatus = 'synced' THEN 1 ELSE 0 END) as synced,
      SUM(CASE WHEN syncStatus = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN syncStatus = 'syncing' THEN 1 ELSE 0 END) as syncing,
      SUM(CASE WHEN syncStatus = 'failed' THEN 1 ELSE 0 END) as failed
    FROM products
    WHERE isDeleted = 0;
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
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  updateProductSyncStatus,
  purgeDeletedProduct,
  getProductStats,
};
