/**
 * SQLite Local Database (Super Simple & Clean)
 * 
 * ફાઇલનું કામ:
 * ૧. initDB() - 'products' અને 'deleted_products' ટેબલ બનાવવું
 * ૨. addProduct() - પ્રોડક્ટને 'pending' સ્ટેટસ સાથે સેવ કરવી
 * ૩. getProducts() - બધી પ્રોડક્ટ્સ વાંચવી
 * ૪. deleteProduct() - ફોનમાંથી ડિલીટ કરવી અને સિંક માટે યાદ રાખવી
 * ૫. getPendingProducts() - જે સિંક નથી થઈ તેવી પ્રોડક્ટ્સ મેળવવી
 * ૬. markProductSynced() - સર્વર પર સિંક થયા પછી સ્ટેટસ 'synced' કરવું
 */

import { open } from '@op-engineering/op-sqlite';

let db = null;

// op-sqlite માંથી rows ને સુરક્ષિત JavaScript Array માં ફેરવવા માટે હેલ્પર
function extractRows(result) {
  if (!result || !result.rows) return [];
  if (Array.isArray(result.rows)) return result.rows;
  if (Array.isArray(result.rows._array)) return result.rows._array;
  return [];
}

// ડેટાબેઝ ખોલવો અને ટેબલ્સ બનાવવા
export async function initDB() {
  if (!db) {
    db = open({ name: 'SimpleOfflineDemo.db' });
  }

  // ૧. પ્રોડક્ટ્સ ટેબલ
  await db.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      syncStatus TEXT DEFAULT 'pending'
    );
  `);

  // ૨. ઑફલાઇન ડિલીટ થયેલી પ્રોડક્ટ્સ માટેનું ટેબલ
  await db.execute(`
    CREATE TABLE IF NOT EXISTS deleted_products (
      id TEXT PRIMARY KEY
    );
  `);

  console.log('[SQLite] Database initialized.');
}

// ૧. નવી પ્રોડક્ટ ઉમેરવી (હંમેશા શરૂઆતમાં 'pending' રહેશે)
export async function addProduct(name, price) {
  const id = Date.now().toString(); // સિમ્પલ યુનિક આઈડી
  await db.execute(
    `INSERT INTO products (id, name, price, syncStatus) VALUES (?, ?, ?, 'pending');`,
    [id, name, Number(price)]
  );
  return { id, name, price: Number(price), syncStatus: 'pending' };
}

// ૨. બધી પ્રોડક્ટ્સ મેળવવી
export async function getProducts() {
  const result = await db.execute(`SELECT * FROM products ORDER BY id DESC;`);
  return extractRows(result);
}

// ૩. પ્રોડક્ટ ડિલીટ કરવી (SQLite માંથી કાઢી નાખવી અને સર્વર સિંક માટે નોંધી લેવી)
export async function deleteProduct(id) {
  await db.execute(`INSERT OR REPLACE INTO deleted_products (id) VALUES (?);`, [id]);
  await db.execute(`DELETE FROM products WHERE id = ?;`, [id]);
}

// ૪. જે પ્રોડક્ટ્સ સિંક થવાની બાકી હોય ('pending') તે મેળવવી
export async function getPendingProducts() {
  const result = await db.execute(`SELECT * FROM products WHERE syncStatus = 'pending';`);
  return extractRows(result);
}

// ૫. સિંક થઈ ગયા પછી સ્ટેટસ 'synced' કરવું
export async function markProductSynced(id) {
  await db.execute(`UPDATE products SET syncStatus = 'synced' WHERE id = ?;`, [id]);
}

// ૬. જે પ્રોડક્ટ્સ સર્વર પરથી ડિલીટ કરવાની બાકી હોય તે મેળવવી
export async function getDeletedProductIds() {
  const result = await db.execute(`SELECT id FROM deleted_products;`);
  const rows = extractRows(result);
  return rows.map((r) => r.id);
}

// ૭. સર્વર પરથી ડિલીટ થઈ ગયા પછી ક્લિયર કરવું
export async function clearDeletedProductId(id) {
  await db.execute(`DELETE FROM deleted_products WHERE id = ?;`, [id]);
}

// ૮. પ્રોડક્ટ અપડેટ કરવી (નામ અને ભાવ બદલવા, સ્ટેટસ પાછું 'pending' કરવું જેથી બેકએન્ડમાં સિંક થાય)
export async function updateProduct(id, name, price) {
  await db.execute(
    `UPDATE products SET name = ?, price = ?, syncStatus = 'pending' WHERE id = ?;`,
    [name, Number(price), id]
  );
  return { id, name, price: Number(price), syncStatus: 'pending' };
}
