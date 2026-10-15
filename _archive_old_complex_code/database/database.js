/**
 * SQLite Database Connection Layer
 * 
 * Manages the SQLite database connection using @op-engineering/op-sqlite.
 * Provides safe query execution with parameterized SQL and transactions.
 */

import { open } from '@op-engineering/op-sqlite';

const DB_NAME = 'OfflineSyncDemo.db';

let dbInstance = null;

/**
 * Get or open the SQLite database instance
 */
export function getDb() {
  if (!dbInstance) {
    try {
      dbInstance = open({
        name: DB_NAME,
      });
      console.log(`[Database] SQLite database opened successfully: ${DB_NAME}`);
    } catch (error) {
      console.error('[Database] Failed to open SQLite database:', error);
      throw new Error(`Database open failed: ${error.message}`);
    }
  }
  return dbInstance;
}

/**
 * Execute a parameterized SQL query safely
 * 
 * @param {string} sql - SQL statement with '?' placeholders
 * @param {Array} params - Array of parameters to bind
 * @returns {Promise<Array>} Array of row objects for SELECT, or query metadata
 */
export async function executeQuery(sql, params = []) {
  const db = getDb();
  try {
    const result = await db.execute(sql, params);
    // Format rows uniformly as an array
    const rows = result?.rows ? (Array.isArray(result.rows) ? result.rows : result.rows._array || []) : [];
    return {
      rows,
      rowsAffected: result?.rowsAffected ?? 0,
      insertId: result?.insertId,
    };
  } catch (error) {
    console.error(`[Database] Error executing query: "${sql}"`, { params, error });
    throw error;
  }
}

/**
 * Execute operations within an atomic SQLite transaction
 * If any operation throws an error, all changes in the transaction are rolled back.
 * 
 * @param {Function} transactionCallback - async function(tx)
 */
export async function executeTransaction(transactionCallback) {
  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      // Wrapper around tx.execute to provide uniform results
      const safeTx = {
        execute: async (sql, params = []) => {
          const res = await tx.execute(sql, params);
          const rows = res?.rows ? (Array.isArray(res.rows) ? res.rows : res.rows._array || []) : [];
          return {
            rows,
            rowsAffected: res?.rowsAffected ?? 0,
            insertId: res?.insertId,
          };
        },
      };
      await transactionCallback(safeTx);
    });
  } catch (error) {
    console.error('[Database] Transaction failed, rolled back:', error);
    throw error;
  }
}

/**
 * Close database connection
 */
export async function closeDatabase() {
  if (dbInstance) {
    try {
      await dbInstance.closeAsync();
      dbInstance = null;
      console.log('[Database] SQLite database connection closed.');
    } catch (error) {
      console.error('[Database] Error closing database:', error);
    }
  }
}

export default {
  getDb,
  executeQuery,
  executeTransaction,
  closeDatabase,
};
