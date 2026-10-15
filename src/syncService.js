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
  getPendingProducts,
  markProductSynced,
  getDeletedProductIds,
  clearDeletedProductId,
} from './database';

// સર્વર કનેક્શન URLs (ADB ટનલ, નવો Wi-Fi IP, જૂનો IP, Emulator)
const CANDIDATE_URLS = [
  'http://localhost:5000',     // ADB reverse પોર્ટ (ફોન માટે સૌથી ફાસ્ટ)
  'http://192.168.1.39:5000',  // કમ્પ્યુટરનો વર્તમાન Wi-Fi IP
  'http://192.168.1.48:5000',  // જૂનો Wi-Fi IP
  'http://10.0.2.2:5000',      // એન્ડ્રોઇડ એમ્યુલેટર
];

let workingUrl = null;

// કયું સર્વર URL ચાલુ છે તે આપોઆપ શોધી લેશે
export async function getWorkingApiUrl() {
  if (workingUrl) return workingUrl;

  for (const url of CANDIDATE_URLS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${url}/api/health`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        workingUrl = url;
        console.log('[Sync] Active server found at:', url);
        return workingUrl;
      }
    } catch (_) {
      // આગળનું URL ટ્રાય કરો
    }
  }

  // જો કોઈ ન મળ્યું તો 192.168.1.39 વાપરો
  return 'http://192.168.1.39:5000';
}

let isSyncing = false;

// ૧. મુખ્ય સિંક ફંક્શન (નવા ઉમેરાયેલા અને ડિલીટ થયેલા બંને ડેટા સિંક કરે છે)
export async function syncData() {
  if (isSyncing) return { success: false, reason: 'already_syncing' };

  // નેટ ચેક કરો
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    console.log('[Sync] Device is offline. Skipping sync.');
    return { success: false, reason: 'offline' };
  }

  // પેન્ડિંગ અને ડિલીટ થયેલા આઈડી લાવો
  const pending = await getPendingProducts();
  const deletedIds = await getDeletedProductIds();

  if ((!pending || pending.length === 0) && (!deletedIds || deletedIds.length === 0)) {
    console.log('[Sync] Everything is already in sync.');
    return { success: true, count: 0, removedCount: 0 };
  }

  isSyncing = true;
  console.log(`[Sync] Syncing ${pending?.length || 0} products, deleting ${deletedIds?.length || 0} from MongoDB...`);

  try {
    const apiUrl = await getWorkingApiUrl();
    console.log(`[Sync] Connecting to: ${apiUrl}/api/sync`);

    const response = await fetch(`${apiUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        products: pending || [],
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
      };
    }
    return { success: false, error: 'Failed to sync' };
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
