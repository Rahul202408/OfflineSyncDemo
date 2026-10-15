/**
 * API Client Service
 * 
 * Manages HTTP communication between the React Native app and the Node.js backend.
 * Provides timeout protection, configurable base URLs (for Android emulator,
 * physical LAN devices, or production), and standardized error responses.
 */

import { Platform } from 'react-native';

// Default URLs: 192.168.1.48 for physical device on LAN Wi-Fi, 10.0.2.2 for emulator
const DEFAULT_ANDROID_URL = 'http://192.168.1.48:5000';
const DEFAULT_IOS_URL = 'http://localhost:5000';

let apiBaseUrl = Platform.OS === 'android' ? DEFAULT_ANDROID_URL : DEFAULT_IOS_URL;
const REQUEST_TIMEOUT_MS = 6000;

/**
 * Update the API base URL dynamically (e.g., from Settings screen for physical devices)
 */
export function setApiBaseUrl(newUrl) {
  if (newUrl && typeof newUrl === 'string') {
    // Remove trailing slash if present
    apiBaseUrl = newUrl.trim().replace(/\/+$/, '');
    console.log(`[API] Base URL updated to: ${apiBaseUrl}`);
  }
}

/**
 * Get current API base URL
 */
export function getApiBaseUrl() {
  return apiBaseUrl;
}

/**
 * Helper to execute fetch with timeout
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000} seconds`);
    }
    throw error;
  }
}

/**
 * Ping backend health endpoint to check server availability and MongoDB connection
 * 
 * @returns {Promise<{ reachable: boolean, data: object|null, error: string|null }>}
 */
export async function checkServerHealth() {
  const url = `${apiBaseUrl}/api/health`;
  try {
    const response = await fetchWithTimeout(url, { method: 'GET' }, 4000);
    if (!response.ok) {
      return {
        reachable: false,
        data: null,
        error: `Server returned HTTP ${response.status}`,
      };
    }
    const data = await response.json();
    return {
      reachable: true,
      data,
      error: null,
    };
  } catch (error) {
    return {
      reachable: false,
      data: null,
      error: error.message || 'Cannot reach API server',
    };
  }
}

/**
 * Send batch synchronization payload to backend
 * 
 * @param {Array} operations - Array of queued sync operations
 * @returns {Promise<object>} Batch response containing individual operation results
 */
export async function sendBatchSync(operations) {
  const url = `${apiBaseUrl}/api/sync/batch`;
  try {
    console.log(`[API] Sending batch sync of ${operations.length} operations to ${url}...`);
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      body: JSON.stringify({ operations }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Batch sync failed with status ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('[API] Batch sync request error:', error.message);
    throw error;
  }
}

/**
 * Fetch remote products from MongoDB backend (for verification or cloud browsing)
 */
export async function fetchRemoteProducts(params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = `${apiBaseUrl}/api/products${query ? `?${query}` : ''}`;
  try {
    const response = await fetchWithTimeout(url, { method: 'GET' });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Failed to fetch products: ${response.status}`);
    }
    return data;
  } catch (error) {
    console.error('[API] fetchRemoteProducts error:', error.message);
    throw error;
  }
}

export default {
  setApiBaseUrl,
  getApiBaseUrl,
  checkServerHealth,
  sendBatchSync,
  fetchRemoteProducts,
};
