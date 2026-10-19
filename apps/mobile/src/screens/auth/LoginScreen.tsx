import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { authService, AuthTokenResponse } from '../../services/api/authService';
import { useAuthStore } from '../../store/authStore';
import { normalizeEmail, isValidEmail } from '../../utils/email';
import { getServerOrigin } from '../../config/serverConfig';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Icon, TextField } from '../../ui';
import { ServerSheet } from '../../ui/ServerSheet';

// Login flow: email → code → (TOTP if 2FA enabled) → (name, first login only) → app
type LoginStep = 'email' | 'otp' | 'totp' | 'name';

const RESEND_SECONDS = 60;

const TITLES: Record<LoginStep, { title: string; subtitle: string }> = {
  email: { title: 'Sign in',               subtitle: 'We email you a 6-digit code. There is no password to remember.' },
  otp:   { title: 'Enter your code',       subtitle: 'Check your inbox. The code is valid for 10 minutes.' },
  totp:  { title: 'Two-step verification', subtitle: 'Open your authenticator app and enter the current code.' },
  name:  { title: 'Welcome',               subtitle: 'Tell us what to call you. You can change it later in your profile.' },
};

export default function LoginScreen() {
  const { login, setProfileFields } = useAuthStore();
  const { colors, fonts, radius, scheme } = useTheme();

  const [step,          setStep]          = useState<LoginStep>('email');
  const [email,         setEmail]         = useState('');
  const [otp,           setOtp]           = useState('');
  const [totp,          setTotp]          = useState('');
  const [name,          setName]          = useState('');
  const [loading,       setLoading]       = useState(false);
  const [masked,        setMasked]        = useState('');
  const [countdown,     setCountdown]     = useState(0);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [origin,        setOrigin]        = useState<string | null | undefined>(undefined); // undefined = still loading
  const [sheetOpen,     setSheetOpen]     = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  // Which server are we signing in to? With none configured the sheet opens by itself.
  useEffect(() => {
    getServerOrigin().then((o) => {
      setOrigin(o);
      if (!o) setSheetOpen(true);
    });
  }, []);

  const startCountdown = (seconds: number) => {
    if (timer.current) clearInterval(timer.current);
    setCountdown(seconds);
    timer.current = setInterval(() => {
      setCountdown((prev: number) => {
        if (prev <= 1) {
          if (timer.current) clearInterval(timer.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Used for the first send and for "Resend code".
  const sendCode = async () => {
    const address = normalizeEmail(email);
    if (!isValidEmail(address)) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await authService.sendOtp({ email: address });
      setEmail(address);
      setMasked(data.maskedEmail);
      setOtp('');
      setStep('otp');
      startCountdown(RESEND_SECONDS);
    } catch (e: any) {
      // Rate limited: show the server message and keep the resend lock on.
      if (e.response?.status === 429) startCountdown(RESEND_SECONDS);
      Alert.alert('Could not send the code', e.response?.data?.detail ?? 'Check the server address and try again.');
    } finally {
      setLoading(false);
    }
  };

  const completeLogin = async (data: AuthTokenResponse, isNewUser: boolean) => {
    await authService.saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    login(data.profile, data.accessToken);
    if (data.profile.memberships.length > 0)
      await authService.setActiveSociety(data.profile.memberships[0].societyId);
    if (isNewUser) {
      setName('');
      setStep('name');
      return;
    }
    router.replace('/(app)');
  };

  const handleVerify = async () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid code', 'Enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await authService.verifyOtp({ email, otp });

      // 2FA gate: backend says we need a second factor before issuing tokens
      if (data.requiresTwoFactor && data.pendingUserId) {
        setPendingUserId(data.pendingUserId);
        setTotp('');
        setStep('totp');
        return;
      }

      await completeLogin(data, data.isNewUser);
    } catch (e: any) {
      Alert.alert('Incorrect code', e.response?.data?.detail ?? 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTotp = async () => {
    if (totp.length !== 6 || !/^\d{6}$/.test(totp)) {
      Alert.alert('Invalid code', 'Enter the 6-digit code from your authenticator app.');
      return;
    }
    if (!pendingUserId) return;
    setLoading(true);
    try {
      const { data } = await authService.verify2Fa({ pendingUserId, totpCode: totp });
      await completeLogin(data, false);
    } catch (e: any) {
      Alert.alert('Incorrect code', e.response?.data?.detail ?? 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      Alert.alert('Name required', 'Enter your name (at least 2 characters).');
      return;
    }
    setLoading(true);
    try {
      await authService.setName(trimmed);
      setProfileFields({ name: trimmed });
      router.replace('/(app)');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail ?? 'Could not save your name.');
    } finally {
      setLoading(false);
    }
  };

  const onSaved = useCallback((o: string) => {
    setOrigin(o);
    setStep('email');
  }, []);

  const configured = !!origin;
  const host = origin ? origin.replace(/^https:\/\//, '') : 'Not set';
  // Light: navy band with white text. Dark: the band is the raised surface.
  const bandBg = scheme === 'light' ? colors.primary : colors.surface;
  const bandFg = scheme === 'light' ? colors.onPrimary : colors.text;
  const bandSub = scheme === 'light' ? '#B9C6DB' : colors.muted;
  const { title, subtitle } = TITLES[step];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.ground }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ backgroundColor: bandBg, paddingTop: 56, paddingHorizontal: 28, paddingBottom: 32, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Image source={require('../../../assets/icon.png')} accessibilityLabel="Digital Societies" style={{ width: 40, height: 40, borderRadius: 10 }} />
              <Text style={{ color: bandFg, fontFamily: fonts.extrabold, fontSize: 17 }}>Digital Societies</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Server address and appearance"
              onPress={() => setSheetOpen(true)}
              style={{ width: 44, height: 44, borderRadius: radius.control, borderWidth: 1, borderColor: scheme === 'light' ? '#2B4170' : colors.line,
                backgroundColor: scheme === 'light' ? '#1E3157' : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="globe" size={20} color={bandFg} />
            </Pressable>
          </View>
          <Text accessibilityRole="header" style={{ color: bandFg, fontFamily: fonts.extrabold, fontSize: 30, marginTop: 40 }}>{title}</Text>
          <Text style={{ color: bandSub, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, marginTop: 6 }}>{subtitle}</Text>
        </View>

        <View style={{ padding: 28, gap: 16 }}>
          {step === 'email' && (
            <>
              <TextField
                label="Email address"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                maxLength={250}
                returnKeyType="done"
                onSubmitEditing={sendCode}
                editable={configured}
              />
              <Button title="Send code" onPress={sendCode} loading={loading} disabled={!configured} />
              {!configured && origin !== undefined ? (
                <Text style={{ color: colors.muted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 }}>
                  Set your society's server address first, using the globe button above.
                </Text>
              ) : (
                <Text style={{ color: colors.muted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 }}>
                  Your phone number is optional and only used for SMS alerts if your society turns them on.
                </Text>
              )}
            </>
          )}

          {step === 'otp' && (
            <>
              <Text style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 14 }}>Sent to {masked}</Text>
              <TextField
                label="6-digit code"
                value={otp}
                onChangeText={setOtp}
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                style={{ letterSpacing: 6, fontSize: 22, fontFamily: fonts.bold }}
              />
              <Button title="Verify and sign in" onPress={handleVerify} loading={loading} />
              <Button
                title={countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                variant="secondary"
                onPress={sendCode}
                disabled={countdown > 0 || loading}
              />
              <Button title="Change email" variant="secondary" onPress={() => { setStep('email'); setOtp(''); }} />
            </>
          )}

          {step === 'totp' && (
            <>
              <TextField
                label="Authenticator code"
                value={totp}
                onChangeText={setTotp}
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                style={{ letterSpacing: 6, fontSize: 22, fontFamily: fonts.bold }}
              />
              <Button title="Verify code" onPress={handleVerifyTotp} loading={loading} />
              <Button title="Start over" variant="secondary" onPress={() => { setStep('email'); setPendingUserId(null); setTotp(''); }} />
            </>
          )}

          {step === 'name' && (
            <>
              <TextField
                label="Your name"
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                autoCapitalize="words"
                maxLength={200}
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
                autoFocus
              />
              <Button title="Continue" onPress={handleSaveName} loading={loading} />
              <Button title="Skip for now" variant="secondary" onPress={() => router.replace('/(app)')} />
            </>
          )}
        </View>

        <View style={{ marginTop: 'auto', paddingHorizontal: 28, paddingBottom: 32 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Server ${host}. Change`}
            onPress={() => setSheetOpen(true)}
            style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16,
              backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.control }}>
            <Icon name="server" size={20} color={colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 12 }}>Server</Text>
              <Text numberOfLines={1} style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 14 }}>{host}</Text>
            </View>
            <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 13 }}>Change</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ServerSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onSaved={onSaved} />
    </KeyboardAvoidingView>
  );
}
