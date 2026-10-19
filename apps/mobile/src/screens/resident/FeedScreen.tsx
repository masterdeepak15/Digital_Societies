import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../services/api/apiClient';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { useHubUrl } from '../../config/useHubUrl';
import { PostImages } from '../../ui/PostImages';
import { showPostMenu } from './postActions';
import { initialsOf, timeAgo } from './feedModel';

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
  isHidden?: boolean;
  likedByMe?: boolean;
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
  const { data } = await apiClient.get<PagedResult<FeedPost>>(`/social/posts?${params}`);
  return data;
};

// A like is the "thumbsup" reaction; tapping again takes it back.
const toggleLike = async ({ postId, liked }: { postId: string; liked: boolean }) => {
  if (liked) await apiClient.delete(`/social/posts/${postId}/react`);
  else await apiClient.post(`/social/posts/${postId}/react`, { type: 'thumbsup' });
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const navigation = useNavigation<any>();
  const { accessToken, activeSocietyId, userId, activeRole } = useAuthStore();
  const isAdmin = activeRole === 'admin';
  const hubUrl = useHubUrl();
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
    mutationFn: toggleLike,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });

  // ── SignalR ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!accessToken || !activeSocietyId || !hubUrl) return;

    const conn = new HubConnectionBuilder()
      .withUrl(`${hubUrl}?access_token=${accessToken}`, {
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
  }, [accessToken, activeSocietyId, hubUrl, queryClient]);

  // ── Render post card ─────────────────────────────────────────────────────────
  const renderPost = useCallback(({ item }: { item: FeedPost }) => {
    const cfg = categoryConfig[item.category] ?? categoryConfig.general;
    const isEmergency = item.category === 'emergency';

    const open = () => navigation.navigate('PostDetail', { postId: item.id });
    const like = () => { if (!item.likedByMe) reactMutation.mutate({ postId: item.id, liked: false }); };
    const mine = item.authorUserId === userId;

    return (
      <View style={[styles.card, isEmergency && styles.emergencyCard, item.isPinned && styles.pinnedCard]}>
        {/* Who and what */}
        <View style={styles.cardHeader}>
          <View style={[styles.avatar, { backgroundColor: cfg.color }]}>
            <Text style={styles.avatarText}>{initialsOf(item.authorFlatDisplay)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.author} numberOfLines={1}>{item.authorFlatDisplay || 'Resident'}</Text>
            <Text style={styles.subline} numberOfLines={1}>
              {cfg.icon} {cfg.label}{item.isPinned ? '  ·  📌 Pinned' : ''}{item.isHidden ? '  ·  🙈 Hidden' : ''}{item.isLocked ? '  ·  🔒' : ''}
            </Text>
          </View>
          {(isAdmin || mine) && (
            <TouchableOpacity accessibilityLabel="Post options" hitSlop={10}
              onPress={() => showPostMenu(item, { isAdmin, isAuthor: mine }, () => queryClient.invalidateQueries())}>
              <Text style={styles.more}>⋯</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Pictures, edge to edge */}
        <PostImages ids={item.imageUrls ?? []} onDoubleTap={like} />

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity accessibilityLabel={item.likedByMe ? 'Unlike' : 'Like'} hitSlop={8}
            onPress={() => reactMutation.mutate({ postId: item.id, liked: !!item.likedByMe })}>
            <Text style={[styles.actionIcon, item.likedByMe && { color: Colors.error }]}>{item.likedByMe ? '♥' : '♡'}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityLabel="Comments" hitSlop={8} onPress={open}>
            <Text style={styles.actionIcon}>💬</Text>
          </TouchableOpacity>
          {item.category === 'for_sale' && item.pricePaise !== undefined && (
            <Text style={styles.priceText}>{formatPaise(item.pricePaise)}{item.isSold ? ' · SOLD' : ''}</Text>
          )}
        </View>

        {/* Caption */}
        <TouchableOpacity activeOpacity={0.9} onPress={open} style={styles.captionBox}>
          {item.reactionCount > 0 && (
            <Text style={styles.likes}>{item.reactionCount} {item.reactionCount === 1 ? 'like' : 'likes'}</Text>
          )}
          <Text style={[styles.body, isEmergency && styles.emergencyBody]} numberOfLines={3}>
            <Text style={styles.captionAuthor}>{item.authorFlatDisplay || 'Resident'}  </Text>{item.body}
          </Text>
          {item.commentCount > 0 && (
            <Text style={styles.viewComments}>View {item.commentCount === 1 ? '1 comment' : `all ${item.commentCount} comments`}</Text>
          )}
          <Text style={styles.timestamp}>{timeAgo(item.createdAt)}</Text>
        </TouchableOpacity>
      </View>
    );
  }, [navigation, reactMutation, isAdmin, userId, queryClient]);

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
          keyExtractor={(p: FeedPost) => p.id}
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
  list:          { paddingBottom: 90 },
  card:          { backgroundColor: Colors.surface, marginBottom: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.divider },
  emergencyCard: { borderLeftWidth: 4, borderLeftColor: Colors.error },
  pinnedCard:    { borderLeftWidth: 4, borderLeftColor: Colors.primary },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.md, paddingVertical: 10 },
  avatar:        { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText:    { color: '#fff', fontWeight: '700', fontSize: 13 },
  author:        { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  subline:       { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  more:          { fontSize: 22, color: Colors.textPrimary, paddingHorizontal: 6 },
  actions:       { flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: Spacing.md, paddingTop: 10 },
  actionIcon:    { fontSize: 26, color: Colors.textPrimary },
  priceText:     { marginLeft: 'auto', fontSize: 15, fontWeight: '700', color: Colors.success },
  captionBox:    { paddingHorizontal: Spacing.md, paddingTop: 6, paddingBottom: 12, gap: 3 },
  likes:         { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  body:          { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  captionAuthor: { fontWeight: '700' },
  emergencyBody: { fontWeight: '600', color: Colors.error },
  viewComments:  { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  timestamp:     { fontSize: 11, color: Colors.textDisabled, marginTop: 2 },
  empty:         { alignItems: 'center', paddingTop: 80, gap: Spacing.sm, paddingHorizontal: Spacing.xl },
  emptyIcon:     { fontSize: 48 },
  emptyLabel:    { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  emptySub:      { fontSize: 13, color: Colors.textDisabled, textAlign: 'center' },
  fab:           { position: 'absolute', bottom: 24, right: 20, backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 25, elevation: 6, flexDirection: 'row', alignItems: 'center' },
  fabText:       { color: '#fff', fontWeight: '700', fontSize: 14 },
});
