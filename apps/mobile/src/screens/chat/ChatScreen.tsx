import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { MediaImage } from '../../ui/MediaImage';
import { pickPhoto } from '../../services/media/pickPhoto';
import { fetchMessages, fetchOlder, markRead, queueMessage, sendPending } from '../../services/chat/chatService';
import { loadPresence } from '../../services/chat/useChatHub';
import {
  QUICK_EMOJI, appendMessage, mergeMessages, pendingToMessage, presenceText, tickFor, timeOf, toRows,
  type ChatMessage, type ChatRow, type Conversation,
} from './chatModel';

const BUBBLE_IMAGE = 220;

/** One conversation: live messages, ticks, pictures, emoji, and anything you write while offline is sent when you are back. */
export default function ChatScreen() {
  const navigation = useNavigation<any>();
  const { params } = useRoute<any>();
  const conversationId: string = params?.conversationId;
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.userId) ?? '';
  const outbox = useChatStore((s) => s.outbox);
  const presence = useChatStore((s) => s.presence);
  const [text, setText] = useState('');
  const [emoji, setEmoji] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [noMore, setNoMore] = useState(false);
  const input = useRef<TextInput>(null);

  const conversation = (queryClient.getQueryData<Conversation[]>(['chat-conversations']) ?? []).find((c) => c.id === conversationId);
  const isGroup = conversation?.type === 'Group';
  const other = conversation?.otherUserId ?? null;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['chat-messages', conversationId],
    queryFn: () => fetchMessages(conversationId),
    staleTime: 5_000,
  });

  // This conversation is on screen: anything arriving now counts as read.
  useEffect(() => {
    useChatStore.getState().setOpenConversation(conversationId);
    void markRead(conversationId).then(() => queryClient.invalidateQueries({ queryKey: ['chat-conversations'] }));
    return () => {
      useChatStore.getState().setOpenConversation(null);
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    };
  }, [conversationId, queryClient]);

  useEffect(() => {
    if (data && data.some((m) => !m.isMine)) void markRead(conversationId);
  }, [data?.length, conversationId]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (other) void loadPresence([other]); }, [other]);

  const pending = useMemo(
    () => outbox.filter((p) => p.conversationId === conversationId).map((p) => pendingToMessage(p, me)),
    [outbox, conversationId, me],
  );
  const messages = useMemo(() => mergeMessages(data ?? [], pending), [data, pending]);
  const rows = useMemo(() => toRows(messages, isGroup).reverse(), [messages, isGroup]);   // inverted list: newest first

  const subtitle = isGroup ? `${conversation?.memberCount ?? ''} people`
    : other ? presenceText(presence[other]?.online ?? conversation?.isOnline ?? false, presence[other]?.lastSeenAt ?? conversation?.lastSeenAt) : '';

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <TouchableOpacity disabled={!isGroup} onPress={() => navigation.navigate('GroupInfo', { conversationId })}>
          <Text style={styles.headerTitle} numberOfLines={1}>{conversation?.title ?? 'Chat'}</Text>
          {!!subtitle && <Text style={[styles.headerSub, subtitle === 'online' && { color: '#25D366' }]} numberOfLines={1}>{subtitle}</Text>}
        </TouchableOpacity>
      ),
    });
  }, [navigation, conversation?.title, subtitle, isGroup, conversationId]);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    setEmoji(false);
    queueMessage(conversationId, 'Text', body, null);
  };

  const sendPicture = async () => {
    const uri = await pickPhoto();
    if (uri) queueMessage(conversationId, 'Image', '', uri);
  };

  const loadOlder = useCallback(async () => {
    if (loadingOlder || noMore || !data || data.length === 0) return;
    setLoadingOlder(true);
    try {
      const older = await fetchOlder(conversationId, data[0].sentAt);
      if (older.length === 0) setNoMore(true);
      queryClient.setQueryData<ChatMessage[]>(['chat-messages', conversationId], (cur) => older.reduce((acc, m) => appendMessage(acc, m), cur ?? []));
    } catch { /* try again on the next scroll */ } finally { setLoadingOlder(false); }
  }, [loadingOlder, noMore, data, conversationId, queryClient]);

  const renderRow = ({ item }: { item: ChatRow }) => {
    if (item.type === 'day') return <View style={styles.dayWrap}><Text style={styles.day}>{item.label}</Text></View>;
    const m = item.message;
    const tick = m.isMine ? tickFor(m.status) : null;
    const isImage = m.kind === 'Image';
    return (
      <View style={[styles.line, m.isMine ? styles.lineMine : styles.lineTheirs]}>
        <TouchableOpacity
          activeOpacity={m.status === 'Failed' ? 0.6 : 1}
          onPress={() => { if (m.status === 'Failed') sendPending(m.clientId); }}
          style={[styles.bubble, m.isMine ? styles.bubbleMine : styles.bubbleTheirs, isImage && styles.bubbleImage]}>
          {item.showSender && <Text style={styles.sender}>{m.senderName}</Text>}
          {isImage && (m.mediaId
            ? <MediaImage id={m.mediaId} width={BUBBLE_IMAGE} height={BUBBLE_IMAGE} style={{ borderRadius: 10 }} />
            : <PendingPicture clientId={m.clientId} />)}
          {!!m.body && <Text style={styles.body}>{m.body}</Text>}
          <View style={styles.meta}>
            <Text style={styles.time}>{timeOf(m.sentAt)}</Text>
            {tick && <Text style={[styles.tick, tick.read && { color: '#34B7F1' }, m.status === 'Failed' && { color: Colors.error }]}>{tick.text}</Text>}
          </View>
          {m.status === 'Failed' && <Text style={styles.failed}>Not sent. Tap to try again.</Text>}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {isLoading ? <ActivityIndicator style={{ flex: 1 }} size="large" color={Colors.primary} /> : isError && !data ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Could not load this chat.</Text>
          <TouchableOpacity onPress={() => refetch()}><Text style={styles.link}>Try again</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          inverted
          data={rows}
          keyExtractor={(r) => r.key}
          renderItem={renderRow}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingOlder ? <ActivityIndicator style={{ margin: Spacing.md }} color={Colors.primary} /> : null}
          ListEmptyComponent={<Text style={[styles.muted, { transform: [{ scaleY: -1 }], textAlign: 'center', padding: Spacing.xl }]}>Say hello 👋</Text>}
          contentContainerStyle={{ paddingVertical: Spacing.sm }}
        />
      )}

      {emoji && (
        <View style={styles.emojiRow}>
          {QUICK_EMOJI.map((e) => (
            <TouchableOpacity key={e} onPress={() => setText((t) => t + e)}><Text style={styles.emoji}>{e}</Text></TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.composer}>
        <TouchableOpacity accessibilityLabel="Emoji" onPress={() => setEmoji((v) => !v)} style={styles.iconBtn}><Text style={styles.icon}>😊</Text></TouchableOpacity>
        <TextInput
          ref={input}
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message"
          placeholderTextColor={Colors.textDisabled}
          multiline
          maxLength={4000}
          onFocus={() => setEmoji(false)}
        />
        <TouchableOpacity accessibilityLabel="Send a picture" onPress={sendPicture} style={styles.iconBtn}><Text style={styles.icon}>📷</Text></TouchableOpacity>
        <TouchableOpacity accessibilityLabel="Send" onPress={send} disabled={!text.trim()} style={[styles.send, !text.trim() && { opacity: 0.4 }]}>
          <Text style={styles.sendText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

/** The picture you just chose, shown from the phone until it has been uploaded. */
function PendingPicture({ clientId }: { clientId: string }) {
  const uri = useChatStore((s) => s.outbox.find((p) => p.clientId === clientId)?.localUri ?? null);
  return <MediaImage uri={uri} width={BUBBLE_IMAGE} height={BUBBLE_IMAGE} style={{ borderRadius: 10 }} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ECE5DD' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  muted: { fontSize: 13, color: Colors.textSecondary },
  link: { fontSize: 14, color: Colors.primary, fontWeight: '700' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, maxWidth: 220 },
  headerSub: { fontSize: 11, color: Colors.textSecondary },
  dayWrap: { alignItems: 'center', marginVertical: 10 },
  day: { fontSize: 11, color: Colors.textSecondary, backgroundColor: '#E1F3FB', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  line: { paddingHorizontal: 10, marginVertical: 2, flexDirection: 'row' },
  lineMine: { justifyContent: 'flex-end' },
  lineTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, elevation: 1 },
  bubbleMine: { backgroundColor: '#DCF8C6', borderTopRightRadius: 2 },
  bubbleTheirs: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 2 },
  bubbleImage: { padding: 4 },
  sender: { fontSize: 12, fontWeight: '700', color: Colors.primary, marginBottom: 2 },
  body: { fontSize: 15, color: Colors.textPrimary, lineHeight: 21 },
  meta: { flexDirection: 'row', alignSelf: 'flex-end', gap: 4, marginTop: 1 },
  time: { fontSize: 10, color: Colors.textSecondary },
  tick: { fontSize: 11, color: Colors.textSecondary, fontWeight: '700' },
  failed: { fontSize: 11, color: Colors.error, marginTop: 2 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: Spacing.sm, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.divider },
  emoji: { fontSize: 26, paddingHorizontal: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, padding: 6, backgroundColor: '#F0F0F0' },
  iconBtn: { paddingHorizontal: 4, paddingBottom: 8 },
  icon: { fontSize: 22 },
  input: { flex: 1, maxHeight: 120, backgroundColor: '#fff', borderRadius: 22, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 9, fontSize: 15, color: Colors.textPrimary },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#128C7E', alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#fff', fontSize: 18 },
});
