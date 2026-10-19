import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert, Modal } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';
import { apiFetch } from '../../utils/api';
import { errorMessage } from '../../utils/errorMessage';
import { useAuthStore } from '../../store/authStore';
import { PostImages } from '../../ui/PostImages';
import { timeAgo } from './feedModel';
import { canRemoveReply, closeLabel, closedLabel, conditionLabel, kindIcon, kindLabel, priceText, repliers } from './marketModel';
import type { MarketPost } from './MarketScreen';

interface Reply { id: string; authorUserId: string; authorFlatDisplay: string; body: string; isMine: boolean; createdAt: string }
interface Detail { post: MarketPost; replies: Reply[] }

/** One market post: the details, the neighbours' replies, and (for the author) closing the deal. */
export default function MarketPostScreen() {
  const { params } = useRoute<any>();
  const navigation = useNavigation<any>();
  const postId: string = params?.postId;
  const queryClient = useQueryClient();
  const { userId, activeRole } = useAuthStore();
  const isAdmin = activeRole === 'admin';
  const [text, setText] = useState('');
  const [choosing, setChoosing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['market-post', postId],
    queryFn: () => apiFetch<Detail>(`/marketplace/market/${postId}`),
  });

  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['market-post'] }); queryClient.invalidateQueries({ queryKey: ['market'] }); };
  const fail = (title: string) => (e: any) => Alert.alert(title, errorMessage(e));

  const send = useMutation({
    mutationFn: () => apiFetch(`/marketplace/market/${postId}/replies`, { method: 'POST', body: JSON.stringify({ body: text.trim() }) }),
    onSuccess: () => { setText(''); refresh(); },
    onError: fail('Could not send'),
  });
  const close = useMutation({
    mutationFn: (withUserId: string | null) => apiFetch(`/marketplace/market/${postId}/close`, { method: 'POST', body: JSON.stringify({ withUserId }) }),
    onSuccess: () => { setChoosing(false); refresh(); },
    onError: fail('Could not close'),
  });
  const reopen = useMutation({
    mutationFn: () => apiFetch(`/marketplace/market/${postId}/reopen`, { method: 'POST' }),
    onSuccess: refresh, onError: fail('Could not reopen'),
  });
  const remove = useMutation({
    mutationFn: () => apiFetch(`/marketplace/market/${postId}`, { method: 'DELETE' }),
    onSuccess: () => { refresh(); navigation.goBack(); }, onError: fail('Could not remove'),
  });
  const removeReply = useMutation({
    mutationFn: (id: string) => apiFetch(`/marketplace/market/replies/${id}`, { method: 'DELETE' }),
    onSuccess: refresh, onError: fail('Could not remove'),
  });

  if (isLoading) return <ActivityIndicator style={{ marginTop: Spacing.xl }} color={Colors.primary} />;
  if (isError || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Could not load this post.</Text>
        <TouchableOpacity onPress={() => refetch()}><Text style={styles.link}>Try again</Text></TouchableOpacity>
      </View>
    );
  }

  const { post, replies } = data;
  const canManage = isAdmin || post.authorUserId === userId;
  const isClosed = post.status === 'Closed';
  const price = priceText(post.kind, post.priceRupees);
  const dealWith = replies.find((r) => r.authorUserId === post.closedWithUserId)?.authorFlatDisplay;

  const confirmDelete = () => Alert.alert('Remove this post?', 'It will disappear for everyone.', [
    { text: 'Keep it', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => remove.mutate() },
  ]);

  const startClose = () => {
    if (repliers(replies, post.authorUserId).length === 0) {
      Alert.alert(closeLabel(post.kind), 'Close this post?', [{ text: 'Not yet', style: 'cancel' }, { text: 'Close it', onPress: () => close.mutate(null) }]);
    } else setChoosing(true);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={replies}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={
          <View style={styles.post}>
            <PostImages ids={post.imageIds} />
            <View style={{ padding: Spacing.md, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.kind}>{kindIcon(post.kind)} {kindLabel(post.kind)}</Text>
                {isClosed && <Text style={styles.closed}>{closedLabel(post.kind)}</Text>}
              </View>
              <Text style={styles.title}>{post.title}</Text>
              {price !== '' && <Text style={styles.price}>{price}{post.kind === 'Sell' && post.condition ? `  ·  ${conditionLabel(post.condition)}` : ''}</Text>}
              {post.description ? <Text style={styles.body}>{post.description}</Text> : null}
              <Text style={styles.muted}>{post.authorFlatDisplay}  ·  {timeAgo(post.createdAt)}</Text>
              {isClosed && <Text style={styles.note}>{dealWith ? `Deal done with ${dealWith}.` : 'This deal is closed.'}</Text>}

              {canManage && (
                <View style={styles.actions}>
                  {!isClosed
                    ? <TouchableOpacity style={styles.primaryBtn} onPress={startClose} disabled={close.isPending}><Text style={styles.primaryText}>{closeLabel(post.kind)}</Text></TouchableOpacity>
                    : <TouchableOpacity style={styles.secondaryBtn} onPress={() => reopen.mutate()} disabled={reopen.isPending}><Text style={styles.secondaryText}>Reopen</Text></TouchableOpacity>}
                  {!isClosed && <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('CreateMarketPost', { post })}><Text style={styles.secondaryText}>Edit</Text></TouchableOpacity>}
                  <TouchableOpacity style={styles.secondaryBtn} onPress={confirmDelete}><Text style={[styles.secondaryText, { color: Colors.error }]}>Remove</Text></TouchableOpacity>
                </View>
              )}
              <Text style={styles.section}>{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.reply}>
            <View style={{ flex: 1 }}>
              <Text style={styles.replyAuthor}>{item.authorFlatDisplay}{item.authorUserId === post.authorUserId ? ' · poster' : ''}  <Text style={styles.replyTime}>{timeAgo(item.createdAt)}</Text></Text>
              <Text style={styles.replyBody}>{item.body}</Text>
            </View>
            {canRemoveReply({ isAdmin, userId }, item, post.authorUserId) && (
              <TouchableOpacity accessibilityLabel="Remove reply" hitSlop={10} onPress={() => removeReply.mutate(item.id)}><Text style={{ color: Colors.textSecondary, fontSize: 18 }}>✕</Text></TouchableOpacity>
            )}
          </View>
        )}
        contentContainerStyle={{ paddingBottom: Spacing.lg }}
      />

      {isClosed ? (
        <Text style={[styles.muted, { padding: Spacing.md }]}>This deal is closed, so there are no more replies.</Text>
      ) : (
        <View style={styles.composer}>
          <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Write a reply" placeholderTextColor={Colors.textDisabled} maxLength={1000} />
          <TouchableOpacity style={[styles.send, (!text.trim() || send.isPending) && { opacity: 0.5 }]} disabled={!text.trim() || send.isPending} onPress={() => send.mutate()}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={choosing} transparent animationType="fade" onRequestClose={() => setChoosing(false)}>
        <View style={styles.scrim}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Who did you do this with?</Text>
            {repliers(replies, post.authorUserId).map((r) => (
              <TouchableOpacity key={r.userId} style={styles.choice} disabled={close.isPending} onPress={() => close.mutate(r.userId)}>
                <Text style={styles.choiceText}>{r.flat}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.choice} disabled={close.isPending} onPress={() => close.mutate(null)}>
              <Text style={[styles.choiceText, { color: Colors.textSecondary }]}>Someone else, just close it</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setChoosing(false)}><Text style={[styles.link, { textAlign: 'center', marginTop: Spacing.sm }]}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  muted: { ...Typography.caption, color: Colors.textSecondary },
  link: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },
  post: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  kind: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  closed: { fontSize: 11, fontWeight: '700', color: '#fff', backgroundColor: Colors.textSecondary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 1, overflow: 'hidden' },
  title: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  price: { fontSize: 17, fontWeight: '700', color: Colors.success },
  body: { ...Typography.body1, color: Colors.textPrimary },
  note: { ...Typography.body2, color: Colors.textSecondary, backgroundColor: Colors.background, padding: Spacing.sm, borderRadius: Radius.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  primaryText: { ...Typography.body2, fontWeight: '700', color: Colors.textOnPrimary },
  secondaryBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  secondaryText: { ...Typography.body2, fontWeight: '700', color: Colors.textPrimary },
  section: { ...Typography.body2, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.sm },
  reply: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.divider, backgroundColor: Colors.surface },
  replyAuthor: { ...Typography.caption, fontWeight: '700', color: Colors.textSecondary },
  replyTime: { fontWeight: '400', color: Colors.textDisabled },
  replyBody: { ...Typography.body2, color: Colors.textPrimary, marginTop: 2 },
  composer: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  input: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, ...Typography.body2, color: Colors.textPrimary },
  send: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  sendText: { ...Typography.body2, fontWeight: '700', color: Colors.textOnPrimary },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.md, gap: Spacing.xs },
  sheetTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: Spacing.xs },
  choice: { padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  choiceText: { ...Typography.body1, color: Colors.textPrimary, fontWeight: '600' },
});
