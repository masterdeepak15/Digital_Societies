import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';
import { apiFetch } from '../../utils/api';
import { errorMessage } from '../../utils/errorMessage';
import { useAuthStore } from '../../store/authStore';
import { PostImages } from '../../ui/PostImages';
import { showPostMenu } from './postActions';

interface Comment { id: string; authorFlatDisplay: string; body: string; isDeleted: boolean; createdAt: string }
interface PollOption { optionId: string; text: string; votes: number; percentage: number }
interface Poll { pollId: string; question: string; options: PollOption[]; endsAt?: string | null; hasEnded: boolean; currentUserVoted: boolean; currentUserVoteOptionIds?: string[] | null }
interface PostDetail {
  id: string; body: string; category: string; authorUserId: string; authorFlatDisplay: string; isLocked: boolean; isPinned: boolean;
  isHidden?: boolean; imageUrls: string[]; createdAt: string;
  reactions: { type: string; count: number; currentUserReacted: boolean }[];
  comments: Comment[];
  poll?: Poll | null;
}

export default function PostDetailScreen() {
  const { params } = useRoute<any>();
  const navigation = useNavigation<any>();
  const postId: string = params?.postId;
  const queryClient = useQueryClient();
  const { userId, activeRole } = useAuthStore();
  const isAdmin = activeRole === 'admin';
  const [text, setText] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => apiFetch<PostDetail>(`/social/posts/${postId}`),
  });

  const send = useMutation({
    mutationFn: () => apiFetch(`/social/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ body: text.trim() }) }),
    onSuccess: () => { setText(''); queryClient.invalidateQueries(); },
    onError: (e: any) => Alert.alert('Could not comment', errorMessage(e)),
  });

  // A like is the "thumbsup" reaction; tapping it again takes it back.
  const like = useMutation({
    mutationFn: (liked: boolean) => liked
      ? apiFetch(`/social/posts/${postId}/react`, { method: 'DELETE' })
      : apiFetch(`/social/posts/${postId}/react`, { method: 'POST', body: JSON.stringify({ type: 'thumbsup' }) }),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (e: any) => Alert.alert('Could not react', errorMessage(e)),
  });

  const vote = useMutation({
    mutationFn: (optionId: string) => apiFetch(`/social/polls/${data!.poll!.pollId}/vote`, { method: 'POST', body: JSON.stringify({ optionIds: [optionId] }) }),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (e: any) => Alert.alert('Could not vote', errorMessage(e)),
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

  const likes = data.reactions?.find((r) => r.type === 'thumbsup');
  const comments = (data.comments ?? []).filter((c) => !c.isDeleted);
  const isAuthor = data.authorUserId === userId;
  const poll = data.poll;
  const myVote = poll?.currentUserVoteOptionIds ?? [];
  const totalVotes = poll?.options.reduce((n, o) => n + o.votes, 0) ?? 0;

  return (
    <View style={styles.container}>
      <FlatList
        data={comments}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={
          <View style={styles.post}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.author}>{data.authorFlatDisplay}{data.isHidden ? ' · hidden' : ''}{data.isLocked ? ' · comments closed' : ''}</Text>
              {(isAdmin || isAuthor) && (
                <TouchableOpacity accessibilityLabel="Post options" hitSlop={10}
                  onPress={() => showPostMenu(data, { isAdmin, isAuthor }, (deleted) => { queryClient.invalidateQueries(); if (deleted) navigation.goBack(); })}>
                  <Text style={{ fontSize: 22, paddingHorizontal: 6 }}>⋯</Text>
                </TouchableOpacity>
              )}
            </View>
            {data.imageUrls?.length > 0 && (
              <View style={{ marginHorizontal: -Spacing.md }}>
                <PostImages ids={data.imageUrls} onDoubleTap={() => { if (!likes?.currentUserReacted) like.mutate(false); }} />
              </View>
            )}
            <Text style={styles.body}>{data.body}</Text>

            {poll && (
              <View style={styles.poll}>
                <Text style={styles.pollQuestion}>{poll.question}</Text>
                {poll.options.map((o) => {
                  const mine = myVote.includes(o.optionId);
                  const showResult = poll.currentUserVoted || poll.hasEnded;
                  return (
                    <TouchableOpacity key={o.optionId} disabled={poll.hasEnded || vote.isPending} onPress={() => vote.mutate(o.optionId)}
                      style={[styles.option, mine && styles.optionMine]}>
                      {showResult && <View style={[styles.bar, { width: `${Math.round(o.percentage)}%` }]} />}
                      <Text style={[styles.optionText, mine && { fontWeight: '700' }]}>{mine ? '✓ ' : ''}{o.text}</Text>
                      {showResult && <Text style={styles.optionPct}>{Math.round(o.percentage)}% · {o.votes}</Text>}
                    </TouchableOpacity>
                  );
                })}
                <Text style={styles.muted}>{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}{poll.hasEnded ? ' · poll ended' : poll.currentUserVoted ? ' · tap another option to change your vote' : ''}</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.likeBtn, likes?.currentUserReacted && styles.likeBtnOn]} onPress={() => like.mutate(!!likes?.currentUserReacted)} disabled={like.isPending}>
              <Text style={styles.likeText}>👍 {likes?.currentUserReacted ? 'Liked' : 'Like'} · {likes?.count ?? 0}</Text>
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
  post: { padding: Spacing.md, gap: Spacing.sm, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  author: { ...Typography.caption, fontWeight: '700', color: Colors.textSecondary },
  body: { ...Typography.body1, color: Colors.textPrimary },
  poll: { gap: Spacing.xs, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md },
  pollQuestion: { ...Typography.h4, color: Colors.textPrimary },
  option: { overflow: 'hidden', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm },
  optionMine: { borderColor: Colors.primary },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: Colors.primary + '22' },
  optionText: { ...Typography.body2, color: Colors.textPrimary, flexShrink: 1 },
  optionPct: { ...Typography.caption, color: Colors.textSecondary },
  likeBtn: { alignSelf: 'flex-start', paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  likeBtnOn: { backgroundColor: Colors.primary + '18', borderColor: Colors.primary },
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
