import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import QueryList, { listStyles as s } from './QueryList';
import { toComplaintRow, nextComplaintActions, type ComplaintRow } from './opsModel';
import { apiFetch } from '../../utils/api';
import { errorMessage } from '../../utils/errorMessage';
import { Colors } from '../../theme/colors';

const STATUS_COLOR: Record<string, string> = {
  Open: Colors.warning, Assigned: Colors.info, InProgress: Colors.info, Resolved: Colors.success, Closed: Colors.textSecondary, Reopened: Colors.error,
};

/** Complaints with the next-step button. `path` is the list endpoint; admins also see which flat raised each one. */
export default function ComplaintList({ title, path, queryKey }: { title: string; path: string; queryKey: unknown[] }) {
  const queryClient = useQueryClient();
  const navigation = useNavigation<any>();

  const fetcher = async (): Promise<ComplaintRow[]> => {
    const [res, labels] = await Promise.all([
      apiFetch<{ items?: any[] }>(path),
      apiFetch<Record<string, string>>('/billing/flat-labels').catch(() => ({} as Record<string, string>)),
    ]);
    return (res.items ?? []).map((c) => toComplaintRow(c, labels));
  };

  const move = async (c: ComplaintRow, status: string) => {
    try {
      await apiFetch(`/complaints/${c.id}/status`, { method: 'PUT', body: JSON.stringify({ status, note: null }) });
      queryClient.invalidateQueries({ queryKey });
    } catch (e: any) {
      Alert.alert('Could not update', errorMessage(e));
    }
  };

  return (
    <QueryList<ComplaintRow>
      title={title}
      queryKey={queryKey}
      fetcher={fetcher}
      keyOf={(c) => c.id}
      emptyText="Nothing here right now."
      renderItem={(c) => {
        const color = STATUS_COLOR[c.status] ?? Colors.textSecondary;
        return (
          <TouchableOpacity activeOpacity={0.8} style={s.card} onPress={() => navigation.navigate('ComplaintDetail', { id: c.id })}>
            <View style={s.row}>
              <Text style={s.primary}>{c.title}</Text>
              <Text style={[s.pill, { color, backgroundColor: color + '22' }]}>{c.status}</Text>
            </View>
            <Text style={s.secondary}>{c.ticket} · {c.flat} · {c.category} · {c.priority}</Text>
            {!!c.time && <Text style={s.secondary}>{c.time}</Text>}
            <View style={s.actions}>
              {nextComplaintActions(c.status).map((a) => (
                <TouchableOpacity key={a.status} style={s.btn} onPress={() => move(c, a.status)}>
                  <Text style={s.btnText}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}
