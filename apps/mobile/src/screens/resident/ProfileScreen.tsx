import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ViewSwitcher } from '../../ui/ViewSwitcher';
import { Linking, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { dialable, fetchOffice, officeAddress } from '../../services/settings/societyRules';
import { authService } from '../../services/api/authService';
import { useAuthStore } from '../../store/authStore';
import { getServerOrigin } from '../../config/serverConfig';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Card, ScreenHeader, TextField, ThemeModeSelector } from '../../ui';

export default function ProfileScreen() {
  const { colors, fonts } = useTheme();
  const { name, email, phone, setProfileFields, logout } = useAuthStore();
  const [nameDraft,  setNameDraft]  = useState(name ?? '');
  const [phoneDraft, setPhoneDraft] = useState(phone ?? '');
  const [saving,     setSaving]     = useState(false);
  const [host,       setHost]       = useState<string>('');

  React.useEffect(() => {
    getServerOrigin().then((o) => setHost(o ? o.replace(/^https:\/\//, '') : 'Not set'));
  }, []);

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
      Alert.alert('Could not save', e.response?.data?.detail ?? 'Please try again.');
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
      <ScreenHeader title="Me" subtitle={email ?? undefined} />

      <ViewSwitcher />

      <SocietyOfficeCard />

      <Card style={{ gap: 14 }}>
        <TextField label="Name" value={nameDraft} onChangeText={setNameDraft} autoCapitalize="words" maxLength={200} />
        <TextField label="Mobile number (optional)" value={phoneDraft} onChangeText={setPhoneDraft}
          keyboardType="phone-pad" placeholder="+919876543210" maxLength={20} />
        <Text style={{ color: colors.muted, fontFamily: fonts.regular, fontSize: 13 }}>
          Only used for SMS alerts if your society has turned them on.
        </Text>
        <Button title="Save changes" onPress={save} loading={saving} />
      </Card>

      <Card style={{ gap: 10 }}>
        <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 15 }}>Appearance</Text>
        <ThemeModeSelector />
      </Card>

      <Card style={{ gap: 4 }}>
        <Text style={{ color: colors.muted, fontFamily: fonts.semibold, fontSize: 13 }}>Server</Text>
        <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 15 }}>{host}</Text>
        <Text style={{ color: colors.muted, fontFamily: fonts.regular, fontSize: 13 }}>
          To use a different server, sign out and change it on the sign-in screen.
        </Text>
      </Card>

      <View><Button title="Sign out" variant="secondary" icon="log-out" onPress={signOut} /></View>
    </ScrollView>
  );
}

/** How to reach the society's office: the contact details its admin saved in Settings. Hidden until there is something to show. */
function SocietyOfficeCard() {
  const { colors, fonts } = useTheme();
  const { data } = useQuery({ queryKey: ['society-office'], queryFn: fetchOffice, staleTime: 10 * 60_000 });
  if (!data) return null;
  const address = officeAddress(data);
  if (!data.name && !address && !data.contactPhone && !data.contactEmail) return null;
  const link = (label: string, url: string) => (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={() => Linking.openURL(url).catch(() => {})} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ color: colors.primary, fontFamily: fonts.bold, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
  return (
    <Card style={{ gap: 4 }}>
      <Text style={{ color: colors.muted, fontFamily: fonts.semibold, fontSize: 13 }}>Society office</Text>
      {!!data.name && <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 16 }}>{data.name}</Text>}
      {!!address && <Text style={{ color: colors.muted, fontFamily: fonts.regular, fontSize: 14 }}>{address}</Text>}
      {!!data.contactPhone && link(data.contactPhone, 'tel:' + dialable(data.contactPhone))}
      {!!data.contactEmail && link(data.contactEmail, 'mailto:' + data.contactEmail)}
    </Card>
  );
}
