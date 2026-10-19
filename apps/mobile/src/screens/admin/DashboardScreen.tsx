import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ViewSwitcher } from '../../ui/ViewSwitcher';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../services/api/apiClient';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { apiFetch } from '../../utils/api';
import { errorMessage } from '../../utils/errorMessage';
import { toBillSummary, toGenerateBody, type BillSummary } from './summaryModel';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RecentComplaint {
  id: string;
  ticketNumber: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
}

interface RecentNotice {
  id: string;
  title: string;
  type: string;
  createdAt: string;
}

const formatINR = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const currentYear  = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

// ── API ────────────────────────────────────────────────────────────────────────

const fetchBillSummary = async (_societyId: string): Promise<BillSummary> => {
  // The server uses the signed-in society; the flat-label map turns defaulter flat ids into "A-101".
  const [raw, labels] = await Promise.all([
    apiFetch<any>(`/billing/summary?year=${currentYear}&month=${currentMonth}`),
    apiFetch<Record<string, string>>('/billing/flat-labels').catch(() => ({} as Record<string, string>)),
  ]);
  return toBillSummary(raw, labels);
};

const fetchRecentComplaints = async (_societyId: string): Promise<RecentComplaint[]> => {
  const { data } = await apiClient.get<{ items: RecentComplaint[] }>(
    `/complaints?page=1&pageSize=5`
  );
  return data.items;
};

const fetchRecentNotices = async (): Promise<RecentNotice[]> => {
  const { data } = await apiClient.get<{ items: RecentNotice[] }>(
    `/notices?page=1&pageSize=3`
  );
  return data.items;
};

