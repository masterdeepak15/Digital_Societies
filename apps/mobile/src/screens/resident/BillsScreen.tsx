import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Colors }    from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';
import { apiFetch } from '../../utils/api';
import { toBillRow, sortBills, type ApiBill, type BillRow } from './billsModel';
import { errorMessage } from '../../utils/errorMessage';

const STATUS_COLORS: Record<string, string> = {
  pending: Colors.warning, paid: Colors.success, overdue: Colors.error, waived: Colors.info,
};

async function startPayment(bill: BillRow) {
  try {
    await apiFetch(`/billing/${bill.id}/pay`, { method: 'POST', body: JSON.stringify({ gateway: 'razorpay' }) });
    Alert.alert('Payment started', 'Follow the payment prompt to finish paying this bill.');
  } catch (e: any) {
    Alert.alert('Payment unavailable', errorMessage(e, 'Online payment is not set up for your society. Please pay at the committee office.'));
  }
}

export default function BillsScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['bills'],
    queryFn: async () => {
      const res = await apiFetch<{ items?: ApiBill[] } | ApiBill[]>('/billing/my?page=1&pageSize=50');
      const list = Array.isArray(res) ? res : res.items ?? [];
      return sortBills(list.map(toBillRow));
    },
  });

  const renderBill = ({ item }: { item: BillRow }) => (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View>
          <Text style={styles.period}>{item.period}</Text>
          <Text style={styles.due}>Due: {item.due}</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.amount}>₹{item.amount.toLocaleString('en-IN')}</Text>
          <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] + '22' }]}>
            <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status] }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
      {(item.status === 'pending' || item.status === 'overdue') && (
        <TouchableOpacity style={styles.payBtn} onPress={() => startPayment(item)}>
          <Text style={styles.payBtnText}>Pay ₹{item.amount.toLocaleString('en-IN')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Bills</Text>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: Spacing.xl }} color={Colors.primary} />
      ) : isError ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Could not load your bills</Text>
          <TouchableOpacity onPress={() => refetch()}><Text style={styles.retry}>Try again</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          renderItem={renderBill}
          keyExtractor={(b: BillRow) => b.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No bills yet</Text></View>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.background },
  header:      { ...Typography.h2, color: Colors.primary, padding: Spacing.md, paddingTop: Spacing.xl },
  list:        { padding: Spacing.md, gap: Spacing.sm },
  card:        { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md,
                 borderWidth: 1, borderColor: Colors.border },
  cardRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  period:      { ...Typography.h4, color: Colors.textPrimary },
  due:         { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  right:       { alignItems: 'flex-end' },
  amount:      { ...Typography.h3, color: Colors.textPrimary },
  badge:       { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm, marginTop: 4 },
  badgeText:   { ...Typography.caption, fontWeight: '700' },
  payBtn:      { backgroundColor: Colors.secondary, borderRadius: Radius.md, padding: Spacing.sm,
                 alignItems: 'center', marginTop: Spacing.sm },
  empty:       { alignItems: 'center', padding: Spacing.xl },
  emptyTitle:  { ...Typography.h4, color: Colors.textSecondary },
  retry:       { ...Typography.body2, color: Colors.primary, marginTop: Spacing.sm, fontWeight: '700' },
  payBtnText:  { ...Typography.body2, fontWeight: '700', color: Colors.textOnPrimary },
});
