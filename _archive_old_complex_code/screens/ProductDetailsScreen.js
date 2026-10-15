/**
 * Product Details Screen
 * 
 * Displays complete metadata for a product:
 * - Local SQLite ID & MongoDB Server ID mapping
 * - Timestamps (Creation, Update, Last Sync)
 * - Real-time sync status badge
 * - Direct Edit and Delete triggers
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import colors from '../theme/colors';
import SyncStatusBadge from '../components/SyncStatusBadge';
import { getProductById, deleteProduct } from '../database/productRepository';
import { syncNow } from '../services/syncService';

export function ProductDetailsScreen({ routeParams, onNavigate }) {
  const initialProduct = routeParams?.product;
  const [product, setProduct] = useState(initialProduct);

  useEffect(() => {
    if (initialProduct?.id) {
      loadFreshProduct(initialProduct.id);
    }
  }, [initialProduct]);

  const loadFreshProduct = async (id) => {
    try {
      const fresh = await getProductById(id);
      if (fresh) setProduct(fresh);
    } catch (err) {
      console.error('[ProductDetailsScreen] Error refreshing product:', err);
    }
  };

  if (!product) {
    return (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundText}>Product not found.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => onNavigate('products')}>
          <Text style={styles.backButtonText}>← Back to Products</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${product.name}"? This operation will be queued and synchronized to MongoDB.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProduct(product.id);
              syncNow(); // Trigger background sync
              onNavigate('products');
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not available';
    const d = new Date(dateStr);
    return d.toLocaleString();
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => onNavigate('products')}>
          <Text style={styles.backButtonText}>← Products</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Product Details</Text>
        <TouchableOpacity
          style={styles.editButtonTop}
          onPress={() => onNavigate('editProduct', { product })}
        >
          <Text style={styles.editButtonTopText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Main Product Card */}
        <View style={styles.mainCard}>
          <View style={styles.headerRow}>
            <Text style={styles.productName}>{product.name}</Text>
            <SyncStatusBadge status={product.syncStatus} />
          </View>

          <View style={styles.priceRow}>
            <View>
              <Text style={styles.metaLabel}>PRICE</Text>
              <Text style={styles.priceValue}>₹{Number(product.price).toFixed(2)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.metaLabel}>IN STOCK</Text>
              <Text style={styles.quantityValue}>{product.quantity} units</Text>
            </View>
          </View>

          {product.description ? (
            <View style={styles.descriptionSection}>
              <Text style={styles.metaLabel}>DESCRIPTION</Text>
              <Text style={styles.descriptionText}>{product.description}</Text>
            </View>
          ) : null}
        </View>

        {/* Sync & Technical Metadata Card */}
        <Text style={styles.sectionTitle}>Synchronization & Storage Metadata</Text>
        <View style={styles.metaCard}>
          <View style={styles.metaItem}>
            <Text style={styles.metaKey}>Local Identifier (SQLite UUID):</Text>
            <Text style={styles.metaCode} selectable>
              {product.id}
            </Text>
          </View>

          <View style={styles.metaDivider} />

          <View style={styles.metaItem}>
            <Text style={styles.metaKey}>Server Identifier (MongoDB _id):</Text>
            <Text
              style={[
                styles.metaCode,
                !product.serverId && { color: colors.pending, fontStyle: 'italic' },
              ]}
              selectable
            >
              {product.serverId || 'Pending server sync assignment'}
            </Text>
          </View>

          <View style={styles.metaDivider} />

          <View style={styles.metaItem}>
            <Text style={styles.metaKey}>Created Locally At:</Text>
            <Text style={styles.metaVal}>{formatDate(product.createdAt)}</Text>
          </View>

          <View style={styles.metaDivider} />

          <View style={styles.metaItem}>
            <Text style={styles.metaKey}>Last Updated Locally:</Text>
            <Text style={styles.metaVal}>{formatDate(product.updatedAt)}</Text>
          </View>

          <View style={styles.metaDivider} />

          <View style={styles.metaItem}>
            <Text style={styles.metaKey}>Last Successful Sync:</Text>
            <Text style={styles.metaVal}>{formatDate(product.lastSyncAt)}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => onNavigate('editProduct', { product })}
          >
            <Text style={styles.editBtnText}>✏️ Edit Product</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>🗑️ Delete Product</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  editButtonTop: {
    paddingVertical: 4,
    width: 80,
    alignItems: 'flex-end',
  },
  editButtonTopText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  mainCard: {
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 10,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceHighlight,
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  priceValue: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary,
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  descriptionSection: {
    marginTop: 6,
  },
  descriptionText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  metaCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  metaItem: {
    paddingVertical: 6,
  },
  metaKey: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 3,
  },
  metaVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metaCode: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.primaryDark,
    backgroundColor: colors.surfaceHighlight,
    padding: 6,
    borderRadius: 6,
  },
  metaDivider: {
    height: 1,
    backgroundColor: colors.surfaceHighlight,
    marginVertical: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  editBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  editBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: colors.failedBg,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  deleteBtnText: {
    color: colors.failed,
    fontWeight: '700',
    fontSize: 14,
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  notFoundText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 16,
  },
});

export default ProductDetailsScreen;
