import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';
import { apiFetch } from '../../utils/api';
import { errorMessage } from '../../utils/errorMessage';

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'general', label: 'General' },
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

  const create = useMutation({
    // The server fills in the society, author and flat from your sign-in.
    mutationFn: () => apiFetch('/social/posts', {
      method: 'POST',
      body: JSON.stringify({
        societyId: ZERO, authorUserId: ZERO, authorFlatId: ZERO,
        category, body: body.trim(), groupId: null, imageUrls: [],
        pollQuestion: null, pollOptions: null, pollEndsAt: null, pollAllowMultiple: false,
        listingPricePaise: null, listingCondition: null,
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Could not post', errorMessage(e)),
  });

  const canPost = body.trim().length > 0 && !create.isPending;

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
      <Text style={styles.label}>Your message</Text>
      <TextInput
        style={styles.input}
        value={body}
        onChangeText={setBody}
        placeholder="Share something with your society"
        placeholderTextColor={Colors.textDisabled}
        multiline
        maxLength={2000}
      />
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Typography.body2, color: Colors.textPrimary },
  chipTextOn: { color: Colors.textOnPrimary, fontWeight: '700' },
  input: { minHeight: 140, textAlignVertical: 'top', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, ...Typography.body1, color: Colors.textPrimary },
  submit: { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  submitOff: { opacity: 0.5 },
  submitText: { ...Typography.body1, fontWeight: '700', color: Colors.textOnPrimary },
});
