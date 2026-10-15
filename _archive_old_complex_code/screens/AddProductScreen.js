/**
 * Add Product Screen
 * 
 * Form allowing users to create products offline or online.
 * Validates inputs client-side, saves to SQLite transactionally with a queued
 * create operation, and triggers immediate background sync when online.
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
import { createProduct } from '../database/productRepository';
import { validateProduct } from '../utils/validation';
import { syncNow } from '../services/syncService';
import { isOnline } from '../services/networkService';

export function AddProductScreen({ onNavigate }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    // 1. Client-side input validation
    const validation = validateProduct({ name, price, quantity, description });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    try {
      // 2. Save locally to SQLite and enqueue in sync_queue
      const created = await createProduct({
        name,
        price,
        quantity,
        description,
      });

      console.log(`[AddProductScreen] Product saved to SQLite with ID: ${created.id}`);

      // 3. Trigger immediate sync if online (non-blocking)
      if (isOnline()) {
        syncNow();
      }

      // 4. User feedback
      Alert.alert(
        'Product Saved!',
        isOnline()
          ? 'Product saved to local database and synchronization queued to MongoDB.'
          : 'Product saved to local SQLite database. It will sync automatically when online.',
        [
          {
            text: 'OK',
            onPress: () => onNavigate('products'),
          },
        ]
      );
    } catch (error) {
      console.error('[AddProductScreen] Error saving product:', error);
      Alert.alert('Error', error.message || 'Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => onNavigate('products')}>
          <Text style={styles.backButtonText}>← Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Add New Product</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Offline indicator card */}
        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>💡</Text>
          <Text style={styles.infoText}>
            This product will be saved to SQLite immediately. Even without internet, your data is safe and will sync once connected.
          </Text>
        </View>

        {/* Product Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Product Name *</Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            placeholder="e.g. Wireless Noise-Cancelling Headphones"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={(txt) => {
              setName(txt);
              if (errors.name) setErrors({ ...errors, name: null });
            }}
          />
          {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
        </View>

        {/* Price & Quantity Row */}
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

        {/* Description */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea, errors.description && styles.inputError]}
            placeholder="Enter product description or specifications..."
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

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save Product (Local First) ➔</Text>
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
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: colors.primaryDark,
    lineHeight: 16,
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

export default AddProductScreen;
