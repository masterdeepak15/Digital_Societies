import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { HubConnectionBuilder, HubConnection, LogLevel } from '@microsoft/signalr';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../services/api/apiClient';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';

// ── Types ─────────────────────────────────────────────────────────────────────

type VisitorStatus = 'Pending' | 'Approved' | 'Rejected' | 'Entered' | 'Exited';

interface Visitor {
  id: string;
  visitorName: string;
  visitorPhone: string;
  purpose: string;
  status: VisitorStatus;
  vehicleNumber?: string;
  createdAt: string;
  entryTime?: string;
  exitTime?: string;
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// ── API ────────────────────────────────────────────────────────────────────────

const fetchMyVisitors = async (status?: string): Promise<PagedResult<Visitor>> => {
  const params = new URLSearchParams({ page: '1', pageSize: '50' });
  if (status) params.set('status', status);
  const { data } = await apiClient.get<PagedResult<Visitor>>(
    `/visitors?${params}`
  );
  return data;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function VisitorsScreen() {
  const { accessToken, activeSocietyId } = useAuthStore();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string | undefined>('Pending');

  // ── Fetch visitors ──────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['visitors', filter],
    queryFn: () => fetchMyVisitors(filter),
    staleTime: 30_000,
  });

  // ── Approve mutation ────────────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: async (visitorId: string) => {
      const { data } = await apiClient.post(`/visitors/${visitorId}/approve`);
      return data as { qrToken: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      Alert.alert('Visitor Approved ✓', 'The guard has been notified and can let them in.');
    },
    onError: () => Alert.alert('Error', 'Could not approve visitor. Please try again.'),
  });

  // ── Reject mutation ─────────────────────────────────────────────────────────
  const rejectMutation = useMutation({
    mutationFn: async (visitorId: string) => {
      await apiClient.post(`/visitors/${visitorId}/reject`, { reason: 'Rejected by resident' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['visitors'] }),
    onError: () => Alert.alert('Error', 'Could not reject visitor. Please try again.'),
  });

  // ── SignalR — real-time visitor arrival push ────────────────────────────────
  useEffect(() => {
    if (!accessToken || !activeSocietyId) return;

    const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

    const connection = new HubConnectionBuilder()
      .withUrl(`${apiUrl}/hubs/society?access_token=${accessToken}`, {
        headers: { 'X-Society-Id': activeSocietyId },
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(LogLevel.Warning)
      .build();

    // Guard added a visitor for this flat → refresh pending list
    connection.on('VisitorPendingApproval', () => {
      queryClient.invalidateQueries({ queryKey: ['visitors', 'Pending'] });
    });

    connection.start().catch(err =>
      console.warn('[SignalR] Could not connect:', err)
    );

    return () => { connection.stop(); };
  }, [accessToken, activeSocietyId, queryClient]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const onApprove = useCallback((v: Visitor) => {
    Alert.alert(
      'Approve Visitor?',
      `${v.visitorName} — ${v.purpose}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve', onPress: () => approveMutation.mutate(v.id) },
      ]
    );
  }, [approveMutation]);

  const onReject = useCallback((v: Visitor) => {
    Alert.alert(
      'Reject Visitor?',
      `Deny entry to ${v.visitorName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: () => rejectMutation.mutate(v.id) },
      ]
    );
  }, [rejectMutation]);

  // ── Status badge ─────────────────────────────────────────────────────────────
  const statusColor: Record<VisitorStatus, string> = {
    Pending:  Colors.warning,
    Approved: Colors.success,
    Rejected: Colors.error,
    Entered:  Colors.info,
    Exited:   Colors.textSecondary,
  };

  // ── Render item ──────────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: Visitor }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardInfo}>
          <Text style={styles.name}>{item.visitorName}</Text>
          <Text style={styles.meta}>{item.visitorPhone} · {item.purpose}</Text>
          {item.vehicleNumber ? (
            <Text style={styles.meta}>🚗 {item.vehicleNumber}</Text>
          ) : null}
          <Text style={styles.time}>
            {new Date(item.createdAt).toLocaleTimeString('en-IN', {
              hour: '2-digit', minute: '2-digit', hour12: true,
            })}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: statusColor[item.status] }]}>
          <Text style={styles.badgeText}>{item.status}</Text>
        </View>
      </View>

      {item.status === 'Pending' && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.btn, styles.approveBtn]}
            onPress={() => onApprove(item)}
            disabled={approveMutation.isPending}>
            <Text style={styles.btnText}>✓  Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.rejectBtn]}
            onPress={() => onReject(item)}
            disabled={rejectMutation.isPending}>
            <Text style={styles.btnText}>✕  Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // ── Filter tabs ───────────────────────────────────────────────────────────────
  const tabs: Array<{ label: string; value: string | undefined }> = [
    { label: 'Pending',  value: 'Pending' },
    { label: 'All',      value: undefined },
    { label: 'Approved', value: 'Approved' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.label}
            style={[styles.tab, filter === t.value && styles.tabActive]}
            onPress={() => setFilter(t.value)}>
            <Text style={[styles.tabText, filter === t.value && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={v => v.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🚪</Text>
              <Text style={styles.emptyLabel}>
                {filter === 'Pending' ? 'No pending visitors' : 'No visitors yet'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: Colors.background },
  tabs:          { flexDirection: 'row', backgroundColor: Colors.surface, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs },
  tab:           { flex: 1, paddingVertical: 7, borderRadius: 20, alignItems: 'center', backgroundColor: Colors.background },
  tabActive:     { backgroundColor: Colors.primary },
  tabText:       { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  loader:        { flex: 1 },
  list:          { padding: Spacing.md, gap: Spacing.sm },
  card:          { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardInfo:      { flex: 1, gap: 3 },
  name:          { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  meta:          { fontSize: 13, color: Colors.textSecondary },
  time:          { fontSize: 11, color: Colors.textDisabled, marginTop: 2 },
  badge:         { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, marginLeft: Spacing.sm },
  badgeText:     { fontSize: 11, color: '#fff', fontWeight: '700' },
  actionRow:     { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  btn:           { flex: 1, paddingVertical: 11, borderRadius: 8, alignItems: 'center' },
  approveBtn:    { backgroundColor: Colors.success },
  rejectBtn:     { backgroundColor: Colors.error },
  btnText:       { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty:         { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyIcon:     { fontSize: 48 },
  emptyLabel:    { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
});
