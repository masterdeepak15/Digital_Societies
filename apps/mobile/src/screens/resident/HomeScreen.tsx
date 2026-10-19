import React from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ViewSwitcher } from '../../ui/ViewSwitcher';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../services/api/apiClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { courtyardTints } from '../../theme/themes';
import { Button, Card, Icon, ScreenHeader, type IconName } from '../../ui';
import { greetingFor, summariseBills, visitorLabel, type BillLike, type VisitorLike } from './homeModel';

interface Paged<T> { items?: T[] }
type PendingVisitor = VisitorLike & { id: string };

const TILES: { key: 'mint' | 'sky' | 'peach' | 'lilac'; icon: IconName; title: string; hint: string; route: string }[] = [
  { key: 'mint',  icon: 'log-in',   title: 'Visitors',   hint: 'Approve or review',      route: 'Visitors' },
  { key: 'peach', icon: 'tool',     title: 'Complaints', hint: 'Raise or track',         route: 'Complaints' },
  { key: 'lilac', icon: 'calendar', title: 'Book',       hint: 'Clubhouse, pool, court', route: 'Facilities' },
  { key: 'sky',   icon: 'bell',     title: 'Notices',    hint: 'From the committee',     route: 'Notices' },
  { key: 'mint',  icon: 'truck',    title: 'Parking',    hint: 'Your slot and vehicles', route: 'Parking' },
  { key: 'peach', icon: 'users',    title: 'Services',   hint: 'Plumber, cleaner, more', route: 'Marketplace' },
  { key: 'lilac', icon: 'credit-card', title: 'Wallet',  hint: 'Balance and top-ups',    route: 'Wallet' },
  { key: 'sky',   icon: 'shopping-bag', title: 'Market', hint: 'Sell, buy or borrow',    route: 'Market' },
];

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const { colors, fonts, radius, scheme } = useTheme();
  const tints = courtyardTints[scheme];
  const queryClient = useQueryClient();
  const { name, memberships, activeSocietyId } = useAuthStore();
  const membership = memberships.find((m) => m.societyId === activeSocietyId) ?? memberships[0];
  const firstName = (name ?? '').split(' ')[0] || 'there';
  const where = [membership?.flatDisplay, membership?.societyName].filter(Boolean).join(' · ');

  const bills = useQuery({
    queryKey: ['home', 'bills'],
    queryFn: async () => (await apiClient.get<Paged<BillLike>>('/billing/my?page=1&pageSize=20')).data.items ?? [],
    staleTime: 60_000,
  });
  const visitor = useQuery({
    queryKey: ['home', 'pending-visitor'],
    queryFn: async () => (await apiClient.get<Paged<PendingVisitor>>('/visitors?status=Pending&page=1&pageSize=1')).data.items?.[0] ?? null,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const answer = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      if (approve) await apiClient.post(`/visitors/${id}/approve`);
      else await apiClient.post(`/visitors/${id}/reject`, { reason: 'Rejected by resident' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['home', 'pending-visitor'] }),
    onError: () => Alert.alert('Could not send your answer', 'Please try again.'),
  });

  const due = bills.data ? summariseBills(bills.data, new Date()).due : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.ground }} contentContainerStyle={{ padding: 22, paddingTop: 56, paddingBottom: 32, gap: 18 }} showsVerticalScrollIndicator={false}>
      <ScreenHeader
        subtitle={where || greetingFor(new Date())}
        title={`${greetingFor(new Date())}, ${firstName}`}
        right={
          <Pressable accessibilityRole="button" accessibilityLabel="Notices" onPress={() => nav.navigate('Notices')}
            style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bell" size={22} />
          </Pressable>
        }
      />

      <ViewSwitcher />

      {/* Maintenance */}
      <View style={{ backgroundColor: colors.primary, borderRadius: radius.card + 4, padding: 22 }}>
        {bills.isLoading ? (
          <Text style={{ color: colors.onPrimary, fontFamily: fonts.semibold, fontSize: 15 }}>Loading your bills…</Text>
        ) : bills.isError ? (
          <Text style={{ color: colors.onPrimary, fontFamily: fonts.semibold, fontSize: 15 }}>Could not load your bills. Pull down to retry.</Text>
        ) : due ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.onPrimary, opacity: 0.85, fontFamily: fonts.semibold, fontSize: 14 }}>
                Maintenance due{due.dueDate ? ` · ${due.dueDate}` : ''}
              </Text>
              <Text style={{ color: colors.onPrimary, fontFamily: fonts.extrabold, fontSize: 36, marginTop: 4 }}>
                ₹{due.amount.toLocaleString('en-IN')}
              </Text>
              {due.overdueDays > 0 ? (
                <Text style={{ color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 14 }}>
                  Overdue by {due.overdueDays} {due.overdueDays === 1 ? 'day' : 'days'}
                </Text>
              ) : null}
            </View>
            <Pressable accessibilityRole="button" onPress={() => nav.navigate('Bills')}
              style={{ minHeight: 50, paddingHorizontal: 24, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.onAccent, fontFamily: fonts.extrabold, fontSize: 16 }}>Pay now</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <Text style={{ color: colors.onPrimary, fontFamily: fonts.extrabold, fontSize: 22 }}>You are all paid up</Text>
            <Text style={{ color: colors.onPrimary, opacity: 0.85, fontFamily: fonts.regular, fontSize: 14, marginTop: 4 }}>No maintenance is due right now.</Text>
          </View>
        )}
      </View>

      {/* Tiles */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {TILES.map((t) => {
          const tint = tints[t.key];
          return (
            <Pressable key={t.route} accessibilityRole="button" accessibilityLabel={`${t.title}. ${t.hint}`} onPress={() => nav.navigate(t.route)}
              style={{ width: '48%', flexGrow: 1, minHeight: 116, borderRadius: radius.card, backgroundColor: tint.bg, padding: 16, justifyContent: 'space-between' }}>
              <Icon name={t.icon} size={28} color={tint.fg} />
              <View>
                <Text style={{ color: tint.fg, fontFamily: fonts.extrabold, fontSize: 17 }}>{t.title}</Text>
                <Text style={{ color: tint.fg, fontFamily: fonts.medium, fontSize: 13 }}>{t.hint}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Needs your answer */}
      {visitor.data ? (
        <Card>
          <Text style={{ color: colors.muted, fontFamily: fonts.semibold, fontSize: 13 }}>Needs your answer</Text>
          <Text style={{ color: colors.text, fontFamily: fonts.extrabold, fontSize: 17, marginTop: 2 }}>{visitorLabel(visitor.data)}</Text>
          <Text style={{ color: colors.muted, fontFamily: fonts.regular, fontSize: 13, marginTop: 2 }}>Waiting at the gate</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <View style={{ flex: 1 }}>
              <Button title="Not expecting" variant="secondary" disabled={answer.isPending} onPress={() => answer.mutate({ id: visitor.data!.id, approve: false })} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Let in" loading={answer.isPending} onPress={() => answer.mutate({ id: visitor.data!.id, approve: true })} />
            </View>
          </View>
        </Card>
      ) : null}

      <Button title="SOS" variant="danger" icon="alert-triangle" onPress={() => nav.navigate('Sos')} />
    </ScrollView>
  );
}
