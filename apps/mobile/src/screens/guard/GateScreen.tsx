import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Pressable, Alert, Vibration, ScrollView, AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { ViewSwitcher } from '../../ui/ViewSwitcher';
import { DEFAULT_OFFICE, fetchOffice, mayAddVisitor } from '../../services/settings/societyRules';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Q } from '@nozbe/watermelondb';
import { useQuery } from '@tanstack/react-query';
import { database }             from '../../database/database';
import VisitorModel             from '../../database/models/VisitorModel';
import { OfflineQueueService }  from '../../services/offline/OfflineQueueService';
import { apiClient }            from '../../services/api/apiClient';
import { loadFlats }            from '../../services/flats/flatService';
import { apiFetch }             from '../../utils/api';
import { useTheme }             from '../../theme/ThemeProvider';
import { Button, Card, Icon, ScreenHeader, TextField } from '../../ui';
import { MediaImage }           from '../../ui/MediaImage';
import { digitsOnly, filterFlats, matchFlat, validateEntry, type Companion, type EntryForm } from './gateModel';

/**
 * Guard Gate Screen — primary workflow:
 * 1. Enter visitor details (name, phone, flat from the list, purpose, optional photo / ID / vehicle / people)
 * 2. Save locally (works OFFLINE — syncs, and uploads the pictures, when connected)
 * 3. Send approval request to resident via push notification (online only)
 * 4. Show pending / approved / rejected status
 *
 * A returning visitor is found by mobile number so the guard can reuse their last details.
 */
const PURPOSES = ['Guest', 'Delivery', 'Service', 'Cab', 'Other'];
const ID_TYPES: { value: string; label: string }[] = [
  { value: 'aadhaar', label: 'Aadhaar' }, { value: 'driving_licence', label: 'Licence' },
  { value: 'voter_id', label: 'Voter ID' }, { value: 'passport', label: 'Passport' },
  { value: 'pan', label: 'PAN' }, { value: 'other', label: 'Other' },
];
const VEHICLE_TYPES = ['Car', 'Bike', 'Auto', 'Truck'];

interface History {
  found: boolean; name?: string; visitCount: number; lastFlat?: string | null; lastPurpose?: string | null;
  vehicleNumber?: string | null; vehicleType?: string | null; photoMediaId?: string | null;
  idType?: string | null; idLast4?: string | null; companions?: Companion[];
}

const EMPTY: EntryForm = {
  name: '', phone: '', flat: '', purpose: '', vehicleNumber: '', vehicleType: '', idType: '', idLast4: '', companions: [],
};

async function countVisitors(status: 'Pending' | 'Entered'): Promise<number> {
  const { data } = await apiClient.get<{ total?: number; totalCount?: number; items?: unknown[] }>(
    `/visitors?status=${status}&page=1&pageSize=1`,
  );
  return data.total ?? data.totalCount ?? data.items?.length ?? 0;
}

/** Takes a photo and keeps a copy in app storage (the camera's temporary file can be cleared before the phone is online). */
async function takePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Camera needed', 'Allow camera access in Settings to take a visitor photo.');
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6 });
  if (res.canceled || !res.assets?.[0]?.uri) return null;
  const dir = `${FileSystem.documentDirectory}gate/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const to = `${dir}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  await FileSystem.copyAsync({ from: res.assets[0].uri, to });
  return to;
}

