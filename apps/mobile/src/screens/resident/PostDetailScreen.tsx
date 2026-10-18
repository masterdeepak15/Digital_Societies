import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';
import { apiFetch } from '../../utils/api';
import { errorMessage } from '../../utils/errorMessage';

interface Comment { id: string; authorFlatDisplay: string; body: string; isDeleted: boolean; createdAt: string }
interface PostDetail {
  id: string; body: string; category: string; authorFlatDisplay: string; isLocked: boolean; createdAt: string;
  reactions: { type: string; count: number; currentUserReacted: boolean }[];
  comments: Comment[];
}

export default function PostDetailScreen() {
  const { params } = useRoute<any>();
  const postId: string = params?.postId;
  const queryClient = useQueryClient();
  const [text, setText] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => apiFetch<PostDetail>(`/social/posts/${postId}`),
  });

  const send = useMutation({
    mutationFn: () => apiFetch(`/social/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ body: text.trim() }) }),
    onSuccess: () => {
      setText('');
      queryClient.invalidateQueries();
    },
    onError: (e: any) => Alert.alert('Could not comment', errorMessage(e)),
  });

  const react = useMutation({
    mutationFn: () => apiFetch(`/social/posts/${postId}/react`, { method: 'POST', body: JSON.stringify({ type: 'like' }) }),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (e: any) => Alert.alert('Could not react', errorMessage(e)),
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

  const likes = data.reactions?.find((r) => r.type === 'like');
  const comments = (data.comments ?? []).filter((c) => !c.isDeleted);

  return (
    <View style={styles.container}>
      <FlatList
        data={comments}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={
          <View style={styles.post}>
            <Text style={styles.author}>{data.authorFlatDisplay}</Text>
            <Text style={styles.body}>{data.body}</Text>
            <TouchableOpacity style={styles.likeBtn} onPress={() => react.mutate()} disabled={react.isPending}>
              <Text style={styles.likeText}>{likes?.currentUserReacted ? 'Liked' : 'Like'} · {likes?.count ?? 0}</Text>
            </TouchableOpacity>
            <Text style={styles.sectionTitle}>{comments.length} {comments.length === 1 ? 'comment' : 'comments'}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.comment}>
            <Text style={styles.author}>{item.authorFlatDisplay}</Text>
            <Text style={styles.commentBody}>{item.body}</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: Spacing.lg }}
      />
      {data.isLocked ? (
        <Text style={[styles.muted, { padding: Spacing.md }]}>Comments are closed on this post.</Text>
      ) : (
        <View style={styles.composer}>
          <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Write a comment" placeholderTextColor={Colors.textDisabled} maxLength={1000} />
          <TouchableOpacity style={[styles.send, (!text.trim() || send.isPending) && styles.sendOff]} disabled={!text.trim() || send.isPending} onPress={() => send.mutate()}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  muted: { ...Typography.body2, color: Colors.textSecondary },
  link: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },
  post: { padding: Spacing.md, gap: Spacing.xs, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  author: { ...Typography.caption, fontWeight: '700', color: Colors.textSecondary },
  body: { ...Typography.body1, color: Colors.textPrimary },
  likeBtn: { alignSelf: 'flex-start', paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  likeText: { ...Typography.body2, color: Colors.textPrimary },
  sectionTitle: { ...Typography.body2, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.sm },
  comment: { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.divider, gap: 2 },
  commentBody: { ...Typography.body2, color: Colors.textPrimary },
  composer: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  input: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, ...Typography.body2, color: Colors.textPrimary },
  send: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  sendOff: { opacity: 0.5 },
  sendText: { ...Typography.body2, fontWeight: '700', color: Colors.textOnPrimary },
});
