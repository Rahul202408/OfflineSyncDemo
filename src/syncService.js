/**
 * Simple Offline Sync Service
 * 
 * આ ફાઇલનું કામ:
 * ૧. નેટવર્ક ચેક કરવું (Online કે Offline?)
 * ૨. SQLite માંથી પેન્ડિંગ પ્રોડક્ટ્સ ઉપાડીને સર્વર પર મોકલવી
 * ૩. ઑફલાઇન ડિલીટ થયેલી પ્રોડક્ટ્સને સર્વર પરથી પણ ડિલીટ કરાવવી
 * ૪. સર્વર 'OK' કહે એટલે SQLite અપડેટ કરવું
 * ૫. નેટ પાછું આવે ત્યારે ઓટોમેટિક સિંક કરવું
 */

import NetInfo from '@react-native-community/netinfo';
import {
  getProducts,
  getPendingProducts,
  markProductSynced,
  getDeletedProductIds,
  clearDeletedProductId,
} from './database';

// સર્વર કનેક્શન URLs (ADB ટનલ, નવો Wi-Fi IP, જૂનો IP, Emulator)
const CANDIDATE_URLS = [
  'http://localhost:5000',     // ADB reverse પોર્ટ (USB / Wi-Fi ADB દ્વારા સૌથી ફાસ્ટ)
  'http://192.168.1.54:5000',  // કમ્પ્યુટરનો વર્તમાન Wi-Fi IP
  'http://192.168.1.39:5000',  // અગાઉનો Wi-Fi IP
  'http://192.168.1.48:5000',  // જૂનો Wi-Fi IP
  'http://10.0.2.2:5000',      // એન્ડ્રોઇડ એમ્યુલેટર
];

let workingUrl = null;

// કયું સર્વર URL ચાલુ છે તે સમાંતર (Parallel) ઝડપથી શોધી લેશે
export async function getWorkingApiUrl() {
  if (workingUrl) {
    // પહેલાંથી મળેલો URL હજી કામ કરે છે કે નહીં તે ક્વિક ચેક કરો
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(`${workingUrl}/api/health`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) return workingUrl;
    } catch (_) {
      workingUrl = null;
    }
  }

  // બધા ઉમેદવાર URLs ને એકસાથે પિંગ કરો (જે સૌથી પહેલા જવાબ આપશે તે સિલેક્ટ થશે)
  const probe = (url) =>
    new Promise(async (resolve, reject) => {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
        reject(new Error('Timeout'));
      }, 1800);

      try {
        const res = await fetch(`${url}/api/health`, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          resolve(url);
        } else {
          reject(new Error(`Status ${res.status}`));
        }
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });

  try {
    const activeUrl = await Promise.any(CANDIDATE_URLS.map(probe));
    workingUrl = activeUrl;
    console.log('[Sync] Active server found at:', workingUrl);
    return workingUrl;
  } catch (err) {
    console.warn('[Sync] No candidate server responded');
    return null;
  }
}

let isSyncing = false;

// ૧. મુખ્ય સિંક ફંક્શન (નવા ઉમેરાયેલા અને ડિલીટ થયેલા બંને ડેટા સિંક કરે છે)
export async function syncData(options = {}) {
  const forceAll = options?.forceAll || false;
  if (isSyncing) return { success: false, reason: 'already_syncing' };

  // સર્વર શોધો (ADB reverse અથવા Wi-Fi LAN)
  const apiUrl = await getWorkingApiUrl();
  if (!apiUrl) {
    console.log('[Sync] Backend server is unreachable.');
    return { success: false, reason: 'offline' };
  }

  // જો forceAll હોય તો SQLite ની તમામ પ્રોડક્ટ્સ લાવો (જેથી સર્વર રીસ્ટાર્ટ થયું હોય તો પણ બધી પ્રોડક્ટ્સ ફરી MongoDB માં જતી રહે)
  const itemsToSync = forceAll ? await getProducts() : await getPendingProducts();
  const deletedIds = await getDeletedProductIds();

  if ((!itemsToSync || itemsToSync.length === 0) && (!deletedIds || deletedIds.length === 0)) {
    console.log('[Sync] Everything is already in sync.');
    return { success: true, count: 0, removedCount: 0, apiUrl };
  }

  isSyncing = true;
  console.log(`[Sync] Syncing ${itemsToSync?.length || 0} products (forceAll=${forceAll}), deleting ${deletedIds?.length || 0} from MongoDB...`);

  try {
    console.log(`[Sync] Connecting to: ${apiUrl}/api/sync`);

    const response = await fetch(`${apiUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        products: itemsToSync || [],
        deletedIds: deletedIds || [],
      }),
    });

    const data = await response.json();

    if (data.success) {
      // ૧. સેવ થયેલી પ્રોડક્ટ્સને SQLite માં 'synced' કરો
      if (data.syncedIds && Array.isArray(data.syncedIds)) {
        for (const id of data.syncedIds) {
          await markProductSynced(id);
        }
      }

      // ૨. સર્વર પરથી ડિલીટ થયેલી પ્રોડક્ટ્સનું લોકલ રેકોર્ડ ક્લિયર કરો
      if (data.removedIds && Array.isArray(data.removedIds)) {
        for (const id of data.removedIds) {
          await clearDeletedProductId(id);
        }
      }

      console.log(`[Sync] Done! Synced: ${data.syncedIds?.length || 0}, Deleted: ${data.removedIds?.length || 0}`);
      return {
        success: true,
        count: data.syncedIds?.length || 0,
        removedCount: data.removedIds?.length || 0,
        apiUrl,
      };
    }
    return { success: false, error: 'Failed to sync', apiUrl };
  } catch (err) {
    console.warn('[Sync] Server unreachable:', err.message);
    workingUrl = null;
    return { success: false, error: err.message };
  } finally {
    isSyncing = false;
  }
}

// ૨. સર્વર પરથી તરત પ્રોડક્ટ ડિલીટ કરવી
export async function deleteProductFromServer(id) {
  try {
    const apiUrl = await getWorkingApiUrl();
    console.log(`[Sync] Calling DELETE ${apiUrl}/api/products/${id}`);
    const res = await fetch(`${apiUrl}/api/products/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      await clearDeletedProductId(id);
      console.log('[Sync] Product deleted permanently from MongoDB:', id);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[Sync] Failed to delete from server immediately:', err.message);
    return false;
  }
}

// ૩. નેટ આવતાં જ ઓટોમેટિક સિંક શરૂ કરવા માટે લિસનર
export function startAutoSync(onStatusChange) {
  return NetInfo.addEventListener((state) => {
    if (onStatusChange) {
      onStatusChange(Boolean(state.isConnected));
    }
    if (state.isConnected) {
      syncData();
    }
  });
}
