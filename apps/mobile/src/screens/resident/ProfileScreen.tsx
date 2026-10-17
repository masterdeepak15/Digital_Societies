import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { authService } from '../../services/api/authService';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

export default function ProfileScreen() {
  const { name, email, phone, setProfileFields } = useAuthStore();
  const [nameDraft,  setNameDraft]  = useState(name ?? '');
  const [phoneDraft, setPhoneDraft] = useState(phone ?? '');
  const [saving,     setSaving]     = useState(false);

  const save = async () => {
    const newName  = nameDraft.trim();
    const newPhone = phoneDraft.trim();
    if (newName.length < 2) {
      Alert.alert('Name required', 'Enter your name (at least 2 characters).');
      return;
    }
    setSaving(true);
    try {
      if (newName !== (name ?? '')) {
        await authService.setName(newName);
        setProfileFields({ name: newName });
      }
      if (newPhone !== (phone ?? '')) {
        // Blank clears the optional phone number.
        await authService.setPhone(newPhone === '' ? null : newPhone);
        setProfileFields({ phone: newPhone === '' ? null : newPhone });
      }
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail ?? 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Email (used to sign in)</Text>
      <Text style={styles.readonly}>{email ?? '—'}</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={nameDraft} onChangeText={setNameDraft}
        autoCapitalize="words" maxLength={200} />

      <Text style={styles.label}>Mobile number (optional)</Text>
      <TextInput style={styles.input} value={phoneDraft} onChangeText={setPhoneDraft}
        keyboardType="phone-pad" placeholder="+919876543210" maxLength={20} />
      <Text style={styles.hint}>Only used for SMS alerts if your society has enabled them.</Text>

      <TouchableOpacity style={styles.btn} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  label:     { ...Typography.body2, color: Colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs },
  readonly:  { ...Typography.body1, color: Colors.textPrimary },
  input:     { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm,
               ...Typography.body1, color: Colors.textPrimary, backgroundColor: Colors.surface },
  hint:      { ...Typography.caption, color: Colors.textSecondary, marginTop: Spacing.xs },
  btn:       { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.md,
               alignItems: 'center', marginTop: Spacing.lg },
  btnText:   { ...Typography.h4, color: Colors.textOnPrimary },
});