export default function GateScreen() {
  const { colors, fonts, radius } = useTheme();
  const [form,         setForm]         = useState<EntryForm>(EMPTY);
  const [photoUri,     setPhotoUri]     = useState<string | null>(null);
  const [photoMediaId, setPhotoMediaId] = useState<string | null>(null);   // kept from a returning visitor
  const [idPhotoUri,   setIdPhotoUri]   = useState<string | null>(null);
  const [flatFocus,    setFlatFocus]    = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [isOnline,     setIsOnline]     = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [localHistory, setLocalHistory] = useState<History | null>(null);
  const set = <K extends keyof EntryForm>(k: K, v: EntryForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  // The society can switch offline entry off (Settings > Security). The last answer is kept, so it still applies with no signal.
  const office = useQuery({ queryKey: ['society-office'], queryFn: fetchOffice, staleTime: 10 * 60_000 });

  const refreshStatus = useCallback(async () => {
    const net   = await NetInfo.fetch();
    setIsOnline(!!net.isConnected && net.isInternetReachable !== false);
    setPendingCount(await OfflineQueueService.pendingCount());
  }, []);

  useEffect(() => {
    refreshStatus();
    const unsub = NetInfo.addEventListener(() => refreshStatus());
    const appSub = AppState.addEventListener('change', (state) => { if (state === 'active') refreshStatus(); });
    return () => { unsub(); appSub.remove(); };
  }, [refreshStatus]);

  const waiting = useQuery({ queryKey: ['gate', 'Pending'], queryFn: () => countVisitors('Pending'), enabled: isOnline, refetchInterval: 30_000, retry: false });
  const inside  = useQuery({ queryKey: ['gate', 'Entered'], queryFn: () => countVisitors('Entered'), enabled: isOnline, refetchInterval: 30_000, retry: false });
  const flatsQuery = useQuery({ queryKey: ['flats'], queryFn: loadFlats, staleTime: 5 * 60_000, retry: 1 });
  const flats = flatsQuery.data ?? [];

  // ── returning visitor, found by mobile number ──────────────────────────────
  const last10 = digitsOnly(form.phone).slice(-10);
  const lookup = useQuery({
    queryKey: ['visitor-lookup', last10],
    queryFn: () => apiFetch<History>(`/visitors/lookup?phone=${last10}`),
    enabled: isOnline && last10.length === 10,
    retry: false,
  });
  // Offline: look in the visits stored on this phone.
  useEffect(() => {
    setLocalHistory(null);
    if (isOnline || last10.length !== 10) return;
    database.get<VisitorModel>('visitors').query(Q.where('phone', Q.like(`%${last10}`))).fetch().then((rows) => {
      if (rows.length === 0) return;
      const r = rows[rows.length - 1];
      setLocalHistory({ found: true, name: r.name, visitCount: rows.length, lastFlat: r.flatNumber, lastPurpose: r.purpose,
        vehicleNumber: r.vehicleNumber, vehicleType: r.vehicleType, photoMediaId: r.photoMediaId, idType: r.idType, idLast4: r.idLast4 });
    }).catch(() => {});
  }, [isOnline, last10]);
  const history: History | null = last10.length === 10 ? (lookup.data?.found ? lookup.data : localHistory) : null;

  const useHistory = (h: History) => {
    setForm((f) => ({
      ...f,
      name: f.name || h.name || '',
      vehicleNumber: f.vehicleNumber || h.vehicleNumber || '',
      vehicleType: f.vehicleType || h.vehicleType || '',
      idType: f.idType || h.idType || '',
      idLast4: f.idLast4 || h.idLast4 || '',
      companions: f.companions.length ? f.companions : (h.companions ?? []),
    }));
    if (h.photoMediaId && !photoUri) setPhotoMediaId(h.photoMediaId);
  };

  const suggestions = useMemo(
    () => (flatFocus && !matchFlat(flats, form.flat) ? filterFlats(flats, form.flat) : []),
    [flatFocus, flats, form.flat],
  );

  const reset = () => { setForm(EMPTY); setPhotoUri(null); setPhotoMediaId(null); setIdPhotoUri(null); };

  const handleAddVisitor = async () => {
    const check = validateEntry(form, flats);
    if (!check.ok) {
      Vibration.vibrate(300);
      Alert.alert('Check the entry', check.message);
      return;
    }
    if (!mayAddVisitor(isOnline, office.data ?? DEFAULT_OFFICE)) {
      Vibration.vibrate(300);
      Alert.alert('No internet', 'Your society has switched off offline entry. Connect to the internet to add this visitor.');
      return;
    }
    setSaving(true);
    try {
      await database.write(async () => {
        await database.get<VisitorModel>('visitors').create((v) => {
          v.name           = form.name.trim();
          v.phone          = form.phone.trim();
          v.flatNumber     = check.flat;
          v.purpose        = form.purpose;
          v.status         = 'pending';
          v.entryTime      = new Date();
          v.isSynced       = false;
          v.vehicleNumber  = form.vehicleNumber.trim().toUpperCase() || null;
          v.vehicleType    = form.vehicleType || null;
          v.photoUri       = photoUri;
          v.photoMediaId   = photoUri ? null : photoMediaId;
          v.idType         = form.idType || null;
          v.idLast4        = form.idLast4.trim() || null;
          v.idPhotoUri     = idPhotoUri;
          v.companions     = form.companions.length ? JSON.stringify(form.companions.map((c) => ({ name: c.name.trim(), phone: c.phone?.trim() || undefined }))) : null;
        });
      });

      Vibration.vibrate([0, 100, 50, 100]);
      Alert.alert('Visitor added', isOnline ? `Notifying resident in flat ${check.flat}…` : 'Saved locally. Will notify when internet is restored.');
      reset();
      if (isOnline) OfflineQueueService.flushNow().catch(console.warn);
      await refreshStatus();
    } catch (e) {
      Alert.alert('Error', 'Could not save. Check storage.');
    } finally {
      setSaving(false);
    }
  };

  const showCounts = isOnline && waiting.data !== undefined && inside.data !== undefined;
  const chip = (label: string, selected: boolean, onPress: () => void) => (
    <Pressable key={label} accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress}
      style={{ minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1.5,
        borderColor: selected ? colors.primary : colors.line, backgroundColor: selected ? colors.primary : 'transparent' }}>
      <Text style={{ color: selected ? colors.onPrimary : colors.text, fontFamily: fonts.bold, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
  const label = (t: string) => <Text style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 14 }}>{t}</Text>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.ground }} contentContainerStyle={{ padding: 20, paddingTop: 56, gap: 16 }} keyboardShouldPersistTaps="handled">
      <ScreenHeader
        subtitle="Main gate"
        title="Gate entry"
        right={
          <View accessibilityLiveRegion="polite"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: isOnline ? colors.success : colors.warning }} />
            <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 13 }}>
              {isOnline ? 'Online' : 'Offline'}{pendingCount > 0 ? ` · ${pendingCount} to sync` : ''}
            </Text>
          </View>
        }
      />

      <ViewSwitcher />

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
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <MediaImage id={photoMediaId} uri={photoUri} size={84} />
          <View style={{ flex: 1, gap: 8 }}>
            <Button title={photoUri || photoMediaId ? 'Retake photo' : 'Take visitor photo'} icon="camera" variant="secondary"
              onPress={async () => { const u = await takePhoto(); if (u) { setPhotoUri(u); setPhotoMediaId(null); } }} />
          </View>
        </View>

        <TextField label="Mobile number (optional)" value={form.phone} onChangeText={(v) => set('phone', v)} placeholder="98765 43210" keyboardType="number-pad" />

        {history?.found && (
          <View style={{ borderWidth: 1, borderColor: colors.accent, borderRadius: radius.control, padding: 12, gap: 8, backgroundColor: colors.surface }}>
            <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 15 }}>
              Seen before: {history.name} · {history.visitCount} {history.visitCount === 1 ? 'visit' : 'visits'}
            </Text>
            <Text style={{ color: colors.muted, fontFamily: fonts.regular, fontSize: 13 }}>
              {[history.lastFlat && `last to ${history.lastFlat}`, history.lastPurpose, history.vehicleNumber].filter(Boolean).join(' · ')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              {history.photoMediaId ? <MediaImage id={history.photoMediaId} size={56} /> : null}
              <View style={{ flex: 1 }}><Button title="Use these details" variant="secondary" onPress={() => useHistory(history)} /></View>
            </View>
          </View>
        )}

        <TextField label="Visitor name" value={form.name} onChangeText={(v) => set('name', v)} placeholder="Ramesh Kumar" returnKeyType="next" />

        <View style={{ gap: 8 }}>
          <TextField label="Flat (choose from the list)" value={form.flat} onChangeText={(v) => set('flat', v)} placeholder={flats.length ? 'Type A-204 or pick below' : 'Loading flats…'}
            autoCapitalize="characters" onFocus={() => setFlatFocus(true)} onBlur={() => setTimeout(() => setFlatFocus(false), 150)} />
          {suggestions.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {suggestions.map((f) => chip(f, false, () => { set('flat', f); setFlatFocus(false); }))}
            </View>
          )}
          {flatsQuery.isError && <Text style={{ color: colors.danger, fontFamily: fonts.regular, fontSize: 13 }}>Could not load the flat list. Connect once to save it on this phone.</Text>}
        </View>

        <View style={{ gap: 8 }}>
          {label('Purpose')}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
            {PURPOSES.map((p) => chip(p, form.purpose === p, () => set('purpose', p)))}
          </View>
        </View>
      </Card>

      <Card style={{ gap: 12 }}>
        {label(form.companions.length ? `People with this visitor (${form.companions.length})` : 'People with this visitor (optional)')}
        {form.companions.map((c, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <TextField label={`Person ${i + 2}`} value={c.name} placeholder="Name"
                onChangeText={(v) => set('companions', form.companions.map((x, j) => (j === i ? { ...x, name: v } : x)))} />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove person ${i + 2}`} onPress={() => set('companions', form.companions.filter((_, j) => j !== i))}
              style={{ height: 48, width: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="x" size={22} />
            </Pressable>
          </View>
        ))}
        {form.companions.length < 10 && <Button title="Add another person" icon="user-plus" variant="secondary" onPress={() => set('companions', [...form.companions, { name: '' }])} />}
      </Card>

      <Card style={{ gap: 12 }}>
        {label('Vehicle (optional)')}
        <TextField label="Vehicle number" value={form.vehicleNumber} onChangeText={(v) => set('vehicleNumber', v)} placeholder="MH12AB1234" autoCapitalize="characters" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {VEHICLE_TYPES.map((t) => chip(t, form.vehicleType === t, () => set('vehicleType', form.vehicleType === t ? '' : t)))}
        </View>
      </Card>

      <Card style={{ gap: 12 }}>
        {label('Government ID (optional)')}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {ID_TYPES.map((t) => chip(t.label, form.idType === t.value, () => set('idType', form.idType === t.value ? '' : t.value)))}
        </View>
        {!!form.idType && (
          <>
            <TextField label="Last 4 characters of the ID number" value={form.idLast4} onChangeText={(v) => set('idLast4', v.replace(/\s/g, '').slice(0, 4))} placeholder="9012" autoCapitalize="characters" />
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <MediaImage uri={idPhotoUri} size={64} />
              <View style={{ flex: 1 }}>
                <Button title={idPhotoUri ? 'Retake ID photo' : 'Photo of the ID'} icon="camera" variant="secondary"
                  onPress={async () => { const u = await takePhoto(); if (u) setIdPhotoUri(u); }} />
              </View>
            </View>
            <Text style={{ color: colors.muted, fontFamily: fonts.regular, fontSize: 12 }}>Only the last 4 characters of the number are kept.</Text>
          </>
        )}
      </Card>

      <Button title={saving ? 'Saving…' : 'Add visitor'} icon="plus" onPress={handleAddVisitor} loading={saving} />

      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingHorizontal: 4 }}>
        <Icon name="wifi-off" size={16} color={colors.muted} />
        <Text style={{ flex: 1, color: colors.muted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 }}>
          Works offline. Entries and pictures sync automatically when the internet is back. Visitor data is deleted after 7 days.
        </Text>
      </View>
    </ScrollView>
  );
}
