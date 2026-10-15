/**
 * Edit Product Screen
 * 
 * Allows modifying existing products offline or online.
 * Saves changes transactionally in SQLite, queues an update operation,
 * marks syncStatus as 'pending', and triggers background sync.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import colors from '../theme/colors';
import { updateProduct } from '../database/productRepository';
import { validateProduct } from '../utils/validation';
import { syncNow } from '../services/syncService';
import { isOnline } from '../services/networkService';

export function EditProductScreen({ routeParams, onNavigate }) {
  const product = routeParams?.product;

  const [name, setName] = useState(product?.name || '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [quantity, setQuantity] = useState(product ? String(product.quantity) : '1');
  const [description, setDescription] = useState(product?.description || '');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!product) {
    return (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundText}>No product selected for editing.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => onNavigate('products')}>
          <Text style={styles.backButtonText}>← Back to Products</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleUpdate = async () => {
    const validation = validateProduct({ name, price, quantity, description });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    try {
      await updateProduct(product.id, {
        name,
        price,
        quantity,
        description,
      });

      console.log(`[EditProductScreen] Product ${product.id} updated in SQLite.`);

      // Trigger sync if online
      if (isOnline()) {
        syncNow();
      }

      Alert.alert(
        'Product Updated!',
        'Changes saved locally in SQLite and queued for online sync.',
        [
          {
            text: 'OK',
            onPress: () => onNavigate('products'),
          },
        ]
      );
    } catch (error) {
      console.error('[EditProductScreen] Error updating product:', error);
      Alert.alert('Error', error.message || 'Failed to update product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => onNavigate('products')}>
          <Text style={styles.backButtonText}>← Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Edit Product</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Product Name *</Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            placeholder="Product name"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={(txt) => {
              setName(txt);
              if (errors.name) setErrors({ ...errors, name: null });
            }}
          />
          {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
        </View>

        <View style={styles.row}>
          <View style={[styles.fieldGroup, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.label}>Price (₹) *</Text>
            <TextInput
              style={[styles.input, errors.price && styles.inputError]}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={price}
              onChangeText={(txt) => {
                setPrice(txt);
                if (errors.price) setErrors({ ...errors, price: null });
              }}
            />
            {errors.price ? <Text style={styles.errorText}>{errors.price}</Text> : null}
          </View>

          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.label}>Quantity *</Text>
            <TextInput
              style={[styles.input, errors.quantity && styles.inputError]}
              placeholder="1"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={quantity}
              onChangeText={(txt) => {
                setQuantity(txt);
                if (errors.quantity) setErrors({ ...errors, quantity: null });
              }}
            />
            {errors.quantity ? <Text style={styles.errorText}>{errors.quantity}</Text> : null}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea, errors.description && styles.inputError]}
            placeholder="Description..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={description}
            onChangeText={(txt) => {
              setDescription(txt);
              if (errors.description) setErrors({ ...errors, description: null });
            }}
          />
          {errors.description ? (
            <Text style={styles.errorText}>{errors.description}</Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]}
          onPress={handleUpdate}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Update Product ➔</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    width: 70,
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  inputError: {
    borderColor: colors.failed,
    backgroundColor: colors.failedBg,
  },
  errorText: {
    color: colors.failed,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
  },
  textArea: {
    height: 100,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    elevation: 2,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});

export default EditProductScreen;
