import React from 'react';
import { View, Text } from 'react-native';
import QueryList, { listStyles as s } from '../shared/QueryList';
import { apiFetch } from '../../utils/api';
import { Colors } from '../../theme/colors';

interface BillRow { id: string; flat: string; period: string; due: string; amount: number; status: string }

const STATUS_COLOR: Record<string, string> = { Pending: Colors.warning, Paid: Colors.success, Overdue: Colors.error, Waived: Colors.info };

/** Every bill in the society, newest first. Generating a month's bills is on the Dashboard. */
export default function BillingScreen() {
  return (
    <QueryList<BillRow>
      title="Billing"
      queryKey={['admin', 'bills']}
      fetcher={async () => {
        const res = await apiFetch<{ items?: any[] }>('/billing/bills?page=1&limit=50');
        return (res.items ?? []).map((b) => ({
          id: b.id, flat: b.flatLabel ?? '—', period: b.period, due: b.dueDate, amount: b.amountRupees, status: b.status,
        }));
      }}
      keyOf={(b) => b.id}
      emptyText="No bills yet."
      renderItem={(b) => {
        const color = STATUS_COLOR[b.status] ?? Colors.textSecondary;
        return (
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.primary}>{b.flat} · {b.period}</Text>
              <Text style={[s.pill, { color, backgroundColor: color + '22' }]}>{b.status}</Text>
            </View>
            <Text style={s.secondary}>₹{b.amount.toLocaleString('en-IN')} · due {b.due}</Text>
          </View>
        );
      }}
    />
  );
}
