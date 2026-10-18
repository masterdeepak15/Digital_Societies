import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listStyles as s } from './QueryList';
import { nextComplaintActions, shortDateTime } from './opsModel';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';
import { apiFetch } from '../../utils/api';
import { errorMessage } from '../../utils/errorMessage';
import { MediaImage } from '../../ui/MediaImage';
import { pickPhoto } from '../../services/media/pickPhoto';
import { uploadImage } from '../../services/media/mediaService';

interface UpdateDto { comment: string; status: string; updatedBy: string; updatedAt: string; mediaIds?: string[] }
interface Detail {
  id: string; ticketNumber: string; title: string; description: string; category: string; priority: string; status: string;
  flatId: string; imageUrls: string[]; updates: UpdateDto[]; createdAt: string;
}

/** One complaint: what was reported (with pictures), the timeline, and a form to add a note, pictures and the next status. */
export default function ComplaintDetailScreen() {
  const { params } = useRoute<any>();
  const id: string = params?.id;
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);      // local files, uploaded when the update is sent
  const [nextStatus, setNextStatus] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['complaint', id],
    queryFn: async () => {
      const [d, labels] = await Promise.all([
        apiFetch<Detail>(`/complaints/${id}`),
        apiFetch<Record<string, string>>('/billing/flat-labels').catch(() => ({} as Record<string, string>)),
      ]);
      return { d, flat: labels[d.flatId] ?? '—' };
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      const mediaIds: string[] = [];
      for (const uri of photos) mediaIds.push((await uploadImage(uri)).id);
      await apiFetch(`/complaints/${id}/updates`, {
        method: 'POST',
        body: JSON.stringify({ comment: note.trim(), status: nextStatus, mediaIds }),
      });
    },
    onSuccess: () => {
      setNote(''); setPhotos([]); setNextStatus(null);
      queryClient.invalidateQueries();
    },
    onError: (e: any) => Alert.alert('Could not add the update', errorMessage(e)),
  });

  if (isLoading) return <ActivityIndicator style={{ marginTop: Spacing.xl }} color={Colors.primary} />;
  if (isError || !data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm }}>
        <Text style={s.secondary}>Could not load this complaint.</Text>
        <TouchableOpacity onPress={() => refetch()}><Text style={{ color: Colors.primary, fontWeight: '700' }}>Try again</Text></TouchableOpacity>
      </View>
    );
  }
  const { d, flat } = data;
  const actions = nextComplaintActions(d.status);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.background }} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }} keyboardShouldPersistTaps="handled">
      <View style={s.card}>
        <Text style={s.primary}>{d.title}</Text>
        <Text style={s.secondary}>{d.ticketNumber} · {flat} · {d.category} · {d.priority} · {d.status}</Text>
        <Text style={{ ...Typography.body1, color: Colors.textPrimary, marginTop: 6 }}>{d.description}</Text>
        {d.imageUrls?.length > 0 && (
          <ScrollView horizontal style={{ marginTop: 8 }} contentContainerStyle={{ gap: 8 }}>
            {d.imageUrls.map((m) => <MediaImage key={m} id={m} size={96} />)}
          </ScrollView>
        )}
      </View>

      <Text style={{ ...Typography.h4, color: Colors.textPrimary }}>Updates</Text>
      {d.updates?.length === 0 && <Text style={s.secondary}>No updates yet.</Text>}
      {d.updates?.map((u, i) => (
        <View key={i} style={s.card}>
          <Text style={s.secondary}>{u.status} · {shortDateTime(u.updatedAt)}</Text>
          <Text style={{ ...Typography.body1, color: Colors.textPrimary }}>{u.comment}</Text>
          {u.mediaIds && u.mediaIds.length > 0 && (
            <ScrollView horizontal contentContainerStyle={{ gap: 8, marginTop: 6 }}>
              {u.mediaIds.map((m) => <MediaImage key={m} id={m} size={84} />)}
            </ScrollView>
          )}
        </View>
      ))}

      {d.status !== 'Closed' && (
        <View style={[s.card, { gap: Spacing.sm }]}>
          <Text style={{ ...Typography.h4, color: Colors.textPrimary }}>Add an update</Text>
          <TextInput
            value={note} onChangeText={setNote} multiline placeholder="What did you find or do?" placeholderTextColor={Colors.textDisabled}
            style={{ minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, ...Typography.body1, color: Colors.textPrimary }}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {photos.map((p) => (
              <TouchableOpacity key={p} accessibilityLabel="Remove picture" onPress={() => setPhotos(photos.filter((x) => x !== p))}>
                <MediaImage uri={p} size={64} />
              </TouchableOpacity>
            ))}
            {photos.length < 6 && (
              <TouchableOpacity style={[s.btn, s.btnAlt, { flex: 0, paddingHorizontal: 14 }]} onPress={async () => { const u = await pickPhoto(); if (u) setPhotos([...photos, u]); }}>
                <Text style={[s.btnText, s.btnAltText]}>+ Picture</Text>
              </TouchableOpacity>
            )}
          </View>
          {actions.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {actions.map((a) => (
                <TouchableOpacity key={a.status} style={[s.btn, nextStatus === a.status ? {} : s.btnAlt]} onPress={() => setNextStatus(nextStatus === a.status ? null : a.status)}>
                  <Text style={[s.btnText, nextStatus === a.status ? {} : s.btnAltText]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TouchableOpacity style={[s.btn, (!note.trim() || send.isPending) && { opacity: 0.5 }]} disabled={!note.trim() || send.isPending} onPress={() => send.mutate()}>
            {send.isPending ? <ActivityIndicator color={Colors.textOnPrimary} /> : <Text style={s.btnText}>Post update</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}
