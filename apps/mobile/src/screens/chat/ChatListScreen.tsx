import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { initialsOf } from '../resident/feedModel';
import { fetchConversations } from '../../services/chat/chatService';
import { loadPresence } from '../../services/chat/useChatHub';
import { useChatStore } from '../../store/chatStore';
import { filterConversations, listTime, type Conversation } from './chatModel';

/** All your chats, newest first, with unread counts and who is online. */
export default function ChatListScreen() {
  const navigation = useNavigation<any>();
  const [term, setTerm] = useState('');
  const presence = useChatStore((s) => s.presence);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: fetchConversations,
    staleTime: 10_000,
  });

  // The list carries the state at load time; live events keep it current after that.
  useEffect(() => {
    const ids = (data ?? []).filter((c) => c.type === 'Direct' && c.otherUserId).map((c) => c.otherUserId as string);
    void loadPresence(ids);
  }, [data]);

  const shown = useMemo(() => filterConversations(data ?? [], term), [data, term]);

  const renderItem = ({ item: c }: { item: Conversation }) => {
    const online = c.type === 'Direct' && c.otherUserId ? (presence[c.otherUserId]?.online ?? c.isOnline) : false;
    return (
      <TouchableOpacity style={styles.row} activeOpacity={0.8} onPress={() => navigation.navigate('Chat', { conversationId: c.id })}>
        <View>
          <View style={[styles.avatar, c.type === 'Group' && { backgroundColor: Colors.secondary }]}>
            <Text style={styles.avatarText}>{c.type === 'Group' ? '👥' : initialsOf(c.title)}</Text>
          </View>
          {online && <View style={styles.dot} />}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.title} numberOfLines={1}>{c.title}</Text>
            <Text style={[styles.time, c.unreadCount > 0 && { color: Colors.primary, fontWeight: '700' }]}>{listTime(c.lastMessageAt)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.preview, c.unreadCount > 0 && { color: Colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>
              {c.lastMessageMine ? 'You: ' : ''}{c.lastMessagePreview || 'No messages yet'}
            </Text>
            {c.unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{c.unreadCount > 99 ? '99+' : c.unreadCount}</Text></View>}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <TextInput style={styles.search} value={term} onChangeText={setTerm} placeholder="Search chats" placeholderTextColor={Colors.textDisabled} autoCorrect={false} />
      </View>
      {isLoading ? <ActivityIndicator style={{ flex: 1 }} size="large" color={Colors.primary} /> : (
        <FlatList
          data={shown}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          contentContainerStyle={{ paddingBottom: 90 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 44 }}>💬</Text>
              <Text style={styles.emptyTitle}>{isError ? 'Could not load your chats' : term ? 'No chat matches' : 'No chats yet'}</Text>
              <Text style={styles.emptySub}>{isError ? 'Pull down to try again.' : 'Start a chat with a neighbour or make a group.'}</Text>
            </View>
          }
        />
      )}
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('NewChat')}>
        <Text style={styles.fabText}>✉️  New chat</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  searchBox: { padding: Spacing.sm, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  search: { backgroundColor: Colors.background, borderRadius: 22, paddingHorizontal: Spacing.md, paddingVertical: 8, fontSize: 14, color: Colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  dot: { position: 'absolute', right: 0, bottom: 0, width: 13, height: 13, borderRadius: 7, backgroundColor: '#25D366', borderWidth: 2, borderColor: Colors.surface },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  time: { fontSize: 11, color: Colors.textSecondary, marginLeft: 8 },
  preview: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 90, gap: Spacing.sm, paddingHorizontal: Spacing.xl },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  emptySub: { fontSize: 13, color: Colors.textDisabled, textAlign: 'center' },
  fab: { position: 'absolute', bottom: 24, right: 20, backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 25, elevation: 6 },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
