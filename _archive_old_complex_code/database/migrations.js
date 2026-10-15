/**
 * SQLite Database Migrations & Schema Initialization
 * 
 * Creates and updates tables and indexes safely.
 */

import { executeQuery } from './database';

export async function runMigrations() {
  console.log('[Migrations] Running database migrations...');

  // 1. Create Products Table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      serverId TEXT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      description TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      syncStatus TEXT NOT NULL DEFAULT 'pending',
      lastSyncAt TEXT,
      isDeleted INTEGER NOT NULL DEFAULT 0
    );
  `);

  // 2. Create Products Table Indexes
  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_products_syncStatus ON products(syncStatus);
  `);
  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_products_updatedAt ON products(updatedAt);
  `);
  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_products_isDeleted ON products(isDeleted);
  `);

  // 3. Create Sync Queue Table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      operationId TEXT PRIMARY KEY,
      entityId TEXT NOT NULL,
      operationType TEXT NOT NULL,
      payload TEXT,
      createdAt TEXT NOT NULL,
      retryCount INTEGER NOT NULL DEFAULT 0,
      lastError TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      lastAttemptAt TEXT
    );
  `);

  // 4. Create Sync Queue Table Indexes
  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
  `);
  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_sync_queue_entityId ON sync_queue(entityId);
  `);
  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_sync_queue_createdAt ON sync_queue(createdAt);
  `);

  console.log('[Migrations] Migrations applied successfully.');
}

export default {
  runMigrations,
};
