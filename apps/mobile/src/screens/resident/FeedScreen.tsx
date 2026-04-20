import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, ScrollView, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../services/api/apiClient';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';

// ── Types ─────────────────────────────────────────────────────────────────────

type PostCategory =
  | 'general' | 'lost_found' | 'help_wanted' | 'for_sale'
  | 'recommendation' | 'warning' | 'event' | 'poll' | 'emergency';

interface FeedPost {
  id: string;
  category: PostCategory;
  body: string;
  imageUrls: string[];
  isPinned: boolean;
  isLocked: boolean;
  authorUserId: string;
  authorFlatDisplay: string;
  groupId?: string;
  reactionCount: number;
  commentCount: number;
  createdAt: string;
  expiresAt?: string;
  // marketplace
  pricePaise?: number;
  condition?: string;
  isSold?: boolean;
}

interface PagedResult<T> { items: T[]; totalCount: number; page: number; pageSize: number; }

// ── Category config ───────────────────────────────────────────────────────────

const categoryConfig: Record<PostCategory, { icon: string; color: string; label: string }> = {
  general:       { icon: '💬', color: Colors.info,        label: 'General' },
  lost_found:    { icon: '🔍', color: '#8E44AD',           label: 'Lost & Found' },
  help_wanted:   { icon: '🙋', color: Colors.accent,       label: 'Help Wanted' },
  for_sale:      { icon: '🛒', color: Colors.success,      label: 'For Sale' },
  recommendation:{ icon: '⭐', color: '#F39C12',           label: 'Recommended' },
  warning:       { icon: '⚠️', color: Colors.warning,      label: 'Warning' },
  event:         { icon: '🎉', color: '#16A085',           label: 'Event' },
  poll:          { icon: '📊', color: Colors.primary,      label: 'Poll' },
  emergency:     { icon: '🚨', color: Colors.error,        label: 'Emergency' },
};

const formatPaise = (p: number) =>
  p === 0 ? 'Free' : `₹${(p / 100).toLocaleString('en-IN')}`;

// ── API ────────────────────────────────────────────────────────────────────────

const fetchFeed = async (category?: string): Promise<PagedResult<FeedPost>> => {
  const params = new URLSearchParams({ page: '1', pageSize: '30' });
  if (category) params.set('category', category);
  const { data } = await apiClient.get<PagedResult<FeedPost>>(`/api/v1/social/posts?${params}`);
  return data;
};

