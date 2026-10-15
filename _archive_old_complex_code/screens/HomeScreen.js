 /**
 * Home Dashboard Screen
 * 
 * Central command center displaying:
 * - Real-time metric cards (Total, Synced, Pending, Failed)
 * - Network & API connection health
 * - Manual "Sync Now" trigger with activity indicator
 * - Last successful synchronization time
 * - Quick navigation buttons
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import colors from '../theme/colors';
import { getProductStats } from '../database/productRepository';
import { getQueueStats } from '../database/syncQueueRepository';
import { syncNow, getSyncState, subscribeToSync } from '../services/syncService';
import { getNetworkStatus, subscribeToNetwork } from '../services/networkService';
import { checkServerHealth, getApiBaseUrl } from '../services/api';

export function HomeScreen({ onNavigate }) {
  const [productStats, setProductStats] = useState({ total: 0, synced: 0, pending: 0, failed: 0 });
  const [queueStats, setQueueStats] = useState({ total: 0, synced: 0, pending: 0, failed: 0 });
  const [syncState, setSyncState] = useState(getSyncState());
  const [network, setNetwork] = useState(getNetworkStatus());
  const [serverHealth, setServerHealth] = useState({ reachable: false, error: null });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load all dashboard metrics
  const loadDashboardData = useCallback(async () => {
    try {
      const [pStats, qStats, health] = await Promise.all([
        getProductStats(),
        getQueueStats(),
        checkServerHealth(),
      ]);
      setProductStats(pStats);
      setQueueStats(qStats);
      setServerHealth(health);
    } catch (error) {
      console.error('[HomeScreen] Error loading stats:', error);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();

    // Subscribe to sync state changes
    const unsubSync = subscribeToSync((event, state) => {
      setSyncState(state);
      loadDashboardData();
    });

    // Subscribe to network changes
    const unsubNet = subscribeToNetwork((netState) => {
      setNetwork(netState);
      loadDashboardData();
    });

    return () => {
      unsubSync();
      unsubNet();
    };
  }, [loadDashboardData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setIsRefreshing(false);
  };

  const handleManualSync = async () => {
    await syncNow();
    await loadDashboardData();
  };

  const formatLastSync = (isoString) => {
    if (!isoString) return 'Never synchronized';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      ' on ' + date.toLocaleDateString();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
      }
    >
      {/* App Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>OfflineSync Demo</Text>
          <Text style={styles.appSubtitle}>SQLite ➔ MongoDB Bidirectional Sync</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsIconBtn}
          onPress={() => onNavigate('settings')}
        >
          <Text style={styles.settingsIconText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Sync Action Banner */}
      <View style={styles.syncCard}>
        <View style={styles.syncCardTop}>
          <View style={styles.syncInfo}>
            <Text style={styles.syncTitle}>Sync Status</Text>
            <Text style={styles.syncTime}>
              Last Sync: {formatLastSync(syncState.lastSyncTime)}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.syncButton, syncState.isSyncing && styles.syncButtonDisabled]}
            onPress={handleManualSync}
            disabled={syncState.isSyncing}
          >
            {syncState.isSyncing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.syncButtonText}>Sync Now ↻</Text>
            )}
          </TouchableOpacity>
        </View>

        {syncState.lastSyncResult ? (
          <View style={styles.syncResultBanner}>
            <Text style={styles.syncResultText}>
              {syncState.lastSyncResult.status === 'success'
                ? `✓ Sync Success: ${syncState.lastSyncResult.synced} items synchronized`
                : syncState.lastSyncResult.status === 'partial_success'
                ? `⚠️ Partial: ${syncState.lastSyncResult.synced} synced, ${syncState.lastSyncResult.failed} failed`
                : `✕ Sync Failed: ${syncState.lastSyncResult.error || 'Server error'}`}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Metric Cards Grid */}
      <Text style={styles.sectionTitle}>Inventory & Synchronization Metrics</Text>
      <View style={styles.metricsGrid}>
        {/* Total Products */}
        <View style={[styles.metricCard, { borderTopColor: colors.primary }]}>
          <Text style={styles.metricNumber}>{productStats.total}</Text>
          <Text style={styles.metricLabel}>Total Products</Text>
          <Text style={styles.metricSub}>Local SQLite store</Text>
        </View>

        {/* Synced Products */}
        <View style={[styles.metricCard, { borderTopColor: colors.synced }]}>
          <Text style={[styles.metricNumber, { color: colors.synced }]}>
            {productStats.synced}
          </Text>
          <Text style={styles.metricLabel}>Synced</Text>
          <Text style={styles.metricSub}>Saved in MongoDB</Text>
        </View>

        {/* Pending Products */}
        <View style={[styles.metricCard, { borderTopColor: colors.pending }]}>
          <Text style={[styles.metricNumber, { color: colors.pending }]}>
            {productStats.pending}
          </Text>
          <Text style={styles.metricLabel}>Pending Sync</Text>
          <Text style={styles.metricSub}>Awaiting sync queue</Text>
        </View>

        {/* Failed Operations */}
        <View style={[styles.metricCard, { borderTopColor: colors.failed }]}>
          <Text style={[styles.metricNumber, { color: colors.failed }]}>
            {queueStats.failed}
          </Text>
          <Text style={styles.metricLabel}>Failed Ops</Text>
          <Text style={styles.metricSub}>Needs attention / retry</Text>
        </View>
      </View>

      {/* Connection Diagnostics */}
      <Text style={styles.sectionTitle}>System Connection Health</Text>
      <View style={styles.diagnosticsCard}>
        <View style={styles.diagRow}>
          <Text style={styles.diagLabel}>Device Network</Text>
          <View style={styles.diagValueRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: network.isConnected ? colors.synced : colors.failed },
              ]}
            />
            <Text style={styles.diagValue}>
              {network.isConnected ? `Online (${network.type})` : 'Offline'}
            </Text>
          </View>
        </View>

        <View style={styles.diagDivider} />

        <View style={styles.diagRow}>
          <Text style={styles.diagLabel}>Backend REST API</Text>
          <View style={styles.diagValueRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: serverHealth.reachable ? colors.synced : colors.failed },
              ]}
            />
            <Text style={styles.diagValue}>
              {serverHealth.reachable ? 'Connected & Healthy' : 'Unreachable'}
            </Text>
          </View>
        </View>

        <View style={styles.diagDivider} />

        <View style={styles.diagRow}>
          <Text style={styles.diagLabel}>MongoDB Database</Text>
          <View style={styles.diagValueRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    serverHealth.data?.database?.connected ? colors.synced : colors.pending,
                },
              ]}
            />
            <Text style={styles.diagValue}>
              {serverHealth.data?.database?.connected
                ? 'Online & Connected'
                : serverHealth.reachable
                ? 'Connecting / Not Found'
                : 'Server Offline'}
            </Text>
          </View>
        </View>

        <View style={styles.diagDivider} />

        <View style={styles.diagRow}>
          <Text style={styles.diagLabel}>API Endpoint</Text>
          <Text style={styles.diagUrl} numberOfLines={1}>
            {getApiBaseUrl()}
          </Text>
        </View>
      </View>

      {/* Navigation Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Navigation</Text>
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionTile}
          onPress={() => onNavigate('products')}
        >
          <Text style={styles.actionIcon}>📦</Text>
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitle}>Product Inventory</Text>
            <Text style={styles.actionSubtitle}>View, search, edit, and delete products</Text>
          </View>
          <Text style={styles.actionArrow}>➔</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionTile}
          onPress={() => onNavigate('addProduct')}
        >
          <Text style={styles.actionIcon}>➕</Text>
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitle}>Add New Product</Text>
            <Text style={styles.actionSubtitle}>Create and save instantly to SQLite</Text>
          </View>
          <Text style={styles.actionArrow}>➔</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionTile}
          onPress={() => onNavigate('syncActivity')}
        >
          <Text style={styles.actionIcon}>📜</Text>
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitle}>Sync Activity & Logs</Text>
            <Text style={styles.actionSubtitle}>
              View queued operations & retry failures ({queueStats.pending} pending)
            </Text>
          </View>
          <Text style={styles.actionArrow}>➔</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  appSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  settingsIconBtn: {
    backgroundColor: colors.surface,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsIconText: {
    fontSize: 18,
  },
  syncCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  syncCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncInfo: {
    flex: 1,
    marginRight: 10,
  },
  syncTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  syncTime: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 3,
  },
  syncButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  syncResultBanner: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceHighlight,
  },
  syncResultText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
    marginTop: 4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metricCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 4,
    elevation: 1,
  },
  metricNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 4,
  },
  metricSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  diagnosticsCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  diagDivider: {
    height: 1,
    backgroundColor: colors.surfaceHighlight,
    marginVertical: 4,
  },
  diagLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  diagValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  diagValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  diagUrl: {
    fontSize: 12,
    color: colors.textMuted,
    maxWidth: '55%',
  },
  actionsContainer: {
    marginBottom: 16,
  },
  actionTile: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 14,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  actionSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  actionArrow: {
    fontSize: 16,
    color: colors.textMuted,
    marginLeft: 8,
  },
});

export default HomeScreen;
