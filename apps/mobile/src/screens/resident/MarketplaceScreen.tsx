import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  TextInput, StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';

const colors    = { ...Colors, successLight: '#d4edda', warningLight: '#fff3cd', backgroundSecondary: Colors.divider };
const spacing   = Spacing;
const typography = { ...Typography, body: Typography.body1 };

// ── Types ──────────────────────────────────────────────────────────────────
interface Listing {
  id: string; providerName: string; phone: string;
  category: string; title: string; description: string;
  baseRateRupees: number; rateUnit: string;
  averageRating: number; reviewCount: number;
}
interface Booking {
  id: string; listingId: string; providerName: string; category: string;
  scheduledAt: string; status: string; quotedAmount: number; finalAmount?: number;
  notes?: string; cancelReason?: string; canReview: boolean;
}

const CATEGORIES = ['All','Plumber','Electrician','Carpenter','Painter',
  'Cleaner','PestControl','AcRepair','ApplianceRepair','Gardener','Other'];

const CATEGORY_ICONS: Record<string, string> = {
  Plumber:'🔧', Electrician:'⚡', Carpenter:'🪚', Painter:'🎨',
  Cleaner:'🧹', PestControl:'🪲', AcRepair:'❄️', ApplianceRepair:'🔌',
  Gardener:'🌿', Other:'🛠️',
};

const STATUS_COLORS: Record<string, string> = {
  Pending:'#fff3cd', Confirmed:'#d1ecf1', Completed:'#d4edda', Cancelled:'#f8d7da',
};

const API_BASE = 'http://localhost:8080/api/v1';
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' }, ...opts,
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message ?? 'Error'); }
  return res.json();
}

