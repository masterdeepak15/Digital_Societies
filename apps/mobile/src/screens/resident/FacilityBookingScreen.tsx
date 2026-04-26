import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';

const colors  = { ...Colors, backgroundSecondary: Colors.divider };
const spacing = Spacing;
const typography = { ...Typography, body: Typography.body1 };
import { apiClient } from '../../services/api/apiClient';

// ── Types ──────────────────────────────────────────────────────────────────
interface Facility {
  id: string;
  name: string;
  description: string;
  capacity: number;
  maxAdvanceBookingDays: number;
  maxHoursPerBooking: number;
  isActive: boolean;
}

interface Booking {
  id: string;
  facilityId: string;
  facilityName: string;
  bookingDate: string;
  startTime: string; // "HH:mm"
  endTime: string;
  status: 'Confirmed' | 'Cancelled';
  createdAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0];

const formatDate = (d: string) => {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const HOURS = Array.from({ length: 16 }, (_, i) => {
  const h = i + 6; // 06:00 – 21:00
  return `${String(h).padStart(2, '0')}:00`;
});

// ── Main Screen ────────────────────────────────────────────────────────────
export default function FacilityBookingScreen() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab]               = useState<'facilities' | 'mybookings'>('facilities');
  const [showBook, setShowBook]     = useState(false);
  const [selected, setSelected]     = useState<Facility | null>(null);
  const [form, setForm]             = useState({
    bookingDate: today(),
    startTime: '09:00',
    endTime: '10:00',
  });

  const load = useCallback(async () => {
    try {
      const [fac, bk] = await Promise.all([
        apiClient.get<{ items: Facility[] }>('/facilities'),
        apiClient.get<{ items: Booking[] }>('/facilities/my-bookings'),
      ]);
      setFacilities(fac.items.filter(f => f.isActive));
      setMyBookings(bk.items);
    } catch {
      Alert.alert('Error', 'Failed to load facilities.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const openBook = (facility: Facility) => {
    setSelected(facility);
    setForm({ bookingDate: today(), startTime: '09:00', endTime: '10:00' });
    setShowBook(true);
  };

  const confirmBook = async () => {
    if (!selected) return;
    if (form.startTime >= form.endTime) {
      Alert.alert('Validation', 'Start time must be before end time.');
      return;
    }
    try {
      await apiClient.post('/facilities/bookings', {
        facilityId: selected.id,
        bookingDate: form.bookingDate,
        startTime: form.startTime,
        endTime: form.endTime,
      });
      setShowBook(false);
      load();
      Alert.alert('Success', `${selected.name} booked successfully!`);
    } catch (e: any) {
      Alert.alert('Booking Failed', e?.message ?? 'Slot may already be taken.');
    }
  };

  const cancelBooking = (id: string) => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'No' },
      {
        text: 'Yes, Cancel', style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.post(`/facilities/bookings/${id}/cancel`, {});
            load();
          } catch {
            Alert.alert('Error', 'Failed to cancel booking.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const upcomingBookings = myBookings.filter(b => b.status === 'Confirmed' && b.bookingDate >= today());
  const pastBookings     = myBookings.filter(b => b.status !== 'Confirmed' || b.bookingDate < today());

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Facility Booking</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['facilities', 'mybookings'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.activeTab]}
            onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.activeTabText]}>
              {t === 'facilities' ? 'Book a Facility' : 'My Bookings'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

        {/* ── Facilities list ── */}
        {tab === 'facilities' && (
          <View style={styles.section}>
            {facilities.length === 0 && (
              <Text style={styles.emptyText}>No facilities available right now.</Text>
            )}
            {facilities.map(f => (
              <View key={f.id} style={styles.facilityCard}>
                <View style={styles.facilityInfo}>
                  <Text style={styles.facilityName}>{f.name}</Text>
                  <Text style={styles.facilityDesc}>{f.description}</Text>
                  <View style={styles.facilityMeta}>
                    <Text style={styles.metaTag}>👥 Capacity: {f.capacity}</Text>
                    <Text style={styles.metaTag}>⏱ Max {f.maxHoursPerBooking}h/slot</Text>
                    <Text style={styles.metaTag}>📅 Book up to {f.maxAdvanceBookingDays}d ahead</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.bookBtn} onPress={() => openBook(f)}>
                  <Text style={styles.bookBtnText}>Book</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ── My bookings ── */}
        {tab === 'mybookings' && (
          <View style={styles.section}>
            {upcomingBookings.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Upcoming</Text>
                {upcomingBookings.map(b => (
                  <View key={b.id} style={styles.bookingCard}>
                    <View style={styles.bookingLeft}>
                      <Text style={styles.bookingFacility}>{b.facilityName}</Text>
                      <Text style={styles.bookingDate}>{formatDate(b.bookingDate)}</Text>
                      <Text style={styles.bookingTime}>{b.startTime} – {b.endTime}</Text>
                    </View>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => cancelBooking(b.id)}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {pastBookings.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Past</Text>
                {pastBookings.map(b => (
                  <View key={b.id} style={[styles.bookingCard, styles.pastCard]}>
                    <View style={styles.bookingLeft}>
                      <Text style={styles.bookingFacility}>{b.facilityName}</Text>
                      <Text style={styles.bookingDate}>{formatDate(b.bookingDate)}</Text>
                      <Text style={styles.bookingTime}>{b.startTime} – {b.endTime}</Text>
                    </View>
                    <View style={[styles.statusBadge, {
                      backgroundColor: b.status === 'Cancelled' ? colors.errorLight : colors.successLight,
                    }]}>
                      <Text style={styles.statusText}>{b.status}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            {myBookings.length === 0 && (
              <Text style={styles.emptyText}>No bookings yet. Book a facility to get started!</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Book Modal ── */}
      <Modal visible={showBook} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Book {selected?.name}</Text>
          {selected && (
            <Text style={styles.modalSubtitle}>
              Capacity: {selected.capacity} · Max {selected.maxHoursPerBooking}h per slot
            </Text>
          )}

          <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={form.bookingDate}
            onChangeText={v => setForm(p => ({ ...p, bookingDate: v }))}
            placeholder={today()}
          />

          <Text style={styles.fieldLabel}>Start Time</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScroll}>
            {HOURS.map(h => (
              <TouchableOpacity key={h}
                style={[styles.timeChip, form.startTime === h && styles.timeChipActive]}
                onPress={() => setForm(p => ({ ...p, startTime: h }))}>
                <Text style={[styles.timeChipText, form.startTime === h && { color: '#fff' }]}>{h}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>End Time</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScroll}>
            {HOURS.filter(h => h > form.startTime).map(h => (
              <TouchableOpacity key={h}
                style={[styles.timeChip, form.endTime === h && styles.timeChipActive]}
                onPress={() => setForm(p => ({ ...p, endTime: h }))}>
                <Text style={[styles.timeChipText, form.endTime === h && { color: '#fff' }]}>{h}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowBook(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalConfirm} onPress={confirmBook}>
              <Text style={styles.modalConfirmText}>Confirm Booking</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.background },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:         { padding: spacing.md, backgroundColor: colors.surface,
                    borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle:    { ...typography.h2 },
  tabs:           { flexDirection: 'row', backgroundColor: colors.surface,
                    borderBottomWidth: 1, borderBottomColor: colors.border },
  tab:            { flex: 1, paddingVertical: spacing.sm, alignItems: 'center' },
  activeTab:      { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText:        { ...typography.body, color: colors.textSecondary },
  activeTabText:  { color: colors.primary, fontWeight: '600' },
  section:        { padding: spacing.md, gap: spacing.sm },
  sectionTitle:   { ...typography.h3, marginBottom: spacing.xs },
  emptyText:      { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
  facilityCard:   { backgroundColor: colors.surface, borderRadius: 10, padding: spacing.md,
                    flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  facilityInfo:   { flex: 1, gap: spacing.xs },
  facilityName:   { ...typography.h3 },
  facilityDesc:   { ...typography.body, color: colors.textSecondary },
  facilityMeta:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  metaTag:        { ...typography.caption, backgroundColor: colors.backgroundSecondary,
                    paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: 4 },
  bookBtn:        { backgroundColor: colors.primary, paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm, borderRadius: 8 },
  bookBtnText:    { color: '#fff', fontWeight: '600' },
  bookingCard:    { backgroundColor: colors.surface, borderRadius: 10, padding: spacing.md,
                    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                    borderLeftWidth: 4, borderLeftColor: colors.primary },
  pastCard:       { borderLeftColor: colors.border, opacity: 0.7 },
  bookingLeft:    { flex: 1, gap: 2 },
  bookingFacility:{ ...typography.body, fontWeight: '600' },
  bookingDate:    { ...typography.caption, color: colors.textSecondary },
  bookingTime:    { ...typography.caption, color: colors.primary },
  cancelBtn:      { borderWidth: 1, borderColor: colors.error, paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xs, borderRadius: 6 },
  cancelBtnText:  { ...typography.caption, color: colors.error, fontWeight: '600' },
  statusBadge:    { paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: 4 },
  statusText:     { ...typography.caption, fontWeight: '600' },
  modal:          { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  modalTitle:     { ...typography.h2, marginBottom: spacing.xs },
  modalSubtitle:  { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  fieldLabel:     { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  input:          { borderWidth: 1, borderColor: colors.border, borderRadius: 8,
                    padding: spacing.sm, ...typography.body, marginBottom: spacing.md,
                    backgroundColor: colors.surface },
  timeScroll:     { marginBottom: spacing.md },
  timeChip:       { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 16,
                    borderWidth: 1, borderColor: colors.border, marginRight: spacing.xs },
  timeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  timeChipText:   { ...typography.caption },
  modalActions:   { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  modalCancel:    { flex: 1, padding: spacing.md, borderRadius: 8, borderWidth: 1,
                    borderColor: colors.border, alignItems: 'center' },
  modalCancelText:{ ...typography.body },
  modalConfirm:   { flex: 1, padding: spacing.md, borderRadius: 8,
                    backgroundColor: colors.primary, alignItems: 'center' },
  modalConfirmText:{ color: '#fff', fontWeight: '600', ...typography.body },
});
