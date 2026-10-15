/**
 * Network & Server Status Banner Component
 * 
 * Displays clear, prominent status messages when the app is operating offline
 * or when the backend server is unreachable.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import colors from '../theme/colors';
import { subscribeToNetwork } from '../services/networkService';
import { checkServerHealth } from '../services/api';

export function NetworkStatusBanner({ onRetry = () => {} } = {}) {
  const [network, setNetwork] = useState({ isConnected: true, type: 'unknown' });
  const [serverReachable, setServerReachable] = useState(true);

  useEffect(() => {
    // 1. Subscribe to network state changes
    const unsubscribeNetwork = subscribeToNetwork((state) => {
      setNetwork(state);
      if (state.isConnected) {
        verifyServer();
      } else {
        setServerReachable(false);
      }
    });

    // 2. Initial server check
    verifyServer();

    // 3. Periodic server check (every 10 seconds)
    const interval = setInterval(verifyServer, 10000);

    return () => {
      unsubscribeNetwork();
      clearInterval(interval);
    };
  }, []);

  const verifyServer = async () => {
    const health = await checkServerHealth();
    setServerReachable(health.reachable);
  };

  // If offline
  if (!network.isConnected) {
    return (
      <View style={[styles.banner, styles.offlineBanner]}>
        <View style={styles.content}>
          <Text style={styles.icon}>⚡</Text>
          <View style={styles.textContainer}>
            <Text style={styles.title}>Offline Mode</Text>
            <Text style={styles.subtitle}>Changes are safely saved in local SQLite database</Text>
          </View>
        </View>
      </View>
    );
  }

  // If online but backend server is unreachable
  if (!serverReachable) {
    return (
      <View style={[styles.banner, styles.serverBanner]}>
        <View style={styles.content}>
          <Text style={styles.icon}>⚠️</Text>
          <View style={styles.textContainer}>
            <Text style={styles.title}>Backend Server Unreachable</Text>
            <Text style={styles.subtitle}>Retrying automatically when server comes online</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.retryButton} onPress={verifyServer}>
          <Text style={styles.retryButtonText}>Check</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Fully online and connected
  return null;
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 6,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  offlineBanner: {
    backgroundColor: '#334155', // Slate dark
  },
  serverBanner: {
    backgroundColor: '#D97706', // Amber dark
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    fontSize: 18,
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  subtitle: {
    color: '#E2E8F0',
    fontSize: 11,
    marginTop: 1,
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
});

export default NetworkStatusBanner;
