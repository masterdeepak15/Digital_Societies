import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';
import { apiFetch } from '../../utils/api';
import { errorMessage } from '../../utils/errorMessage';
import { MediaImage } from '../../ui/MediaImage';
import { pickPhoto } from '../../services/media/pickPhoto';
import { uploadImage } from '../../services/media/mediaService';
import { CONDITIONS, EMPTY_MARKET_FORM, KINDS, marketFormError, toMarketPayload, type MarketFormValues } from './marketModel';

/** Post something to sell, buy or borrow; with a `post` param it changes an existing post instead. */
export default function CreateMarketPostScreen() {
  const navigation = useNavigation<any>();
  const { params } = useRoute<any>();
  const editing = params?.post as undefined | { id: string; kind: any; title: string; description: string; priceRupees: number | null; condition: string | null; imageIds: string[] };
  const queryClient = useQueryClient();

  // Pictures already stored keep their id; new ones are local files uploaded when posting.
  const [v, setV] = useState<MarketFormValues>(editing
    ? { kind: editing.kind, title: editing.title, description: editing.description, price: editing.priceRupees == null ? '' : String(editing.priceRupees), condition: editing.condition ?? 'good', photos: [] }
    : EMPTY_MARKET_FORM);
  const [kept, setKept] = useState<string[]>(editing?.imageIds ?? []);
  const set = <K extends keyof MarketFormValues>(k: K, val: MarketFormValues[K]) => setV({ ...v, [k]: val });
  const problem = marketFormError(v);
  const total = kept.length + v.photos.length;

  const save = useMutation({
    mutationFn: async () => {
      const ids = [...kept];
      for (const uri of v.photos) ids.push((await uploadImage(uri)).id);
      const body = JSON.stringify(toMarketPayload(v, ids));
      return editing
        ? apiFetch(`/marketplace/market/${editing.id}`, { method: 'PUT', body })
        : apiFetch('/marketplace/market', { method: 'POST', body });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['market'] }); queryClient.invalidateQueries({ queryKey: ['market-post'] }); navigation.goBack(); },
    onError: (e: any) => Alert.alert('Could not post', errorMessage(e)),
  });

  const isBorrow = v.kind === 'Borrow';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>What is this?</Text>
      <View style={styles.chips}>
        {KINDS.map((k) => (
          <TouchableOpacity key={k.value} style={[styles.chip, v.kind === k.value && styles.chipOn]} onPress={() => set('kind', k.value)}>
            <Text style={[styles.chipText, v.kind === k.value && styles.chipTextOn]}>{k.icon} {k.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.hint}>{KINDS.find((k) => k.value === v.kind)?.hint}</Text>

      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={v.title} onChangeText={(t) => set('title', t)} placeholder={v.kind === 'Sell' ? 'Kids bicycle' : v.kind === 'Wanted' ? 'Looking for a ladder' : 'Need a drill for a day'} placeholderTextColor={Colors.textDisabled} maxLength={120} />

      <Text style={styles.label}>Details (optional)</Text>
      <TextInput style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]} value={v.description} onChangeText={(t) => set('description', t)} multiline placeholder="Size, age, when you need it, where to meet" placeholderTextColor={Colors.textDisabled} maxLength={1000} />

      {!isBorrow && (
        <>
          <Text style={styles.label}>{v.kind === 'Sell' ? 'Price in rupees (empty = open to offers, 0 = free)' : 'Most you will pay, in rupees (optional)'}</Text>
          <TextInput style={styles.input} value={v.price} onChangeText={(t) => set('price', t)} keyboardType="decimal-pad" placeholder="2500" placeholderTextColor={Colors.textDisabled} />
        </>
      )}

      {v.kind === 'Sell' && (
        <>
          <Text style={styles.label}>Condition</Text>
          <View style={styles.chips}>
            {CONDITIONS.map((c) => (
              <TouchableOpacity key={c.value} style={[styles.chip, v.condition === c.value && styles.chipOn]} onPress={() => set('condition', c.value)}>
                <Text style={[styles.chipText, v.condition === c.value && styles.chipTextOn]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <Text style={styles.label}>Pictures (optional)</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
        {kept.map((id) => (
          <TouchableOpacity key={id} accessibilityLabel="Remove picture" onPress={() => setKept(kept.filter((x) => x !== id))}>
            <MediaImage id={id} size={72} />
          </TouchableOpacity>
        ))}
        {v.photos.map((p) => (
          <TouchableOpacity key={p} accessibilityLabel="Remove picture" onPress={() => set('photos', v.photos.filter((x) => x !== p))}>
            <MediaImage uri={p} size={72} />
          </TouchableOpacity>
        ))}
        {total < 4 && (
          <TouchableOpacity style={styles.addPhoto} onPress={async () => { const u = await pickPhoto(); if (u) set('photos', [...v.photos, u]); }}>
            <Text style={styles.link}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>
      {total > 0 && <Text style={styles.hint}>Tap a picture to remove it.</Text>}

      {problem && (v.title.trim() || v.price.trim()) ? <Text style={styles.hint}>{problem}</Text> : null}
      <TouchableOpacity style={[styles.submit, (!!problem || save.isPending) && { opacity: 0.5 }]} disabled={!!problem || save.isPending} onPress={() => save.mutate()}>
        {save.isPending ? <ActivityIndicator color={Colors.textOnPrimary} /> : <Text style={styles.submitText}>{editing ? 'Save changes' : 'Post'}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 60 },
  label: { ...Typography.body2, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.sm },
  hint: { ...Typography.caption, color: Colors.textSecondary },
  link: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Typography.body2, color: Colors.textPrimary },
  chipTextOn: { color: Colors.textOnPrimary, fontWeight: '700' },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, ...Typography.body1, color: Colors.textPrimary },
  addPhoto: { width: 72, height: 72, borderRadius: Radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  submit: { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  submitText: { ...Typography.body1, fontWeight: '700', color: Colors.textOnPrimary },
});
