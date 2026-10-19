import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../../theme/colors';
import { Spacing, Radius } from '../../theme/spacing';
import { errorMessage } from '../../utils/errorMessage';
import { initialsOf } from '../resident/feedModel';
import { addMembers, createGroup, fetchPeople, startDirect } from '../../services/chat/chatService';
import type { Person } from './chatModel';

/**
 * Pick a neighbour to chat with, or tick several to make a group.
 * With `addTo` (a group id) it adds the chosen people to that group instead.
 */
export default function NewChatScreen() {
  const navigation = useNavigation<any>();
  const { params } = useRoute<any>();
  const addTo: string | undefined = params?.addTo;
  const exclude: string[] = params?.exclude ?? [];
  const queryClient = useQueryClient();

  const [term, setTerm] = useState('');
  const [group, setGroup] = useState(!!addTo);
  const [picked, setPicked] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['chat-people', term], queryFn: () => fetchPeople(term), staleTime: 30_000 });
  const people = (data ?? []).filter((p) => !exclude.includes(p.userId));

  const open = async (p: Person) => {
    setBusy(true);
    try {
      const { id } = await startDirect(p.userId);
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      navigation.replace('Chat', { conversationId: id });
    } catch (e: any) { Alert.alert('Could not start the chat', errorMessage(e)); setBusy(false); }
  };

  const toggle = (id: string) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const finish = async () => {
    setBusy(true);
    try {
      if (addTo) {
        await addMembers(addTo, picked);
        queryClient.invalidateQueries({ queryKey: ['chat-members', addTo] });
        queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
        navigation.goBack();
      } else {
        const { id } = await createGroup(title.trim(), picked);
        queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
        navigation.replace('Chat', { conversationId: id });
      }
    } catch (e: any) { Alert.alert('Could not save', errorMessage(e)); setBusy(false); }
  };

  const canFinish = picked.length > 0 && (addTo || title.trim().length > 0) && !busy;

  return (
    <View style={styles.container}>
      {!addTo && (
        <View style={styles.modeRow}>
          <TouchableOpacity style={[styles.mode, !group && styles.modeOn]} onPress={() => { setGroup(false); setPicked([]); }}>
            <Text style={[styles.modeText, !group && styles.modeTextOn]}>One person</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.mode, group && styles.modeOn]} onPress={() => setGroup(true)}>
            <Text style={[styles.modeText, group && styles.modeTextOn]}>New group</Text>
          </TouchableOpacity>
        </View>
      )}
      {group && !addTo && (
        <TextInput style={styles.titleInput} value={title} onChangeText={setTitle} placeholder="Group name" placeholderTextColor={Colors.textDisabled} maxLength={100} />
      )}
      <TextInput style={styles.search} value={term} onChangeText={setTerm} placeholder="Search by name or flat" placeholderTextColor={Colors.textDisabled} autoCorrect={false} />

      {isLoading ? <ActivityIndicator style={{ marginTop: Spacing.xl }} color={Colors.primary} /> : (
        <FlatList
          data={people}
          keyExtractor={(p) => p.userId}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.empty}>No one found.</Text>}
          renderItem={({ item: p }) => (
            <TouchableOpacity style={styles.row} disabled={busy} onPress={() => (group ? toggle(p.userId) : open(p))}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initialsOf(p.name)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.name}</Text>
                <Text style={styles.flat}>{p.flat}</Text>
              </View>
              {group && <Text style={[styles.check, picked.includes(p.userId) && styles.checkOn]}>{picked.includes(p.userId) ? '✓' : ''}</Text>}
            </TouchableOpacity>
          )}
        />
      )}

      {group && (
        <TouchableOpacity style={[styles.submit, !canFinish && { opacity: 0.5 }]} disabled={!canFinish} onPress={finish}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{addTo ? `Add ${picked.length || ''}` : `Create group${picked.length ? ` (${picked.length + 1})` : ''}`}</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  modeRow: { flexDirection: 'row', margin: Spacing.sm, backgroundColor: Colors.background, borderRadius: 22, padding: 3 },
  mode: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 20 },
  modeOn: { backgroundColor: Colors.primary },
  modeText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  modeTextOn: { color: '#fff' },
  titleInput: { marginHorizontal: Spacing.sm, marginBottom: Spacing.xs, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: 15, color: Colors.textPrimary },
  search: { marginHorizontal: Spacing.sm, marginBottom: Spacing.xs, backgroundColor: Colors.background, borderRadius: 22, paddingHorizontal: Spacing.md, paddingVertical: 8, fontSize: 14, color: Colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  flat: { fontSize: 12, color: Colors.textSecondary },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.border, textAlign: 'center', lineHeight: 20, color: '#fff', fontWeight: '800', overflow: 'hidden' },
  checkOn: { backgroundColor: '#25D366', borderColor: '#25D366' },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: Spacing.xl },
  submit: { margin: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
