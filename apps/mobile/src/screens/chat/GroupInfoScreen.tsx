import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../../theme/colors';
import { Spacing, Radius } from '../../theme/spacing';
import { apiFetch } from '../../utils/api';
import { errorMessage } from '../../utils/errorMessage';
import { initialsOf } from '../resident/feedModel';
import { leaveGroup } from '../../services/chat/chatService';
import type { Conversation } from './chatModel';

interface Member { userId: string; name: string; flat: string; isAdmin: boolean; isMe: boolean }

/** Who is in a group, add more people (group admins), or leave. */
export default function GroupInfoScreen() {
  const navigation = useNavigation<any>();
  const { params } = useRoute<any>();
  const id: string = params?.conversationId;
  const queryClient = useQueryClient();
  const conversation = (queryClient.getQueryData<Conversation[]>(['chat-conversations']) ?? []).find((c) => c.id === id);

  const { data, isLoading } = useQuery({ queryKey: ['chat-members', id], queryFn: () => apiFetch<Member[]>(`/chat/conversations/${id}/members`) });

  const leave = () => Alert.alert('Leave this group?', 'You will no longer get its messages.', [
    { text: 'Stay', style: 'cancel' },
    { text: 'Leave', style: 'destructive', onPress: async () => {
      try {
        await leaveGroup(id);
        queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
        navigation.popToTop();
      } catch (e: any) { Alert.alert('Could not leave', errorMessage(e)); }
    } },
  ]);

  return (
    <View style={styles.container}>
      <View style={styles.head}>
        <View style={styles.bigAvatar}><Text style={{ fontSize: 34 }}>👥</Text></View>
        <Text style={styles.title}>{conversation?.title ?? 'Group'}</Text>
        <Text style={styles.sub}>{data ? `${data.length} people` : ''}</Text>
      </View>

      {conversation?.isAdmin && (
        <TouchableOpacity style={styles.add} onPress={() => navigation.navigate('NewChat', { addTo: id, exclude: (data ?? []).map((m) => m.userId) })}>
          <Text style={styles.addText}>＋  Add people</Text>
        </TouchableOpacity>
      )}

      {isLoading ? <ActivityIndicator style={{ marginTop: Spacing.lg }} color={Colors.primary} /> : (
        <FlatList
          data={data ?? []}
          keyExtractor={(m) => m.userId}
          renderItem={({ item: m }) => (
            <View style={styles.row}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initialsOf(m.name)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{m.isMe ? 'You' : m.name}</Text>
                <Text style={styles.flat}>{m.flat}</Text>
              </View>
              {m.isAdmin && <Text style={styles.admin}>Group admin</Text>}
            </View>
          )}
          ListFooterComponent={
            <TouchableOpacity style={styles.leave} onPress={leave}><Text style={styles.leaveText}>Leave group</Text></TouchableOpacity>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  head: { alignItems: 'center', padding: Spacing.lg, gap: 4, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  bigAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginTop: 6 },
  sub: { fontSize: 13, color: Colors.textSecondary },
  add: { margin: Spacing.md, padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.primary, alignItems: 'center' },
  addText: { color: Colors.primary, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  flat: { fontSize: 12, color: Colors.textSecondary },
  admin: { fontSize: 11, color: '#128C7E', fontWeight: '700' },
  leave: { margin: Spacing.md, padding: Spacing.sm, alignItems: 'center' },
  leaveText: { color: Colors.error, fontWeight: '700', fontSize: 15 },
});