const generateBills = async (payload: {
  societyId: string;
  periodYear: number;
  periodMonth: number;
  amountPaise: number;
}) => {
  const { data } = await apiClient.post('/billing/generate', toGenerateBody(payload.periodYear, payload.periodMonth, payload.amountPaise));
  return data;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminDashboardScreen() {
  const { activeSocietyId, societyName } = useAuthStore();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const societyId = activeSocietyId ?? '';

  const {
    data: billing,
    isLoading: billingLoading,
    refetch: refetchBilling,
  } = useQuery({
    queryKey: ['admin-billing-summary', societyId],
    queryFn: () => fetchBillSummary(societyId),
    enabled: !!societyId,
    staleTime: 60_000,
  });

  const {
    data: complaints,
    isLoading: complaintsLoading,
    refetch: refetchComplaints,
  } = useQuery({
    queryKey: ['admin-recent-complaints', societyId],
    queryFn: () => fetchRecentComplaints(societyId),
    enabled: !!societyId,
    staleTime: 30_000,
  });

  const {
    data: notices,
    isLoading: noticesLoading,
    refetch: refetchNotices,
  } = useQuery({
    queryKey: ['admin-recent-notices'],
    queryFn: fetchRecentNotices,
    enabled: !!societyId,
    staleTime: 60_000,
  });

  // The monthly maintenance the society saved in Settings > Billing (0 = not set).
  const { data: defaults } = useQuery({
    queryKey: ['billing-defaults'],
    queryFn: async () => (await apiClient.get<{ maintenanceAmount: number }>('/billing/defaults')).data,
    enabled: !!societyId,
    staleTime: 60_000,
  });

  const generateMutation = useMutation({
    mutationFn: generateBills,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-billing-summary'] });
      const g = data?.generated ?? {};
      Alert.alert('Bills generated', `${g.billsCreated ?? 0} created, ${g.billsSkipped ?? 0} already existed for ${g.period ?? 'this month'}.`);
    },
    onError: (e: any) => Alert.alert('Could not generate bills', errorMessage(e, 'Please try again.')),
  });

  // Same amount as the current bills (or Rs 1,500 for a society with none yet), confirmed before anything is created.
  const confirmGenerate = () => {
    const configured = Math.round((defaults?.maintenanceAmount ?? 0) * 100);
    const perFlat = configured > 0 ? configured
      : billing && billing.totalFlats > 0 ? Math.round(billing.totalDuePaise / billing.totalFlats) : 150000;
    const month = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    Alert.alert(
      'Generate bills',
      `Create ${month} bills of ${formatINR(perFlat)} for every flat? Flats that already have one are skipped.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Generate', onPress: () => generateMutation.mutate({ societyId: societyId ?? '', periodYear: currentYear, periodMonth: currentMonth, amountPaise: perFlat }) },
      ],
    );
  };

  const onRefresh = () => {
    refetchBilling();
    refetchComplaints();
    refetchNotices();
  };

  const isLoading = billingLoading || complaintsLoading || noticesLoading;

  const statusColor: Record<string, string> = {
    Open: Colors.info, InProgress: Colors.warning,
    Resolved: Colors.success, Closed: Colors.textSecondary,
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <View>
          <Text style={styles.societyName}>{societyName ?? 'Society'}</Text>
          <Text style={styles.periodLabel}>
            {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.generateBtn, generateMutation.isPending && styles.generateBtnDisabled]}
          onPress={confirmGenerate}
          disabled={generateMutation.isPending}>
          <Text style={styles.generateBtnText}>
            {generateMutation.isPending ? '...' : '+ Gen Bills'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm }}>
        <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('Parking')}>
          <Text style={{ color: Colors.primary, fontWeight: '700' }}>Parking management →</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm }}><ViewSwitcher /></View>

      {/* ── Billing summary cards ──────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>Maintenance Collection</Text>

      {billing ? (
        <>
          {/* Collection progress bar */}
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressAmount}>{formatINR(billing.collectedPaise)}</Text>
              <Text style={styles.progressTotal}>of {formatINR(billing.totalDuePaise)}</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[styles.progressBarFill,
                  { width: `${Math.min(billing.collectionPercentage, 100)}%` }
                ]}
              />
            </View>
            <Text style={styles.progressPct}>
              {billing.collectionPercentage.toFixed(1)}% collected
            </Text>
          </View>

          {/* Stat grid */}
          <View style={styles.statsGrid}>
            <StatCard label="Paid"    value={billing.paidCount}    color={Colors.success} />
            <StatCard label="Pending" value={billing.pendingCount}  color={Colors.warning} />
            <StatCard label="Overdue" value={billing.overdueCount}  color={Colors.error} />
            <StatCard label="Total"   value={billing.totalFlats}    color={Colors.primary} />
          </View>

          {/* Defaulters */}
          {billing.defaulters.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Defaulters ({billing.defaulters.length})</Text>
              <View style={styles.defaultersList}>
                {billing.defaulters.slice(0, 5).map(d => (
                  <View key={d.flatId} style={styles.defaulterRow}>
                    <View>
                      <Text style={styles.defaulterFlat}>{d.flatDisplay}</Text>
                      <Text style={styles.defaulterOwner}>{d.ownerName}</Text>
                    </View>
                    <Text style={styles.defaulterAmount}>
                      {formatINR(d.amountDuePaise)}
                    </Text>
                  </View>
                ))}
                {billing.defaulters.length > 5 && (
                  <Text style={styles.moreLink}>
                    +{billing.defaulters.length - 5} more — view full list →
                  </Text>
                )}
              </View>
            </>
          )}
        </>
      ) : (
        <Text style={styles.emptyText}>No billing data for this period.</Text>
      )}

      {/* ── Recent complaints ────────────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>Recent Complaints</Text>
      {complaints && complaints.length > 0 ? (
        <View style={styles.listCard}>
          {complaints.map((c, idx) => (
            <View key={c.id} style={[styles.listRow, idx < complaints.length - 1 && styles.listRowBorder]}>
              <View style={styles.listRowInfo}>
                <Text style={styles.listRowTitle} numberOfLines={1}>{c.title}</Text>
                <Text style={styles.listRowMeta}>{c.ticketNumber}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: statusColor[c.status] ?? Colors.textSecondary }]}>
                <Text style={styles.badgeText}>{c.status}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>No recent complaints.</Text>
      )}

      {/* ── Recent notices ────────────────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>Recent Notices</Text>
      {notices && notices.length > 0 ? (
        <View style={styles.listCard}>
          {notices.map((n, idx) => (
            <View key={n.id} style={[styles.listRow, idx < notices.length - 1 && styles.listRowBorder]}>
              <View style={styles.listRowInfo}>
                <Text style={styles.listRowTitle} numberOfLines={1}>{n.title}</Text>
                <Text style={styles.listRowMeta}>
                  {new Date(n.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </Text>
              </View>
              <View style={[styles.badge,
                { backgroundColor: n.type === 'Emergency' ? Colors.error : Colors.info }]}>
                <Text style={styles.badgeText}>{n.type}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>No recent notices.</Text>
      )}

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

// ── StatCard sub-component ────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={statStyles.card}>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card:  { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, alignItems: 'center', elevation: 1 },
  value: { fontSize: 28, fontWeight: '700' },
  label: { fontSize: 12, color: Colors.textSecondary, marginTop: 4, fontWeight: '500' },
});

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: Colors.background },
  loadingContainer:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  loadingText:         { color: Colors.textSecondary, fontSize: 14 },
  header:              { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, paddingBottom: Spacing.sm },
  societyName:         { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  periodLabel:         { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  generateBtn:         { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  generateBtnDisabled: { opacity: 0.5 },
  generateBtnText:     { color: '#fff', fontWeight: '700', fontSize: 13 },
  sectionTitle:        { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.xs },
  progressCard:        { marginHorizontal: Spacing.md, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, elevation: 2 },
  progressHeader:      { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  progressAmount:      { fontSize: 26, fontWeight: '700', color: Colors.primary },
  progressTotal:       { fontSize: 13, color: Colors.textSecondary },
  progressBarBg:       { height: 10, backgroundColor: Colors.background, borderRadius: 5, marginTop: Spacing.sm, overflow: 'hidden' },
  progressBarFill:     { height: '100%', backgroundColor: Colors.success, borderRadius: 5 },
  progressPct:         { fontSize: 12, color: Colors.textSecondary, marginTop: 6 },
  statsGrid:           { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md, marginTop: Spacing.sm },
  defaultersList:      { marginHorizontal: Spacing.md, backgroundColor: Colors.surface, borderRadius: 12, overflow: 'hidden', elevation: 1 },
  defaulterRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  defaulterFlat:       { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  defaulterOwner:      { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  defaulterAmount:     { fontSize: 15, fontWeight: '700', color: Colors.error },
  moreLink:            { fontSize: 13, color: Colors.primary, textAlign: 'center', padding: Spacing.sm },
  listCard:            { marginHorizontal: Spacing.md, backgroundColor: Colors.surface, borderRadius: 12, overflow: 'hidden', elevation: 1 },
  listRow:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
  listRowBorder:       { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  listRowInfo:         { flex: 1, gap: 3 },
  listRowTitle:        { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  listRowMeta:         { fontSize: 12, color: Colors.textSecondary },
  badge:               { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: Spacing.sm },
  badgeText:           { fontSize: 10, color: '#fff', fontWeight: '700' },
  emptyText:           { fontSize: 14, color: Colors.textSecondary, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  bottomPad:           { height: 32 },
});
