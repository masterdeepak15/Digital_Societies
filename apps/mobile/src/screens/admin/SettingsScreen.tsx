import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '../../services/api/authService';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Card, ScreenHeader, TextField, ThemeModeSelector } from '../../ui';
import { apiFetch } from '../../utils/api';
import { errorMessage } from '../../utils/errorMessage';

interface Society { name: string; address: string; registrationNumber?: string }

/** Society name and address (admin only), the theme, and sign-out. */
export default function SettingsScreen() {
  const { colors } = useTheme();
  const { logout, activeRole } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = activeRole === 'admin';
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  // An accountant may not read or change society settings; they only get the theme and sign-out.
  const { data } = useQuery({ queryKey: ['admin', 'society'], queryFn: () => apiFetch<Society>('/settings'), enabled: isAdmin });
  useEffect(() => { if (data) { setName(data.name); setAddress(data.address); } }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch('/settings', { method: 'PATCH', body: JSON.stringify({ name: name.trim(), address: address.trim() }) });
      queryClient.invalidateQueries({ queryKey: ['admin', 'society'] });
      Alert.alert('Saved', 'Society details updated.');
    } catch (e: any) {
      Alert.alert('Could not save', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    try {
      const refresh = await (await import('expo-secure-store')).getItemAsync('ds_refresh_token');
      if (refresh) await authService.logout(refresh);
    } catch { /* the session is cleared locally regardless */ }
    await authService.clearTokens();
    logout();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.ground }} contentContainerStyle={{ padding: 22, paddingTop: 56, gap: 18 }} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Settings" />
      {isAdmin && (
        <Card>
          <View style={{ gap: 12 }}>
            <Text style={{ color: colors.text }}>Society</Text>
            <TextField label="Name" value={name} onChangeText={setName} />
            <TextField label="Address" value={address} onChangeText={setAddress} />
            <Button title={saving ? 'Saving…' : 'Save changes'} onPress={save} disabled={saving || !name.trim()} />
          </View>
        </Card>
      )}
      <Card><ThemeModeSelector /></Card>
      <View><Button title="Sign out" variant="secondary" icon="log-out" onPress={signOut} /></View>
    </ScrollView>
  );
}
