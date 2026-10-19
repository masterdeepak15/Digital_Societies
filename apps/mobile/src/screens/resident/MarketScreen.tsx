import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { apiFetch } from '../../utils/api';
import { MediaImage } from '../../ui/MediaImage';
import { timeAgo } from './feedModel';
import { KINDS, closedLabel, conditionLabel, kindIcon, kindLabel, priceText, type MarketKind } from './marketModel';

export interface MarketPost {
  id: string; kind: MarketKind; title: string; description: string; priceRupees: number | null; condition: string | null;
  imageIds: string[]; status: 'Open' | 'Closed'; authorUserId: string; authorFlatDisplay: string; isMine: boolean;
  replyCount: number; createdAt: string; closedWithUserId: string | null;
}

/** The society market: what neighbours sell, want to buy or want to borrow. */
export default function MarketScreen() {
  const navigation = useNavigation<any>();
  const [kind, setKind] = useState<MarketKind | undefined>(undefined);
  const [mine, setMine] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['market', kind, mine],
    queryFn: () => apiFetch<MarketPost[]>(`/marketplace/market?${new URLSearchParams({ ...(kind ? { kind } : {}), ...(mine ? { mine: 'true' } : {}) })}`),
    staleTime: 15_000,
  });

  const tabs: { label: string; value: MarketKind | undefined }[] = [{ label: 'All', value: undefined }, ...KINDS.map((k) => ({ label: `${k.icon} ${k.label}`, value: k.value }))];

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsBar} contentContainerStyle={styles.tabsContent}>
        {tabs.map((t) => (
          <TouchableOpacity key={t.label} style={[styles.tab, kind === t.value && styles.tabOn]} onPress={() => setKind(t.value)}>
            <Text style={[styles.tabText, kind === t.value && styles.tabTextOn]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.tab, mine && styles.tabOn]} onPress={() => setMine(!mine)}>
          <Text style={[styles.tabText, mine && styles.tabTextOn]}>My posts</Text>
        </TouchableOpacity>
      </ScrollView>

      {isLoading ? <ActivityIndicator style={{ flex: 1 }} size="large" color={Colors.primary} /> : (
        <FlatList
          data={data ?? []}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: 90, gap: Spacing.sm }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 44 }}>🛒</Text>
              <Text style={styles.emptyTitle}>{isError ? 'Could not load the market' : 'Nothing here yet'}</Text>
              <Text style={styles.emptySub}>{isError ? 'Pull down to try again.' : 'Post something you sell, want to buy or want to borrow.'}</Text>
            </View>
          }
          renderItem={({ item: p }) => (
            <TouchableOpacity style={[styles.card, p.status === 'Closed' && { opacity: 0.65 }]} activeOpacity={0.85}
              onPress={() => navigation.navigate('MarketPost', { postId: p.id })}>
              {p.imageIds[0] ? <MediaImage id={p.imageIds[0]} size={92} style={{ borderRadius: 10 }} /> : (
                <View style={styles.noPhoto}><Text style={{ fontSize: 30 }}>{kindIcon(p.kind)}</Text></View>
              )}
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.kindBadge}>{kindIcon(p.kind)} {kindLabel(p.kind)}</Text>
                  {p.status === 'Closed' && <Text style={styles.closedBadge}>{closedLabel(p.kind)}</Text>}
                </View>
                <Text style={styles.title} numberOfLines={2}>{p.title}</Text>
                {priceText(p.kind, p.priceRupees) !== '' && <Text style={styles.price}>{priceText(p.kind, p.priceRupees)}{p.kind === 'Sell' && p.condition ? `  ·  ${conditionLabel(p.condition)}` : ''}</Text>}
                <Text style={styles.meta} numberOfLines={1}>{p.authorFlatDisplay}  ·  {timeAgo(p.createdAt)}  ·  💬 {p.replyCount}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateMarketPost')}>
        <Text style={styles.fabText}>＋  Post</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  tabsBar: { maxHeight: 52, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabsContent: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.background },
  tabOn: { backgroundColor: Colors.primary },
  tabText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  tabTextOn: { color: '#fff', fontWeight: '600' },
  card: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.divider },
  noPhoto: { width: 92, height: 92, borderRadius: 10, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  kindBadge: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  closedBadge: { fontSize: 10, fontWeight: '700', color: '#fff', backgroundColor: Colors.textSecondary, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  title: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  price: { fontSize: 14, fontWeight: '700', color: Colors.success },
  meta: { fontSize: 11, color: Colors.textSecondary },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm, paddingHorizontal: Spacing.xl },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  emptySub: { fontSize: 13, color: Colors.textDisabled, textAlign: 'center' },
  fab: { position: 'absolute', bottom: 24, right: 20, backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 25, elevation: 6 },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
