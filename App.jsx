/**
 * ========================================================
 * OFFLINE-FIRST SYNC DEMO — PREMIUM MODERN UI
 * ========================================================
 * 
 * ✨ Features:
 * ૧. Real-time Connection Banner (Online / Offline status pill)
 * ૨. Live Synchronization Stats (Total, Synced, Pending counters)
 * ૩. Filter Tabs (All, Pending, Synced)
 * ૪. Instant Local Storage (SQLite with @op-engineering/op-sqlite)
 * ૫. Auto-sync & Manual One-tap Sync with MongoDB
 * ૬. Safe Confirmation Dialog on Delete
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Platform,
  StatusBar,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { initDB, addProduct, getProducts, deleteProduct } from './src/database';
import { syncData, startAutoSync, deleteProductFromServer } from './src/syncService';

function MainScreen() {
  const insets = useSafeAreaInsets();

  const [products, setProducts] = useState([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [online, setOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'synced'

  // નોચ અને સ્ટેટસબાર નીચે સેફ સ્પેસિંગ
  const topPadding = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20
  );

  // ૧. SQLite માંથી બધી પ્રોડક્ટ્સ લોડ કરવી
  const loadProducts = async () => {
    const list = await getProducts();
    setProducts(list || []);
  };

  useEffect(() => {
    async function start() {
      await initDB();
      await loadProducts();

      // નેટવર્ક લિસનર (નેટ આવે ત્યારે આપોઆપ સિંક)
      startAutoSync(async (isNetOn) => {
        setOnline(isNetOn);
        if (isNetOn) {
          await syncData();
          await loadProducts();
        }
      });
    }
    start();
  }, []);

  // ૨. પ્રોડક્ટ ઉમેરવી (હંમેશા પહેલા SQLite માં તાત્કાલિક સેવ થશે)
  const handleAdd = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a product name');
      return;
    }
    if (!price.trim() || isNaN(Number(price))) {
      Alert.alert('Required', 'Please enter a valid price');
      return;
    }

    await addProduct(name.trim(), price.trim());
    setName('');
    setPrice('');
    await loadProducts(); // UI તરત અપડેટ થાય

    // જો નેટ હોય તો બેકગ્રાઉન્ડમાં શાંતિથી સિંક થાય
    if (online) {
      await syncData();
      await loadProducts();
    }
  };

  // ૩. ડિલીટ કન્ફર્મેશન પોપઅપ
  const confirmDelete = (item) => {
    Alert.alert(
      'Delete Product 🗑️',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDelete(item.id),
        },
      ]
    );
  };

  // પ્રોડક્ટ ડિલીટ કરવી (SQLite + સર્વર બંનેમાંથી)
  const handleDelete = async (id) => {
    await deleteProduct(id);
    await loadProducts();
    await deleteProductFromServer(id);
  };

  // ૪. મેન્યુઅલ "Sync Now" બટન
  const handleManualSync = async () => {
    setIsSyncing(true);
    const result = await syncData();
    await loadProducts();
    setIsSyncing(false);

    if (result?.success) {
      if ((result.count && result.count > 0) || (result.removedCount && result.removedCount > 0)) {
        let msg = '';
        if (result.count > 0) msg += `${result.count} product(s) synced. `;
        if (result.removedCount > 0) msg += `${result.removedCount} removed from MongoDB.`;
        Alert.alert('Synced ✅', msg);
      } else {
        Alert.alert('Status ℹ️', 'All products are already synced with MongoDB.');
      }
    } else if (result?.reason === 'offline') {
      Alert.alert('Offline ⚠️', 'Phone is offline. Please turn on Wi-Fi or Mobile Data.');
    } else {
      Alert.alert('Notice 📡', 'Trying to reach server. Make sure "npm start" is running in backend.');
    }
  };

  // લાઇવ આંકડા (Stats)
  const totalCount = products.length;
  const syncedCount = products.filter((p) => p.syncStatus === 'synced').length;
  const pendingCount = products.filter((p) => p.syncStatus === 'pending').length;

  // ફિલ્ટર થયેલું લિસ્ટ
  const filteredProducts = useMemo(() => {
    if (filter === 'pending') return products.filter((p) => p.syncStatus === 'pending');
    if (filter === 'synced') return products.filter((p) => p.syncStatus === 'synced');
    return products;
  }, [products, filter]);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* ટોપ હેડર અને બ્રાન્ડ બેનર */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerBrand}>⚡ OfflineSync Pro</Text>
            <Text style={styles.headerSub}>SQLite ➔ MongoDB Live Sync</Text>
          </View>

          {/* નેટવર્ક સ્ટેટસ બેજ */}
          <View style={[styles.netPill, { backgroundColor: online ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }]}>
            <View style={[styles.netDot, { backgroundColor: online ? '#10B981' : '#EF4444' }]} />
            <Text style={[styles.netText, { color: online ? '#10B981' : '#F87171' }]}>
              {online ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>

        {/* સ્ટેટ્સ કાઉન્ટર્સ (Total, Synced, Pending) */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{totalCount}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxBorder]}>
            <Text style={[styles.statNum, { color: '#10B981' }]}>{syncedCount}</Text>
            <Text style={styles.statLabel}>✓ Synced</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: '#F59E0B' }]}>{pendingCount}</Text>
            <Text style={styles.statLabel}>⏳ Pending</Text>
          </View>
        </View>
      </View>

      {/* ફોર્મ અને ફિલ્ટર કન્ટેઈનર (Fixed Header) */}
      <View style={styles.fixedContent}>
        {/* નવું પ્રોડક્ટ એડ કરવાનું ફોર્મ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>+ Add New Product</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputName]}
              placeholder="Product Name (e.g. Mouse)"
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={setName}
              autoCorrect={false}
            />
            <TextInput
              style={[styles.input, styles.inputPrice]}
              placeholder="Price (₹)"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={price}
              onChangeText={setPrice}
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity style={styles.addBtn} onPress={handleAdd} activeOpacity={0.85}>
            <Text style={styles.addBtnText}>⚡ Save to SQLite (Instant)</Text>
          </TouchableOpacity>
        </View>

        {/* એક્શન બાર: ફિલ્ટર ટેબ્સ + Sync Now બટન */}
        <View style={styles.actionBar}>
          <View style={styles.filterTabs}>
            <TouchableOpacity
              onPress={() => setFilter('all')}
              style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                All ({totalCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilter('pending')}
              style={[styles.filterChip, filter === 'pending' && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
                ⏳ Pending ({pendingCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilter('synced')}
              style={[styles.filterChip, filter === 'synced' && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, filter === 'synced' && styles.filterTextActive]}>
                ✓ Synced ({syncedCount})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sync Now બટન */}
          <TouchableOpacity
            style={styles.syncBtn}
            onPress={handleManualSync}
            disabled={isSyncing}
            activeOpacity={0.8}
          >
            {isSyncing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.syncBtnText}>Sync ↻</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* પ્રોડક્ટ્સ લિસ્ટ */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isSyncing} onRefresh={handleManualSync} colors={['#4F46E5']} />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isSynced = item.syncStatus === 'synced';
          return (
            <View style={styles.productCard}>
              <View style={styles.cardLeft}>
                <View style={styles.productIconBox}>
                  <Text style={styles.productIcon}>📦</Text>
                </View>
                <View style={styles.productDetails}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.productPrice}>₹{Number(item.price).toFixed(2)}</Text>
                </View>
              </View>

              <View style={styles.cardRight}>
                {/* સ્ટેટસ બેજ: લીલો (Synced) અથવા પીળો (Pending) */}
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: isSynced ? '#ECFDF5' : '#FFFBEB',
                      borderColor: isSynced ? '#A7F3D0' : '#FDE68A',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusBadgeDot,
                      { backgroundColor: isSynced ? '#10B981' : '#F59E0B' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: isSynced ? '#059669' : '#D97706' },
                    ]}
                  >
                    {isSynced ? 'Synced' : 'Pending'}
                  </Text>
                </View>

                {/* ડિલીટ બટન */}
                <TouchableOpacity
                  onPress={() => confirmDelete(item)}
                  style={styles.deleteButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteIcon}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyTitle}>
              {filter === 'all'
                ? 'No products saved yet'
                : `No ${filter} products`}
            </Text>
            <Text style={styles.emptyDesc}>
              Add a product above. Even without internet, it saves instantly into SQLite!
            </Text>
          </View>
        }
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainScreen />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9', // Sleek Slate Background
  },
  // હેડર સેક્શન (Dark Slate Premium Theme)
  header: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerBrand: {
    fontSize: 21,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  netPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  netDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  netText: {
    fontSize: 12,
    fontWeight: '800',
  },
  // સ્ટેટ્સ રો
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statBoxBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statNum: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
    fontWeight: '600',
  },
  fixedContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  // એડ કાર્ડ
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputName: {
    flex: 3,
  },
  inputPrice: {
    flex: 2,
  },
  addBtn: {
    backgroundColor: '#4F46E5', // Indigo Accent
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  // એક્શન બાર (ફિલ્ટર્સ + Sync)
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#0F172A',
  },
  filterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  syncBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  // પ્રોડક્ટ કાર્ડ
  productCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 13,
    marginBottom: 9,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  productIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  productIcon: {
    fontSize: 20,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4F46E5',
    marginTop: 2,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: {
    fontSize: 14,
  },
  // એમ્પટી સ્ટેટ કાર્ડ
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
