/**
 * Product List Screen
 * 
 * Features:
 * - Search products in SQLite by name / description
 * - Filter products by syncStatus (All, Pending, Synced, Failed)
 * - Pull-to-refresh
 * - Confirmation alert for local deletion
 * - Floating action button to quickly add products
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import colors from '../theme/colors';
import ProductCard from '../components/ProductCard';
import { getProducts, deleteProduct } from '../database/productRepository';
import { subscribeToSync, syncNow } from '../services/syncService';

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'synced', label: 'Synced' },
  { key: 'failed', label: 'Failed' },
];

export function ProductListScreen({ onNavigate }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load products from local SQLite database
  const loadProducts = useCallback(async () => {
    try {
      const items = await getProducts({
        search,
        status: selectedStatus,
      });
      setProducts(items);
    } catch (error) {
      console.error('[ProductListScreen] Error loading products:', error);
      Alert.alert('Error', 'Failed to load products from database');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [search, selectedStatus]);

  useEffect(() => {
    loadProducts();

    // Re-query when sync finishes so updated syncStatus immediately reflects in UI
    const unsub = subscribeToSync((event) => {
      if (event === 'sync_completed' || event === 'state_change') {
        loadProducts();
      }
    });

    return () => unsub();
  }, [loadProducts]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await syncNow(); // Also triggers background sync if online
    await loadProducts();
  };

  const handleDelete = (product) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${product.name}"? This operation will be queued and synchronized to the online database.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProduct(product.id);
              await loadProducts();
              // Attempt background sync immediately if online
              syncNow();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const renderHeader = () => (
    <View style={styles.headerControls}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by product name..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsContainer}>
        {FILTER_TABS.map((tab) => {
          const isActive = selectedStatus === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setSelectedStatus(tab.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Results Count Banner */}
      <View style={styles.resultsRow}>
        <Text style={styles.resultsCount}>
          Showing {products.length} product{products.length === 1 ? '' : 's'}
        </Text>
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (isLoading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📦</Text>
        <Text style={styles.emptyTitle}>No Products Found</Text>
        <Text style={styles.emptySubtitle}>
          {search || selectedStatus !== 'all'
            ? 'Try adjusting your search query or status filter.'
            : 'You haven\'t added any products yet. Products created offline are saved immediately to SQLite.'}
        </Text>
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => onNavigate('addProduct')}
        >
          <Text style={styles.emptyButtonText}>+ Add First Product</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Screen Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => onNavigate('home')}>
          <Text style={styles.backButtonText}>← Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Products</Text>
        <TouchableOpacity
          style={styles.addButtonHeader}
          onPress={() => onNavigate('addProduct')}
        >
          <Text style={styles.addButtonHeaderText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading products from SQLite...</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={(p) => onNavigate('productDetails', { product: p })}
              onEdit={(p) => onNavigate('editProduct', { product: p })}
              onDelete={handleDelete}
            />
          )}
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
  addButtonHeader: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addButtonHeaderText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  headerControls: {
    marginBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginTop: 12,
    marginBottom: 10,
    height: 44,
  },
  searchIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  clearSearchText: {
    fontSize: 14,
    color: colors.textMuted,
    padding: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 3,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  resultsCount: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
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
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
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
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});

export default ProductListScreen;
