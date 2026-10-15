/**
 * Product Card Component
 * 
 * Displays individual product summary inside the Product List.
 * Includes name, price, quantity, sync badge, and fast actions.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import colors from '../theme/colors';
import SyncStatusBadge from './SyncStatusBadge';

export function ProductCard({ product, onPress, onEdit, onDelete }) {
  const formattedPrice = Number(product.price).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => onPress && onPress(product)}
    >
      <View style={styles.headerRow}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        <SyncStatusBadge status={product.syncStatus} size="small" />
      </View>

      {product.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {product.description}
        </Text>
      ) : null}

      <View style={styles.footerRow}>
        <View style={styles.metaColumn}>
          <Text style={styles.priceLabel}>Price</Text>
          <Text style={styles.priceValue}>₹{formattedPrice}</Text>
        </View>

        <View style={styles.metaColumn}>
          <Text style={styles.qtyLabel}>Quantity</Text>
          <Text style={styles.qtyValue}>{product.quantity} pcs</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => onEdit && onEdit(product)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDelete && onDelete(product)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 10,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceHighlight,
  },
  metaColumn: {
    flexDirection: 'column',
  },
  priceLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  priceValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 2,
  },
  qtyLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  qtyValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  deleteButton: {
    backgroundColor: colors.failedBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.failed,
  },
});

export default ProductCard;
