/**
 * Database Module Entry Point
 * 
 * Provides initialization function and clean repository exports.
 */

import { getDb, executeQuery, executeTransaction, closeDatabase } from './database';
import { runMigrations } from './migrations';
import productRepository from './productRepository';
import syncQueueRepository from './syncQueueRepository';

let isInitialized = false;

/**
 * Initialize SQLite database safely and execute migrations
 */
export async function initializeDatabase() {
  if (isInitialized) {
    return true;
  }
  try {
    console.log('[Database] Initializing SQLite database...');
    // Open DB
    getDb();
    // Run schema migrations
    await runMigrations();
    isInitialized = true;
    console.log('[Database] Database initialized and ready.');
    return true;
  } catch (error) {
    console.error('[Database] Initialization error:', error);
    throw error;
  }
}

export {
  getDb,
  executeQuery,
  executeTransaction,
  closeDatabase,
  runMigrations,
  productRepository,
  syncQueueRepository,
};

export default {
  initializeDatabase,
  productRepository,
  syncQueueRepository,
};
