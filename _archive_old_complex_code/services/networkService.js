/**
 * Network Connectivity Service
 * 
 * Monitors device internet connectivity using @react-native-community/netinfo.
 * Provides real-time network status and reconnect notifications.
 */

import NetInfo from '@react-native-community/netinfo';

let currentNetworkState = {
  isConnected: false,
  isInternetReachable: false,
  type: 'none',
};

const listeners = new Set();

/**
 * Initialize network monitoring listener
 */
export function initNetworkService() {
  // Subscribe to NetInfo state updates
  const unsubscribe = NetInfo.addEventListener((state) => {
    const wasOffline = !currentNetworkState.isConnected;
    
    currentNetworkState = {
      isConnected: Boolean(state.isConnected),
      isInternetReachable: Boolean(state.isInternetReachable ?? state.isConnected),
      type: state.type || 'unknown',
    };

    console.log(
      `[NetworkService] Status changed: Connected=${currentNetworkState.isConnected}, Reachable=${currentNetworkState.isInternetReachable}, Type=${currentNetworkState.type}`
    );

    // Notify all registered listeners
    listeners.forEach((listener) => {
      try {
        listener(currentNetworkState, { wasOffline });
      } catch (err) {
        console.error('[NetworkService] Listener error:', err);
      }
    });
  });

  // Query current initial state
  NetInfo.fetch().then((state) => {
    currentNetworkState = {
      isConnected: Boolean(state.isConnected),
      isInternetReachable: Boolean(state.isInternetReachable ?? state.isConnected),
      type: state.type || 'unknown',
    };
  });

  return unsubscribe;
}

/**
 * Get the current instantaneous network status
 */
export function getNetworkStatus() {
  return currentNetworkState;
}

/**
 * Helper to check if device is currently online
 */
export function isOnline() {
  return Boolean(currentNetworkState.isConnected);
}

/**
 * Subscribe to network connectivity changes
 * 
 * @param {Function} callback - function(networkState, { wasOffline })
 * @returns {Function} unsubscribe function
 */
export function subscribeToNetwork(callback) {
  listeners.add(callback);
  // Immediately call with current known state
  callback(currentNetworkState, { wasOffline: false });
  return () => {
    listeners.delete(callback);
  };
}

export default {
  initNetworkService,
  getNetworkStatus,
  isOnline,
  subscribeToNetwork,
};
