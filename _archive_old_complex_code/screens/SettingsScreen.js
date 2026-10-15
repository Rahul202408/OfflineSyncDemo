/**
 * Settings & Server Configuration Screen
 * 
 * Allows configuring the backend REST API endpoint dynamically for:
 * - Android Emulator (http://10.0.2.2:5000)
 * - Physical Android phone (http://<LAN_IP>:5000)
 * - iOS Simulator / Localhost (http://localhost:5000)
 * 
 * Features live server ping test and MongoDB status inspection.
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
} from 'react-native';
import colors from '../theme/colors';
import { getApiBaseUrl, setApiBaseUrl, checkServerHealth } from '../services/api';

export function SettingsScreen({ onNavigate }) {
  const [currentUrl, setCurrentUrl] = useState(getApiBaseUrl());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleSaveUrl = () => {
    if (!currentUrl || !currentUrl.trim().startsWith('http')) {
      Alert.alert('Invalid URL', 'Please enter a valid HTTP or HTTPS endpoint (e.g. http://10.0.2.2:5000)');
      return;
    }
    setApiBaseUrl(currentUrl);
    Alert.alert('Saved', 'API Base URL updated successfully.');
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setApiBaseUrl(currentUrl);

    const startTime = Date.now();
    try {
      const health = await checkServerHealth();
      const latency = Date.now() - startTime;

      setTestResult({
        success: health.reachable,
        latency,
        data: health.data,
        error: health.error,
      });
    } catch (err) {
      setTestResult({
        success: false,
        error: err.message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const setPreset = (url) => {
    setCurrentUrl(url);
    setApiBaseUrl(url);
    setTestResult(null);
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => onNavigate('home')}>
          <Text style={styles.backButtonText}>← Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Server Settings</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Endpoint Configuration */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Backend API Base URL</Text>
          <Text style={styles.cardSubtitle}>
            Configure the destination address for MongoDB synchronization requests.
          </Text>

          <TextInput
            style={styles.input}
            value={currentUrl}
            onChangeText={setCurrentUrl}
            placeholder="http://10.0.2.2:5000"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.presetsRow}>
            <Text style={styles.presetLabel}>Presets:</Text>
            <TouchableOpacity
              style={styles.presetBtn}
              onPress={() => setPreset('http://192.168.1.48:5000')}
            >
              <Text style={styles.presetBtnText}>📱 Physical Phone (192.168.1.48)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetBtn}
              onPress={() => setPreset('http://10.0.2.2:5000')}
            >
              <Text style={styles.presetBtnText}>💻 Android Emulator (10.0.2.2)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetBtn}
              onPress={() => setPreset('http://localhost:5000')}
            >
              <Text style={styles.presetBtnText}>🔗 Localhost / ADB Reverse</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveUrl}>
              <Text style={styles.saveBtnText}>Save URL</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.testBtn, isTesting && styles.testBtnDisabled]}
              onPress={handleTestConnection}
              disabled={isTesting}
            >
              {isTesting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.testBtnText}>⚡ Ping Server</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Live Test Results Card */}
        {testResult ? (
          <View
            style={[
              styles.testCard,
              testResult.success ? styles.testSuccessCard : styles.testFailedCard,
            ]}
          >
            <View style={styles.testHeader}>
              <Text style={styles.testIcon}>{testResult.success ? '✅' : '❌'}</Text>
              <Text style={styles.testTitle}>
                {testResult.success ? 'Server Connected' : 'Connection Failed'}
              </Text>
              {testResult.latency ? (
                <Text style={styles.latencyText}>{testResult.latency} ms</Text>
              ) : null}
            </View>

            {testResult.success ? (
              <View style={styles.testDetails}>
                <Text style={styles.testDetailLine}>
                  • Backend Service: {testResult.data?.service || 'Online'}
                </Text>
                <Text style={styles.testDetailLine}>
                  • MongoDB Database:{' '}
                  {testResult.data?.database?.connected
                    ? 'Connected (Online)'
                    : 'Disconnected / Connecting'}
                </Text>
                <Text style={styles.testDetailLine}>
                  • Server Uptime: {testResult.data?.uptime || 0} seconds
                </Text>
              </View>
            ) : (
              <View style={styles.testDetails}>
                <Text style={styles.errorText}>
                  Error: {testResult.error || 'Server did not respond'}
                </Text>
                <Text style={styles.helpText}>
                  Make sure the Node.js backend server is running on your machine:
                  {'\n'}cd backend && npm start
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {/* Network Guidance Card */}
        <View style={styles.guideCard}>
          <Text style={styles.guideTitle}>📖 Network Setup Guidance</Text>

          <Text style={styles.guideHeading}>1. Android Emulator:</Text>
          <Text style={styles.guideBody}>
            Use <Text style={styles.bold}>http://10.0.2.2:5000</Text>. Inside the Android emulator, "10.0.2.2" is the special alias that routes to your host computer's localhost.
          </Text>

          <Text style={styles.guideHeading}>2. Physical Android Device:</Text>
          <Text style={styles.guideBody}>
            Use your computer's local Wi-Fi IP address (e.g.{' '}
            <Text style={styles.bold}>http://192.168.1.15:5000</Text>). Both your phone and development computer must be connected to the same Wi-Fi network.
          </Text>

          <Text style={styles.guideHeading}>3. Cleartext HTTP Note:</Text>
          <Text style={styles.guideBody}>
            Android CLI development builds are configured to allow cleartext HTTP for local IP testing. For production apps, use HTTPS endpoints.
          </Text>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 3,
    marginBottom: 14,
  },
  input: {
    backgroundColor: colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  presetsRow: {
    marginBottom: 16,
  },
  presetLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  presetBtn: {
    backgroundColor: colors.surfaceHighlight,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  presetBtnText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  saveBtnText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  testBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  testBtnDisabled: {
    opacity: 0.6,
  },
  testBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  testCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  testSuccessCard: {
    backgroundColor: colors.syncedBg,
    borderColor: '#A7F3D0',
  },
  testFailedCard: {
    backgroundColor: colors.failedBg,
    borderColor: '#FECACA',
  },
  testHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  testIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  testTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  latencyText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  testDetails: {
    marginTop: 4,
  },
  testDetailLine: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 3,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    color: colors.failed,
    fontWeight: '700',
    marginBottom: 6,
  },
  helpText: {
    fontSize: 11,
    color: '#991B1B',
    lineHeight: 16,
  },
  guideCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  guideTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  guideHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 8,
    marginBottom: 2,
  },
  guideBody: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  bold: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
});

export default SettingsScreen;