const reactToPost = async ({ postId, type }: { postId: string; type: string }) => {
  await apiClient.post(`/api/v1/social/posts/${postId}/react`, { type });
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const navigation = useNavigation<any>();
  const { accessToken, activeSocietyId } = useAuthStore();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<string | undefined>(undefined);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['feed', category],
    queryFn: () => fetchFeed(category),
    staleTime: 30_000,
  });

  // ── React mutation ──────────────────────────────────────────────────────────
  const reactMutation = useMutation({
    mutationFn: reactToPost,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });

  // ── SignalR ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!accessToken || !activeSocietyId) return;
    const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

    const conn = new HubConnectionBuilder()
      .withUrl(`${apiUrl}/hubs/society?access_token=${accessToken}`, {
        headers: { 'X-Society-Id': activeSocietyId },
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    conn.on('NewFeedPost', () => queryClient.invalidateQueries({ queryKey: ['feed'] }));
    conn.on('EmergencyPost', () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['feed', 'emergency'] });
    });

    conn.start().catch(err => console.warn('[SignalR Feed]', err));
    return () => { conn.stop(); };
  }, [accessToken, activeSocietyId, queryClient]);

  // ── Render post card ─────────────────────────────────────────────────────────
  const renderPost = useCallback(({ item }: { item: FeedPost }) => {
    const cfg = categoryConfig[item.category] ?? categoryConfig.general;
    const isEmergency = item.category === 'emergency';

    return (
      <TouchableOpacity
        style={[
          styles.card,
          isEmergency && styles.emergencyCard,
          item.isPinned && styles.pinnedCard,
        ]}
        onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
        activeOpacity={0.85}>

        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.categoryDot, { backgroundColor: cfg.color }]} />
          <Text style={styles.categoryLabel}>{cfg.icon} {cfg.label}</Text>
          {item.isPinned && <Text style={styles.pinBadge}>📌 Pinned</Text>}
          <Text style={styles.flatLabel}>{item.authorFlatDisplay}</Text>
        </View>

        {/* Body */}
        <Text style={[styles.body, isEmergency && styles.emergencyBody]} numberOfLines={4}>
          {item.body}
        </Text>

        {/* Images strip */}
        {item.imageUrls.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={styles.imageStrip}>
            {item.imageUrls.map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.thumb} />
            ))}
          </ScrollView>
        )}

        {/* Marketplace badge */}
        {item.category === 'for_sale' && item.pricePaise !== undefined && (
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>{formatPaise(item.pricePaise)}</Text>
            {item.isSold && <Text style={styles.soldText}> · SOLD</Text>}
          </View>
        )}

        {/* Footer */}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.footerAction}
            onPress={() => reactMutation.mutate({ postId: item.id, type: 'thumbsup' })}>
            <Text style={styles.footerActionText}>👍 {item.reactionCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.footerAction}
            onPress={() => navigation.navigate('PostDetail', { postId: item.id })}>
            <Text style={styles.footerActionText}>💬 {item.commentCount}</Text>
          </TouchableOpacity>
          <Text style={styles.timestamp}>
            {new Date(item.createdAt).toLocaleDateString('en-IN', {
              day: '2-digit', month: 'short',
            })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [navigation, reactMutation]);

  // ── Category filter tabs ──────────────────────────────────────────────────────
  const tabs: Array<{ label: string; value: string | undefined }> = [
    { label: 'All',         value: undefined },
    { label: '🚨 Alerts',   value: 'emergency' },
    { label: '🛒 For Sale', value: 'for_sale' },
    { label: '🙋 Help',     value: 'help_wanted' },
    { label: '🎉 Events',   value: 'event' },
    { label: '📊 Polls',    value: 'poll' },
  ];

  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.tabsBar} contentContainerStyle={styles.tabsContent}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.label}
            style={[styles.tab, category === t.value && styles.tabActive]}
            onPress={() => setCategory(t.value)}>
            <Text style={[styles.tabText, category === t.value && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Feed */}
      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={p => p.id}
          renderItem={renderPost}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🏘️</Text>
              <Text style={styles.emptyLabel}>Nothing posted yet</Text>
              <Text style={styles.emptySub}>Be the first to share something with your society!</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreatePost')}>
        <Text style={styles.fabText}>✏️  Post</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: Colors.background },
  tabsBar:       { maxHeight: 52, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabsContent:   { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs },
  tab:           { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.background },
  tabActive:     { backgroundColor: Colors.primary },
  tabText:       { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  loader:        { flex: 1 },
  list:          { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 80 },
  card:          { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  emergencyCard: { borderLeftWidth: 4, borderLeftColor: Colors.error, backgroundColor: '#FFF5F5' },
  pinnedCard:    { borderLeftWidth: 4, borderLeftColor: Colors.primary },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  categoryDot:   { width: 8, height: 8, borderRadius: 4 },
  categoryLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, flex: 1 },
  pinBadge:      { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  flatLabel:     { fontSize: 12, color: Colors.textSecondary },
  body:          { fontSize: 15, color: Colors.textPrimary, lineHeight: 22 },
  emergencyBody: { fontWeight: '600', color: Colors.error },
  imageStrip:    { marginTop: Spacing.sm, flexGrow: 0 },
  thumb:         { width: 80, height: 80, borderRadius: 8, marginRight: 8, backgroundColor: Colors.background },
  priceBadge:    { flexDirection: 'row', marginTop: Spacing.sm, alignItems: 'center' },
  priceText:     { fontSize: 15, fontWeight: '700', color: Colors.success },
  soldText:      { fontSize: 13, color: Colors.textSecondary },
  cardFooter:    { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.divider },
  footerAction:  { marginRight: Spacing.md },
  footerActionText: { fontSize: 13, color: Colors.textSecondary },
  timestamp:     { marginLeft: 'auto', fontSize: 11, color: Colors.textDisabled },
  empty:         { alignItems: 'center', paddingTop: 80, gap: Spacing.sm, paddingHorizontal: Spacing.xl },
  emptyIcon:     { fontSize: 48 },
  emptyLabel:    { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  emptySub:      { fontSize: 13, color: Colors.textDisabled, textAlign: 'center' },
  fab:           { position: 'absolute', bottom: 24, right: 20, backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 25, elevation: 6, flexDirection: 'row', alignItems: 'center' },
  fabText:       { color: '#fff', fontWeight: '700', fontSize: 14 },
});