// ── Book Modal ─────────────────────────────────────────────────────────────
function BookModal({ listing, onClose, onBooked }: {
  listing: Listing | null; onClose: () => void; onBooked: () => void;
}) {
  const [date, setDate]     = useState('');
  const [time, setTime]     = useState('');
  const [notes, setNotes]   = useState('');
  const [loading, setLoading] = useState(false);

  if (!listing) return null;

  const handleBook = async () => {
    if (!date || !time) { Alert.alert('Validation', 'Please enter a date and time.'); return; }
    setLoading(true);
    try {
      await apiFetch('/marketplace/bookings', {
        method: 'POST',
        body: JSON.stringify({
          listingId: listing.id,
          scheduledAt: new Date(`${date}T${time}`).toISOString(),
          quotedAmountRupees: listing.baseRateRupees,
          notes: notes.trim() || undefined,
        }),
      });
      onBooked(); onClose();
      Alert.alert('Booked!', 'Your service has been requested. The provider will confirm shortly.');
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible={!!listing} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Book {listing.title}</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
          <View style={styles.providerCardInModal}>
            <Text style={styles.providerIconLg}>{CATEGORY_ICONS[listing.category] ?? '🛠️'}</Text>
            <View>
              <Text style={styles.providerNameLg}>{listing.providerName}</Text>
              <Text style={styles.providerRateLg}>₹{listing.baseRateRupees}/{listing.rateUnit.replace('Per','')}</Text>
              {listing.reviewCount > 0 && (
                <Text style={styles.providerRatingLg}>
                  ⭐ {listing.averageRating.toFixed(1)} ({listing.reviewCount} reviews)
                </Text>
              )}
            </View>
          </View>

          <Text style={styles.inputLabel}>Date *</Text>
          <TextInput style={styles.textInput} placeholder="YYYY-MM-DD"
            value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation"
            placeholderTextColor={colors.textSecondary} />

          <Text style={styles.inputLabel}>Time *</Text>
          <TextInput style={styles.textInput} placeholder="HH:MM (e.g. 10:00)"
            value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation"
            placeholderTextColor={colors.textSecondary} />

          <Text style={styles.inputLabel}>Notes (optional)</Text>
          <TextInput style={[styles.textInput, { height: 80 }]}
            placeholder="Describe the problem or any specific requirements…"
            value={notes} onChangeText={setNotes} multiline
            placeholderTextColor={colors.textSecondary} />

          <View style={styles.quoteSummary}>
            <Text style={styles.quoteLabel}>Quoted amount</Text>
            <Text style={styles.quoteValue}>₹{listing.baseRateRupees} {listing.rateUnit.replace('Per','per ')}</Text>
          </View>
        </ScrollView>
        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleBook} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> :
              <Text style={styles.submitBtnText}>Confirm Booking</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Review Modal ───────────────────────────────────────────────────────────
function ReviewModal({ bookingId, onClose, onReviewed }: {
  bookingId: string | null; onClose: () => void; onReviewed: () => void;
}) {
  const [rating, setRating]   = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  if (!bookingId) return null;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await apiFetch(`/marketplace/bookings/${bookingId}/review`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment }),
      });
      onReviewed(); onClose();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible={!!bookingId} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Leave a Review</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <View style={styles.modalBody}>
          <Text style={styles.inputLabel}>Rating</Text>
          <View style={styles.starRow}>
            {[1,2,3,4,5].map(s => (
              <TouchableOpacity key={s} onPress={() => setRating(s)}>
                <Text style={styles.star}>{s <= rating ? '⭐' : '☆'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.inputLabel}>Comment</Text>
          <TextInput style={[styles.textInput, { height: 100 }]}
            placeholder="How was your experience?"
            value={comment} onChangeText={setComment} multiline
            placeholderTextColor={colors.textSecondary} />
        </View>
        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> :
              <Text style={styles.submitBtnText}>Submit Review</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────
export default function MarketplaceScreen() {
  const [tab, setTab]                 = useState<'browse'|'bookings'>('browse');
  const [category, setCategory]       = useState('All');
  const [listings, setListings]       = useState<Listing[]>([]);
  const [bookings, setBookings]       = useState<Booking[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [bookTarget, setBookTarget]   = useState<Listing | null>(null);
  const [reviewTarget, setReviewTarget] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    try {
      const cat = category === 'All' ? undefined : category;
      const data = await apiFetch<Listing[]>(`/marketplace/listings${cat ? `?category=${cat}` : ''}`);
      setListings(data);
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [category]);

  const fetchBookings = useCallback(async () => {
    try {
      const data = await apiFetch<Booking[]>('/marketplace/my/bookings');
      setBookings(data);
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  React.useEffect(() => {
    setLoading(true);
    if (tab === 'browse') fetchListings();
    else fetchBookings();
  }, [tab, category]);

  const handleRefresh = () => { setRefreshing(true); tab === 'browse' ? fetchListings() : fetchBookings(); };

  const handleCancel = (bookingId: string) => {
    Alert.alert('Cancel Booking', 'Are you sure?', [
      { text: 'No', style: 'cancel' },
      { text: 'Cancel Booking', style: 'destructive', onPress: async () => {
        try {
          await apiFetch(`/marketplace/bookings/${bookingId}/cancel`,
            { method: 'POST', body: JSON.stringify({ reason: 'Cancelled by resident' }) });
          fetchBookings();
        } catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Marketplace</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['browse','bookings'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'browse' ? '🛍️ Browse' : '📋 My Bookings'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category chips (browse only) */}
      {tab === 'browse' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll} contentContainerStyle={styles.categoryContent}>
          {CATEGORIES.map(c => (
            <TouchableOpacity key={c} style={[styles.catChip, category === c && styles.catChipActive]}
              onPress={() => setCategory(c)}>
              <Text style={[styles.catChipText, category === c && styles.catChipTextActive]}>
                {CATEGORY_ICONS[c] ?? ''} {c}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} size="large" />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh}
            tintColor={colors.primary} />}>

          {tab === 'browse' && (
            listings.length === 0
              ? <View style={styles.empty}><Text style={styles.emptyText}>No services available in this category.</Text></View>
              : listings.map(l => (
                <View key={l.id} style={styles.listingCard}>
                  <View style={styles.listingHeader}>
                    <Text style={styles.listingIcon}>{CATEGORY_ICONS[l.category] ?? '🛠️'}</Text>
                    <View style={styles.listingInfo}>
                      <Text style={styles.listingTitle}>{l.title}</Text>
                      <Text style={styles.listingProvider}>{l.providerName}</Text>
                      {l.reviewCount > 0 && (
                        <Text style={styles.listingRating}>
                          ⭐ {l.averageRating.toFixed(1)}  ({l.reviewCount})
                        </Text>
                      )}
                    </View>
                    <View style={styles.listingRate}>
                      <Text style={styles.listingRateAmount}>₹{l.baseRateRupees}</Text>
                      <Text style={styles.listingRateUnit}>{l.rateUnit.replace('Per','/')}</Text>
                    </View>
                  </View>
                  <Text style={styles.listingDesc} numberOfLines={2}>{l.description}</Text>
                  <TouchableOpacity style={styles.bookBtn} onPress={() => setBookTarget(l)}>
                    <Text style={styles.bookBtnText}>Book Now</Text>
                  </TouchableOpacity>
                </View>
              ))
          )}

          {tab === 'bookings' && (
            bookings.length === 0
              ? <View style={styles.empty}><Text style={styles.emptyText}>No bookings yet.</Text></View>
              : bookings.map(b => (
                <View key={b.id} style={styles.bookingCard}>
                  <View style={styles.bookingHeader}>
                    <Text style={styles.bookingProvider}>{CATEGORY_ICONS[b.category] ?? '🛠️'} {b.providerName}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[b.status] ?? '#eee' }]}>
                      <Text style={styles.statusText}>{b.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.bookingDate}>
                    📅 {new Date(b.scheduledAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                    {'  '}🕐 {new Date(b.scheduledAt).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
                  </Text>
                  <Text style={styles.bookingAmount}>
                    ₹{b.finalAmount ?? b.quotedAmount}
                    {b.finalAmount && b.finalAmount !== b.quotedAmount ? ` (quoted ₹${b.quotedAmount})` : ''}
                  </Text>
                  {b.notes && <Text style={styles.bookingNotes}>📝 {b.notes}</Text>}
                  {b.cancelReason && <Text style={styles.bookingCancel}>❌ {b.cancelReason}</Text>}
                  <View style={styles.bookingActions}>
                    {b.canReview && (
                      <TouchableOpacity style={styles.reviewBtn} onPress={() => setReviewTarget(b.id)}>
                        <Text style={styles.reviewBtnText}>⭐ Review</Text>
                      </TouchableOpacity>
                    )}
                    {(b.status === 'Pending' || b.status === 'Confirmed') && (
                      <TouchableOpacity style={styles.cancelActionBtn} onPress={() => handleCancel(b.id)}>
                        <Text style={styles.cancelActionBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
          )}
        </ScrollView>
      )}

      <BookModal listing={bookTarget} onClose={() => setBookTarget(null)}
        onBooked={() => { setTab('bookings'); fetchBookings(); }} />
      <ReviewModal bookingId={reviewTarget} onClose={() => setReviewTarget(null)}
        onReviewed={fetchBookings} />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerTitle: { ...typography.h2, color: colors.text },

  tabs: { flexDirection: 'row', backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.divider },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { ...typography.body, color: colors.textSecondary },
  tabTextActive: { color: colors.primary, fontWeight: '700' },

  categoryScroll: { maxHeight: 48, backgroundColor: colors.surface },
  categoryContent: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, gap: spacing.xs, alignItems:'center' },
  catChip: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 16,
    borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText: { ...Typography.caption, color: colors.textSecondary },
  catChipTextActive: { color: '#fff', fontWeight: '700' },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },

  empty: { padding: spacing.xl, alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },

  listingCard: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.divider },
  listingHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.xs },
  listingIcon: { fontSize: 32 },
  listingInfo: { flex: 1 },
  listingTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  listingProvider: { ...Typography.caption, color: colors.textSecondary },
  listingRating: { ...Typography.caption, color: colors.textSecondary },
  listingRate: { alignItems: 'flex-end' },
  listingRateAmount: { ...typography.body, color: colors.primary, fontWeight: '700' },
  listingRateUnit: { ...Typography.caption, color: colors.textSecondary },
  listingDesc: { ...Typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  bookBtn: { backgroundColor: colors.primary, paddingVertical: spacing.xs, borderRadius: 8, alignItems: 'center' },
  bookBtnText: { ...typography.body, color: '#fff', fontWeight: '700' },

  bookingCard: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.divider },
  bookingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  bookingProvider: { ...typography.body, color: colors.text, fontWeight: '700', flex: 1 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 12 },
  statusText: { ...Typography.caption, color: colors.text, fontWeight: '600' },
  bookingDate: { ...Typography.caption, color: colors.textSecondary, marginBottom: 2 },
  bookingAmount: { ...typography.body, color: colors.text, fontWeight: '600', marginBottom: 2 },
  bookingNotes: { ...Typography.caption, color: colors.textSecondary, marginBottom: 2 },
  bookingCancel: { ...Typography.caption, color: colors.error },
  bookingActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  reviewBtn: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8,
    backgroundColor: '#fff3cd', borderWidth: 1, borderColor: '#ffc107' },
  reviewBtnText: { ...Typography.caption, color: '#856404', fontWeight: '700' },
  cancelActionBtn: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8,
    borderWidth: 1, borderColor: colors.error },
  cancelActionBtnText: { ...Typography.caption, color: colors.error, fontWeight: '600' },

  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.surface },
  modalTitle: { ...typography.h2, color: colors.text },
  modalClose: { fontSize: 20, color: colors.textSecondary, paddingHorizontal: spacing.sm },
  modalBody: { flex: 1, padding: spacing.md },
  modalFooter: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },

  providerCardInModal: { flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.backgroundSecondary, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
  providerIconLg: { fontSize: 40 },
  providerNameLg: { ...typography.body, color: colors.text, fontWeight: '700' },
  providerRateLg: { ...typography.body, color: colors.primary, fontWeight: '600' },
  providerRatingLg: { ...Typography.caption, color: colors.textSecondary },

  quoteSummary: { backgroundColor: '#d4edda', borderRadius: 8, padding: spacing.md,
    flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  quoteLabel: { ...typography.body, color: '#155724' },
  quoteValue: { ...typography.body, color: '#155724', fontWeight: '700' },

  inputLabel: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm },
  textInput: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.divider,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...typography.body, color: colors.text },
  cancelBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: 8, alignItems: 'center',
    borderWidth: 1, borderColor: colors.divider },
  cancelBtnText: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },
  submitBtn: { flex: 2, backgroundColor: colors.primary, paddingVertical: spacing.sm, borderRadius: 8, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { ...typography.body, color: '#fff', fontWeight: '700' },

  starRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  star: { fontSize: 32 },
});
