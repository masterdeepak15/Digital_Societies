import React from 'react';
import { View, Text } from 'react-native';
import QueryList, { listStyles as s } from '../shared/QueryList';
import { toVisitorRow, type VisitorRow } from '../shared/opsModel';
import { apiFetch } from '../../utils/api';
import { Colors } from '../../theme/colors';

const STATUS_COLOR: Record<string, string> = {
  Pending: Colors.warning, Approved: Colors.info, Entered: Colors.success, Exited: Colors.textSecondary, Rejected: Colors.error,
};

export const fetchVisitorRows = async (): Promise<VisitorRow[]> => {
  const res = await apiFetch<{ items?: any[] }>('/visitors?page=1&pageSize=50');
  return (res.items ?? []).map(toVisitorRow);
};

export function VisitorCard({ v }: { v: VisitorRow }) {
  const color = STATUS_COLOR[v.status] ?? Colors.textSecondary;
  return (
    <View style={s.card}>
      <View style={s.row}>
        <Text style={s.primary}>{v.name}</Text>
        <Text style={[s.pill, { color, backgroundColor: color + '22' }]}>{v.status}</Text>
      </View>
      <Text style={s.secondary}>To {v.flat} · {v.purpose}</Text>
      {!!v.time && <Text style={s.secondary}>{v.time}</Text>}
    </View>
  );
}

/** Everyone who came to the gate lately, newest first. Pull down to refresh. */
export default function LogScreen() {
  return (
    <QueryList<VisitorRow>
      title="Gate log"
      queryKey={['guard', 'log']}
      fetcher={fetchVisitorRows}
      keyOf={(v) => v.id}
      renderItem={(v) => <VisitorCard v={v} />}
      emptyText="No visitors yet."
    />
  );
}
