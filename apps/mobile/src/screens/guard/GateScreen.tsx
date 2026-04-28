import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, Vibration, ScrollView, AppState,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { database }             from '../../database/database';
import VisitorModel             from '../../database/models/VisitorModel';
import { OfflineQueueService }  from '../../services/offline/OfflineQueueService';
import { Colors }     from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

/**
 * Guard Gate Screen — primary workflow:
 * 1. Enter visitor details (name, phone, flat, purpose)
 * 2. Save locally (works OFFLINE — syncs when connected)
 * 3. Send approval request to resident via push notification (online only)
 * 4. Show pending / approved / rejected status
 *
 * Design: large touch targets (min 56px), high contrast, single-handed use.
 */
export default function GateScreen() {
  const [name,         setName]         = useState('');
  const [phone,        setPhone]        = useState('');
  const [flat,         setFlat]         = useState('');
  const [purpose,      setPurpose]      = useState('');
  const [saving,       setSaving]       = useState(false);
  const [isOnline,     setIsOnline]     = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  // Track connectivity + pending-sync count
  const refreshStatus = useCallback(async () => {
    const net   = await NetInfo.fetch();
    setIsOnline(!!net.isConnected && net.isInternetReachable !== false);
    const count = await OfflineQueueService.pendingCount();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    refreshStatus();
    const unsub = NetInfo.addEventListener(() => refreshStatus());
    // Also refresh when app comes to foreground
    const appSub = AppState.addEventListener('change', state => {
      if (state === 'active') refreshStatus();
    });
    return () => { unsub(); appSub.remove(); };
  }, [refreshStatus]);

  const PURPOSES = ['Guest', 'Delivery', 'Service', 'Cab', 'Other'];

  const handleAddVisitor = async () => {
    if (!name.trim() || !flat.trim() || !purpose) {
      Vibration.vibrate(300);
      Alert.alert('Missing Info', 'Fill visitor name, flat number and purpose.');
      return;
    }

    setSaving(true);
    try {
      // Write to local SQLite immediately — works offline
      await database.write(async () => {
        await database.get<VisitorModel>('visitors').create((v) => {
          v.name        = name.trim();
          v.phone       = phone.trim();
          v.flatNumber  = flat.trim().toUpperCase();
          v.purpose     = purpose;
          v.status      = 'pending';
          v.entryTime   = new Date();
          v.isSynced    = false;        // will sync when online
        });
      });

      Vibration.vibrate([0, 100, 50, 100]);
      const msg = isOnline
        ? `Notifying resident in flat ${flat.toUpperCase()}…`
        : `Saved locally. Will notify when internet is restored.`;
      Alert.alert('✅ Visitor Added', msg);
      setName(''); setPhone(''); setFlat(''); setPurpose('');
      // If online, try to flush the queue immediately
      if (isOnline) OfflineQueueService.flushNow().catch(console.warn);
      await refreshStatus();
    } catch (e) {
      Alert.alert('Error', 'Could not save. Check storage.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Connectivity status bar */}
      <View style={[styles.statusBar, isOnline ? styles.statusOnline : styles.statusOffline]}>
        <Text style={styles.statusText}>
          {isOnline ? '● Online' : '⚠ Offline — entries save locally'}
          {pendingCount > 0 ? `  ·  ${pendingCount} pending sync` : ''}
        </Text>
        {!isOnline && pendingCount === 0 && (
          <Text style={styles.statusSubtext}>Connect to sync {pendingCount} entries</Text>
        )}
      </View>

      <Text style={styles.header}>🚪 Gate Entry</Text>

      <Text style={styles.label}>Visitor Name *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ramesh Kumar"
        value={name} onChangeText={setName}
        returnKeyType="next"
      />

      <Text style={styles.label}>Phone (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="98765 43210"
        keyboardType="number-pad"
        value={phone} onChangeText={setPhone}
      />

      <Text style={styles.label}>Flat Number *</Text>
      <TextInput
        style={styles.input}
        placeholder="A-204"
        autoCapitalize="characters"
        value={flat} onChangeText={setFlat}
      />

      <Text style={styles.label}>Purpose *</Text>
      <View style={styles.purposeRow}>
        {PURPOSES.map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.chip, purpose === p && styles.chipActive]}
            onPress={() => setPurpose(p)}>
            <Text style={[styles.chipText, purpose === p && styles.chipTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.addBtn, saving && styles.addBtnDisabled]}
        onPress={handleAddVisitor}
        disabled={saving}
        activeOpacity={0.8}>
        <Text style={styles.addBtnText}>{saving ? 'Saving…' : '+ ADD VISITOR'}</Text>
      </TouchableOpacity>

      <View style={styles.offlineBanner}>
        <Text style={styles.offlineText}>
          📶 Works offline — entries sync automatically when internet is available
        </Text>
        <Text style={styles.offlineText}>
          🔒 Visitor data auto-deleted after 7 days
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  header:         { ...Typography.h2, color: Colors.primary, marginBottom: Spacing.lg, marginTop: Spacing.md },
  label:          { ...Typography.guardLabel, color: Colors.textPrimary, marginBottom: Spacing.xs, marginTop: Spacing.md },
  input:          {
    borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.md,
    padding: Spacing.md, ...Typography.guardAction,
    backgroundColor: Colors.surface, minHeight: 56,
  },
  purposeRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
  chip:           {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, borderWidth: 2, borderColor: Colors.primary,
    backgroundColor: Colors.surface, minHeight: 44, justifyContent: 'center',
  },
  chipActive:     { backgroundColor: Colors.primary },
  chipText:       { ...Typography.guardLabel, color: Colors.primary },
  chipTextActive: { color: Colors.textOnPrimary },
  addBtn:         {
    backgroundColor: Colors.secondary, borderRadius: Radius.md,
    padding: Spacing.lg, alignItems: 'center', marginTop: Spacing.xl,
    minHeight: 64, justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.6 },
  addBtnText:     { ...Typography.guardAction, color: Colors.textOnPrimary, letterSpacing: 1 },
  offlineBanner:  { backgroundColor: Colors.info + '22', borderRadius: Radius.md, padding: Spacing.sm, marginTop: Spacing.lg },
  offlineText:    { ...Typography.caption, color: Colors.info, textAlign: 'center', marginBottom: 2 },
  statusBar:      { borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, marginBottom: Spacing.sm },
  statusOnline:   { backgroundColor: '#d1fae5' },
  statusOffline:  { backgroundColor: '#fef3c7' },
  statusText:     { ...Typography.caption, color: Colors.textPrimary, fontWeight: '600' },
  statusSubtext:  { ...Typography.caption, color: Colors.textSecondary },
});
