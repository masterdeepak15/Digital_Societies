import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';
import { apiFetch } from '../../utils/api';
import { errorMessage } from '../../utils/errorMessage';
import { MediaImage } from '../../ui/MediaImage';
import { pickPhoto } from '../../services/media/pickPhoto';
import { uploadImage } from '../../services/media/mediaService';
import { validatePost } from './createPostModel';

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'poll', label: 'Poll' },
  { value: 'lost_found', label: 'Lost & found' },
  { value: 'help_wanted', label: 'Help wanted' },
  { value: 'for_sale', label: 'For sale' },
  { value: 'recommendation', label: 'Recommendation' },
  { value: 'warning', label: 'Warning' },
  { value: 'event', label: 'Event' },
];

const ZERO = '00000000-0000-0000-0000-000000000000';

export default function CreatePostScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('general');
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);          // local files, uploaded when posting
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);

  const isPoll = category === 'poll';
  const check = validatePost({ category, body, question, options });

  const create = useMutation({
    mutationFn: async () => {
      // Pictures are stored once per identical file; the post only carries their ids.
      const imageUrls: string[] = [];
      for (const uri of photos) imageUrls.push((await uploadImage(uri)).id);
      // The server fills in the society, author and flat from your sign-in.
      return apiFetch('/social/posts', {
        method: 'POST',
        body: JSON.stringify({
          societyId: ZERO, authorUserId: ZERO, authorFlatId: ZERO,
          category, body: (isPoll ? question : body).trim(), groupId: null, imageUrls,
          pollQuestion: isPoll ? question.trim() : null,
          pollOptions: isPoll ? options.map((o) => o.trim()).filter(Boolean) : null,
          pollEndsAt: null, pollAllowMultiple: false,
          listingPricePaise: null, listingCondition: null,
        }),
      });
    },
    onSuccess: () => { queryClient.invalidateQueries(); navigation.goBack(); },
    onError: (e: any) => Alert.alert('Could not post', errorMessage(e)),
  });

  const canPost = check.ok && !create.isPending;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>What is this about?</Text>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity key={c.value} style={[styles.chip, category === c.value && styles.chipOn]} onPress={() => setCategory(c.value)}>
            <Text style={[styles.chipText, category === c.value && styles.chipTextOn]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isPoll ? (
        <>
          <Text style={styles.label}>Your question</Text>
          <TextInput style={[styles.input, { minHeight: 70 }]} value={question} onChangeText={setQuestion} placeholder="Which day suits you for the picnic?" placeholderTextColor={Colors.textDisabled} multiline maxLength={300} />
          <Text style={styles.label}>Choices</Text>
          {options.map((o, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
              <TextInput style={[styles.input, { flex: 1, minHeight: 44 }]} value={o} onChangeText={(v) => setOptions(options.map((x, j) => (j === i ? v : x)))} placeholder={`Choice ${i + 1}`} placeholderTextColor={Colors.textDisabled} maxLength={100} />
              {options.length > 2 && (
                <TouchableOpacity accessibilityLabel={`Remove choice ${i + 1}`} onPress={() => setOptions(options.filter((_, j) => j !== i))}><Text style={{ fontSize: 20 }}>✕</Text></TouchableOpacity>
              )}
            </View>
          ))}
          {options.length < 6 && (
            <TouchableOpacity onPress={() => setOptions([...options, ''])}><Text style={styles.link}>+ Add a choice</Text></TouchableOpacity>
          )}
        </>
      ) : (
        <>
          <Text style={styles.label}>Your message</Text>
          <TextInput style={styles.input} value={body} onChangeText={setBody} placeholder="Share something with your society" placeholderTextColor={Colors.textDisabled} multiline maxLength={1000} />
        </>
      )}

      <Text style={styles.label}>Pictures (optional)</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
        {photos.map((p) => (
          <TouchableOpacity key={p} accessibilityLabel="Remove picture" onPress={() => setPhotos(photos.filter((x) => x !== p))}>
            <MediaImage uri={p} size={72} />
          </TouchableOpacity>
        ))}
        {photos.length < 4 && (
          <TouchableOpacity style={styles.addPhoto} onPress={async () => { const u = await pickPhoto(); if (u) setPhotos([...photos, u]); }}>
            <Text style={styles.link}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>
      {photos.length > 0 && <Text style={styles.hint}>Tap a picture to remove it.</Text>}

      {!check.ok && (body.trim() || question.trim()) ? <Text style={styles.hint}>{check.message}</Text> : null}
      <TouchableOpacity style={[styles.submit, !canPost && styles.submitOff]} disabled={!canPost} onPress={() => create.mutate()}>
        {create.isPending ? <ActivityIndicator color={Colors.textOnPrimary} /> : <Text style={styles.submitText}>Post</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.sm },
  label: { ...Typography.body2, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.sm },
  hint: { ...Typography.caption, color: Colors.textSecondary },
  link: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Typography.body2, color: Colors.textPrimary },
  chipTextOn: { color: Colors.textOnPrimary, fontWeight: '700' },
  input: { minHeight: 120, textAlignVertical: 'top', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, ...Typography.body1, color: Colors.textPrimary },
  addPhoto: { width: 72, height: 72, borderRadius: Radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  submit: { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  submitOff: { opacity: 0.5 },
  submitText: { ...Typography.body1, fontWeight: '700', color: Colors.textOnPrimary },
});
