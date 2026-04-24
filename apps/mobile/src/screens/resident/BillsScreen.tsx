import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors }    from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

interface Bill { id: string; period: string; amount: number; status: string; dueDate: string }

const MOCK_BILLS: Bill[] = [
  { id: '1', period: 'May 2026',   amount: 3500, status: 'pending', dueDate: '10 May 2026' },
  { id: '2', period: 'April 2026', amount: 3500, status: 'paid',    dueDate: '10 Apr 2026' },
  { id: '3', period: 'March 2026', amount: 3500, status: 'paid',    dueDate: '10 Mar 2026' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: Colors.warning, paid: Colors.success, overdue: Colors.error, waived: Colors.info,
};

export default function BillsScreen() {
  const renderBill = ({ item }: { item: Bill }) => (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View>
          <Text style={styles.period}>{item.period}</Text>
          <Text style={styles.due}>Due: {item.dueDate}</Text>
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
      {item.status === 'pending' && (
        <TouchableOpacity style={styles.payBtn}>
          <Text style={styles.payBtnText}>Pay ₹{item.amount.toLocaleString('en-IN')} →</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Bills</Text>
      <FlatList
        data={MOCK_BILLS}
        renderItem={renderBill}
        keyExtractor={(b: Bill) => b.id}
        contentContainerStyle={styles.list}
      />
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
  payBtnText:  { ...Typography.body2, fontWeight: '700', color: Colors.textOnPrimary },
});
