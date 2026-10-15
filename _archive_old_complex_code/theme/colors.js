/**
 * Application Theme & Design Tokens
 * 
 * Consistent, accessible color palette for the offline-first sync app.
 */

export const colors = {
  // Primary Brand Colors
  primary: '#2563EB',        // Royal Blue
  primaryDark: '#1D4ED8',
  primaryLight: '#DBEAFE',

  // Status Colors (Matching requirements)
  synced: '#10B981',         // Emerald Green
  syncedBg: '#D1FAE5',
  pending: '#F59E0B',        // Amber
  pendingBg: '#FEF3C7',
  syncing: '#3B82F6',        // Blue
  syncingBg: '#EFF6FF',
  failed: '#EF4444',         // Red
  failedBg: '#FEE2E2',

  // Neutral Colors
  background: '#F8FAFC',     // Slate light
  surface: '#FFFFFF',        // Pure white card
  surfaceHighlight: '#F1F5F9',
  
  // Text Colors
  textPrimary: '#0F172A',    // Slate 900
  textSecondary: '#475569',  // Slate 600
  textMuted: '#94A3B8',      // Slate 400
  textOnPrimary: '#FFFFFF',

  // Borders & Dividers
  border: '#E2E8F0',
  borderDark: '#CBD5E1',

  // Network State
  online: '#10B981',
  offline: '#64748B',
};

export default colors;
