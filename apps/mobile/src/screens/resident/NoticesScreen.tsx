import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { HubConnectionBuilder, HubConnection, LogLevel } from '@microsoft/signalr';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../services/api/apiClient';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Notice {
  id: string;
  title: string;
  body: string;
  type: 'Notice' | 'Emergency' | 'Event' | 'Circular';
  isPinned: boolean;
  createdAt: string;
  expiresAt?: string;
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// ── API ────────────────────────────────────────────────────────────────────────

const fetchNotices = async (type?: string): Promise<PagedResult<Notice>> => {
  const params = new URLSearchParams({ page: '1', pageSize: '50' });
  if (type) params.set('type', type);
  const { data } = await apiClient.get<PagedResult<Notice>>(
    `/notices?${params}`
  );
  return data;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function NoticesScreen() {
  const { accessToken, activeSocietyId } = useAuthStore();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [expanded, setExpanded] = useState<string | null>(null);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notices', filter],
    queryFn: () => fetchNotices(filter),
    staleTime: 60_000,
  });

  // ── SignalR — real-time notice push ─────────────────────────────────────────
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

    // Admin posted a new notice → refresh list
    connection.on('NewNotice', () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] });
    });

    // Emergency broadcast — refresh immediately
    connection.on('EmergencyAlert', () => {
      queryClient.invalidateQueries({ queryKey: ['notices', 'Emergency'] });
      queryClient.invalidateQueries({ queryKey: ['notices'] });
    });

    connection.start().catch(err =>
      console.warn('[SignalR] Notices connection failed:', err)
    );

    return () => { connection.stop(); };
  }, [accessToken, activeSocietyId, queryClient]);

  // ── Type config ──────────────────────────────────────────────────────────────
  const typeConfig: Record<Notice['type'], { color: string; icon: string }> = {
    Notice:    { color: Colors.info,    icon: '📢' },
    Emergency: { color: Colors.error,   icon: '🚨' },
    Event:     { color: Colors.accent,  icon: '🎉' },
    Circular:  { color: Colors.primary, icon: '📄' },
  };

  // ── Render item ──────────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: Notice }) => {
    const config = typeConfig[item.type] ?? typeConfig.Notice;
    const isOpen = expanded === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          item.type === 'Emergency' && styles.emergencyCard,
          item.isPinned && styles.pinnedCard,
        ]}
        onPress={() => setExpanded(isOpen ? null : item.id)}
        activeOpacity={0.8}>

        <View style={styles.cardTop}>
          <Text style={styles.typeIcon}>{config.icon}</Text>
          <View style={styles.cardContent}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle} numberOfLines={isOpen ? undefined : 2}>
                {item.isPinned ? '📌 ' : ''}{item.title}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <View style={[styles.badge, { backgroundColor: config.color }]}>
                <Text style={styles.badgeText}>{item.type}</Text>
              </View>
              <Text style={styles.time}>
                {new Date(item.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'short',
                })}
              </Text>
            </View>
          </View>
        </View>

        {isOpen && (
          <Text style={styles.body}>{item.body}</Text>
        )}

        {isOpen && item.expiresAt && (
          <Text style={styles.expires}>
            Expires: {new Date(item.expiresAt).toLocaleDateString('en-IN')}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  // ── Filter tabs ───────────────────────────────────────────────────────────────
  const tabs = [
    { label: 'All',       value: undefined },
    { label: '🚨 Alerts', value: 'Emergency' },
    { label: '🎉 Events', value: 'Event' },
    { label: '📄 Circulars', value: 'Circular' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.tabsWrapper} contentContainerStyle={styles.tabs}>
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
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={n => n.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📢</Text>
              <Text style={styles.emptyLabel}>No notices yet</Text>
              <Text style={styles.emptySubLabel}>
                Announcements from your management committee will appear here.
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
  tabsWrapper:   { maxHeight: 52, backgroundColor: Colors.surface },
  tabs:          { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs, flexDirection: 'row' },
  tab:           { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.background },
  tabActive:     { backgroundColor: Colors.primary },
  tabText:       { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  loader:        { flex: 1 },
  list:          { padding: Spacing.md, gap: Spacing.sm },
  card:          { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  emergencyCard: { borderLeftWidth: 4, borderLeftColor: Colors.error, backgroundColor: '#FFF5F5' },
  pinnedCard:    { borderLeftWidth: 4, borderLeftColor: Colors.primary },
  cardTop:       { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  typeIcon:      { fontSize: 24, marginTop: 2 },
  cardContent:   { flex: 1, gap: 6 },
  cardTitleRow:  { flex: 1 },
  cardTitle:     { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, lineHeight: 22 },
  metaRow:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  badge:         { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText:     { fontSize: 10, color: '#fff', fontWeight: '700' },
  time:          { fontSize: 12, color: Colors.textSecondary },
  body:          { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.divider },
  expires:       { fontSize: 11, color: Colors.textDisabled, marginTop: Spacing.xs, fontStyle: 'italic' },
  empty:         { alignItems: 'center', paddingTop: 80, gap: Spacing.sm, paddingHorizontal: Spacing.xl },
  emptyIcon:     { fontSize: 48 },
  emptyLabel:    { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  emptySubLabel: { fontSize: 13, color: Colors.textDisabled, textAlign: 'center' },
});
