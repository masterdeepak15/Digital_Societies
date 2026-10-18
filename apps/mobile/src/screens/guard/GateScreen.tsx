import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Alert, Vibration, ScrollView, AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useQuery } from '@tanstack/react-query';
import { database }             from '../../database/database';
import VisitorModel             from '../../database/models/VisitorModel';
import { OfflineQueueService }  from '../../services/offline/OfflineQueueService';
import { apiClient }            from '../../services/api/apiClient';
import { useTheme }             from '../../theme/ThemeProvider';
import { Button, Card, Icon, ScreenHeader, TextField } from '../../ui';

/**
 * Guard Gate Screen — primary workflow:
 * 1. Enter visitor details (name, phone, flat, purpose)
 * 2. Save locally (works OFFLINE — syncs when connected)
 * 3. Send approval request to resident via push notification (online only)
 * 4. Show pending / approved / rejected status
 *
 * Design (Control Room theme): large touch targets (min 56px), high contrast, single-handed use.
 */
const PURPOSES = ['Guest', 'Delivery', 'Service', 'Cab', 'Other'];

async function countVisitors(status: 'Pending' | 'Entered'): Promise<number> {
  const { data } = await apiClient.get<{ total?: number; totalCount?: number; items?: unknown[] }>(
    `/visitors?status=${status}&page=1&pageSize=1`,
  );
  return data.total ?? data.totalCount ?? data.items?.length ?? 0;
}

export default function GateScreen() {
  const { colors, fonts, radius } = useTheme();
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

  // Live counts for the header; hidden (not faked) when offline or the server says no.
  const waiting = useQuery({ queryKey: ['gate', 'Pending'], queryFn: () => countVisitors('Pending'), enabled: isOnline, refetchInterval: 30_000, retry: false });
  const inside  = useQuery({ queryKey: ['gate', 'Entered'], queryFn: () => countVisitors('Entered'), enabled: isOnline, refetchInterval: 30_000, retry: false });

  const handleAddVisitor = async () => {
    if (!name.trim() || !flat.trim() || !purpose) {
      Vibration.vibrate(300);
      Alert.alert('Missing info', 'Fill visitor name, flat number and purpose.');
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
      Alert.alert('Visitor added', msg);
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

  const showCounts = isOnline && waiting.data !== undefined && inside.data !== undefined;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.ground }} contentContainerStyle={{ padding: 20, paddingTop: 56, gap: 16 }} keyboardShouldPersistTaps="handled">
      <ScreenHeader
        subtitle="Main gate"
        title="Gate entry"
        right={
          <View
            accessibilityLiveRegion="polite"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: isOnline ? colors.success : colors.warning }} />
            <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 13 }}>
              {isOnline ? 'Online' : 'Offline'}{pendingCount > 0 ? ` · ${pendingCount} to sync` : ''}
            </Text>
          </View>
        }
      />

      {showCounts && (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Card style={{ flex: 1, borderTopWidth: 3, borderTopColor: colors.accent }}>
            <Text style={{ color: colors.muted, fontFamily: fonts.semibold, fontSize: 13 }}>Waiting</Text>
            <Text style={{ color: colors.warning, fontFamily: fonts.extrabold, fontSize: 40, lineHeight: 46 }}>{waiting.data}</Text>
          </Card>
          <Card style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontFamily: fonts.semibold, fontSize: 13 }}>Inside now</Text>
            <Text style={{ color: colors.text, fontFamily: fonts.extrabold, fontSize: 40, lineHeight: 46 }}>{inside.data}</Text>
          </Card>
        </View>
      )}

      <Card style={{ gap: 14 }}>
        <TextField label="Visitor name" value={name} onChangeText={setName} placeholder="Ramesh Kumar" returnKeyType="next" />
        <TextField label="Phone (optional)" value={phone} onChangeText={setPhone} placeholder="98765 43210" keyboardType="number-pad" />
        <TextField label="Flat number" value={flat} onChangeText={setFlat} placeholder="A-204" autoCapitalize="characters" />

        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 14 }}>Purpose</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
            {PURPOSES.map((p) => {
              const selected = purpose === p;
              return (
                <Pressable
                  key={p}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setPurpose(p)}
                  style={{ minHeight: 48, paddingHorizontal: 18, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1.5,
                    borderColor: selected ? colors.primary : colors.line, backgroundColor: selected ? colors.primary : 'transparent' }}>
                  <Text style={{ color: selected ? colors.onPrimary : colors.text, fontFamily: fonts.bold, fontSize: 15 }}>{p}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Card>

      <Button title={saving ? 'Saving…' : 'Add visitor'} icon="plus" onPress={handleAddVisitor} loading={saving} />

      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingHorizontal: 4 }}>
        <Icon name="wifi-off" size={16} color={colors.muted} />
        <Text style={{ flex: 1, color: colors.muted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 }}>
          Works offline. Entries sync automatically when the internet is back. Visitor data is deleted after 7 days.
        </Text>
      </View>
    </ScrollView>
  );
}
