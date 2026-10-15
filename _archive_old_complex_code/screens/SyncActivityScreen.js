/**
 * Sync Activity & Logs Screen
 * 
 * Displays the complete synchronization queue ledger:
 * - Operation IDs & entity references
 * - Operation types (create, update, delete)
 * - Real-time status (pending, syncing, synced, failed)
 * - Retry counts & last recorded errors
 * - Individual and batch retry controls
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import colors from '../theme/colors';
import SyncStatusBadge from '../components/SyncStatusBadge';
import {
  getAllQueueOperations,
  retryAllFailedOperations,
  retryOperation,
} from '../database/syncQueueRepository';
import { syncNow, subscribeToSync } from '../services/syncService';

const FILTER_OPTIONS = ['all', 'pending', 'failed', 'synced'];

export function SyncActivityScreen({ onNavigate }) {
  const [operations, setOperations] = useState([]);
  const [filter, setFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadOperations = useCallback(async () => {
    try {
      const items = await getAllQueueOperations();
      setOperations(items);
    } catch (err) {
      console.error('[SyncActivityScreen] Error loading queue operations:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOperations();

    const unsub = subscribeToSync(() => {
      loadOperations();
    });

    return () => unsub();
  }, [loadOperations]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadOperations();
  };

  const handleRetryAll = async () => {
    try {
      const affected = await retryAllFailedOperations();
      Alert.alert(
        'Retrying Operations',
        `${affected} failed operation(s) have been reset to pending status. Triggering synchronization now...`,
        [
          {
            text: 'OK',
            onPress: () => syncNow(),
          },
        ]
      );
      await loadOperations();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleRetrySingle = async (op) => {
    try {
      await retryOperation(op.operationId);
      await loadOperations();
      syncNow();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const filteredOperations = operations.filter((op) => {
    if (filter === 'all') return true;
    return op.status === filter;
  });

  const failedCount = operations.filter((op) => op.status === 'failed').length;

  const formatDate = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      ' ' + d.toLocaleDateString();
  };

  const renderQueueItem = ({ item }) => {
    const isFailed = item.status === 'failed';
    const opTypeColor =
      item.operationType === 'create'
        ? colors.synced
        : item.operationType === 'update'
        ? colors.primary
        : colors.failed;

    return (
      <View style={[styles.queueCard, isFailed && styles.failedQueueCard]}>
        <View style={styles.cardHeader}>
          <View style={styles.opTypeBadge}>
            <Text style={[styles.opTypeText, { color: opTypeColor }]}>
              {item.operationType.toUpperCase()}
            </Text>
          </View>
          <SyncStatusBadge status={item.status} size="small" />
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Product:</Text>
          <Text style={styles.productNameText} numberOfLines={1}>
            {item.productName || item.payload?.name || item.entityId}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Operation ID:</Text>
          <Text style={styles.codeText} numberOfLines={1} selectable>
            {item.operationId}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Queued At:</Text>
          <Text style={styles.timeText}>{formatDate(item.createdAt)}</Text>
        </View>

        {item.lastAttemptAt ? (
          <View style={styles.row}>
            <Text style={styles.label}>Last Attempt:</Text>
            <Text style={styles.timeText}>{formatDate(item.lastAttemptAt)}</Text>
          </View>
        ) : null}

        <View style={styles.row}>
          <Text style={styles.label}>Retry Attempts:</Text>
          <Text style={styles.retryText}>{item.retryCount} times</Text>
        </View>

        {item.lastError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorLabel}>Last Error:</Text>
            <Text style={styles.errorMessage}>{item.lastError}</Text>
          </View>
        ) : null}

        {isFailed ? (
          <TouchableOpacity
            style={styles.retrySingleButton}
            onPress={() => handleRetrySingle(item)}
          >
            <Text style={styles.retrySingleButtonText}>↻ Retry Operation</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => onNavigate('home')}>
          <Text style={styles.backButtonText}>← Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Sync Activity</Text>
        <TouchableOpacity style={styles.syncBtnHeader} onPress={() => syncNow()}>
          <Text style={styles.syncBtnHeaderText}>Sync Now</Text>
        </TouchableOpacity>
      </View>

      {/* Action Banner if there are failed operations */}
      {failedCount > 0 ? (
        <View style={styles.failedBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.failedBannerTitle}>
              {failedCount} Operation{failedCount === 1 ? '' : 's'} Failed
            </Text>
            <Text style={styles.failedBannerSubtitle}>
              Transient errors can be retried once connectivity is confirmed.
            </Text>
          </View>
          <TouchableOpacity style={styles.retryAllBtn} onPress={handleRetryAll}>
            <Text style={styles.retryAllBtnText}>Retry All</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {FILTER_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.filterTab, filter === opt && styles.filterTabActive]}
            onPress={() => setFilter(opt)}
          >
            <Text
              style={[styles.filterTabText, filter === opt && styles.filterTabTextActive]}
            >
              {opt.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Queue Items List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Reading synchronization queue...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOperations}
          keyExtractor={(item) => item.operationId}
          renderItem={renderQueueItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>✨</Text>
              <Text style={styles.emptyTitle}>Queue is Clean</Text>
              <Text style={styles.emptySubtitle}>
                There are no {filter !== 'all' ? filter : ''} synchronization records in the local queue.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    paddingVertical: 4,
    width: 80,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  screenTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  syncBtnHeader: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  syncBtnHeaderText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  failedBanner: {
    flexDirection: 'row',
    backgroundColor: colors.failedBg,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  failedBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.failed,
  },
  failedBannerSubtitle: {
    fontSize: 11,
    color: '#991B1B',
    marginTop: 2,
  },
  retryAllBtn: {
    backgroundColor: colors.failed,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  retryAllBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: colors.surfaceHighlight,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  queueCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  failedQueueCard: {
    borderColor: '#FECACA',
    backgroundColor: '#FFFDFD',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHighlight,
  },
  opTypeBadge: {
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  opTypeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  label: {
    fontSize: 12,
    color: colors.textMuted,
    width: 105,
    fontWeight: '600',
  },
  productNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  codeText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.primaryDark,
    flex: 1,
  },
  timeText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  errorBox: {
    backgroundColor: colors.failedBg,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.failed,
    marginBottom: 2,
  },
  errorMessage: {
    fontSize: 12,
    color: '#991B1B',
  },
  retrySingleButton: {
    backgroundColor: colors.surfaceHighlight,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retrySingleButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
});

export default SyncActivityScreen;
