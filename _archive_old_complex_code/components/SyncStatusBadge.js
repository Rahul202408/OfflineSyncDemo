/**
 * Sync Status Badge Component
 * 
 * Visually communicates the synchronization state of a record
 * ('synced', 'pending', 'syncing', 'failed').
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../theme/colors';

export function SyncStatusBadge({ status = 'pending', size = 'normal' }) {
  const normalizedStatus = (status || 'pending').toLowerCase();

  const getBadgeConfig = () => {
    switch (normalizedStatus) {
      case 'synced':
        return {
          label: 'Synced',
          icon: '✓',
          bg: colors.syncedBg,
          text: colors.synced,
          border: '#A7F3D0',
        };
      case 'syncing':
        return {
          label: 'Syncing',
          icon: '↻',
          bg: colors.syncingBg,
          text: colors.syncing,
          border: '#BFDBFE',
        };
      case 'failed':
        return {
          label: 'Failed',
          icon: '✕',
          bg: colors.failedBg,
          text: colors.failed,
          border: '#FECACA',
        };
      case 'pending':
      default:
        return {
          label: 'Pending',
          icon: '⏳',
          bg: colors.pendingBg,
          text: colors.pending,
          border: '#FDE68A',
        };
    }
  };

  const config = getBadgeConfig();
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          paddingVertical: isSmall ? 2 : 4,
          paddingHorizontal: isSmall ? 6 : 10,
        },
      ]}
    >
      <Text style={[styles.icon, { color: config.text, fontSize: isSmall ? 10 : 12 }]}>
        {config.icon}
      </Text>
      <Text
        style={[
          styles.label,
          {
            color: config.text,
            fontSize: isSmall ? 11 : 12,
            fontWeight: isSmall ? '600' : '700',
          },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
    fontWeight: '800',
  },
  label: {
    textTransform: 'capitalize',
  },
});

export default SyncStatusBadge;
