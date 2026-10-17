import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { authService, AuthTokenResponse } from '../../services/api/authService';
import { useAuthStore } from '../../store/authStore';
import { normalizeEmail, isValidEmail } from '../../utils/email';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

// Login flow: email → code → (TOTP if 2FA enabled) → (name, first login only) → app
type LoginStep = 'email' | 'otp' | 'totp' | 'name';

const RESEND_SECONDS = 60;

export default function LoginScreen() {
  const { login, setProfileFields } = useAuthStore();
  const [step,          setStep]          = useState<LoginStep>('email');
  const [email,         setEmail]         = useState('');
  const [otp,           setOtp]           = useState('');
  const [totp,          setTotp]          = useState('');
  const [name,          setName]          = useState('');
  const [loading,       setLoading]       = useState(false);
  const [masked,        setMasked]        = useState('');
  const [countdown,     setCountdown]     = useState(0);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

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
      Alert.alert('Error', e.response?.data?.detail ?? 'Failed to send the code. Try again.');
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.brand}>🏢 Digital Societies</Text>
        <Text style={styles.subtitle}>Society ka digital OS</Text>

        {/* ── Step 1: Email ─────────────────────────────────────── */}
        {step === 'email' && (
          <>
            <Text style={styles.label}>Email</Text>
            <View style={styles.phoneRow}>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                maxLength={250}
                value={email}
                onChangeText={setEmail}
                returnKeyType="done"
                onSubmitEditing={sendCode}
              />
            </View>
            <TouchableOpacity style={styles.btn} onPress={sendCode} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Send code</Text>}
            </TouchableOpacity>
          </>
        )}

        {/* ── Step 2: emailed code ──────────────────────────────── */}
        {step === 'otp' && (
          <>
            <Text style={styles.label}>Enter the code sent to {masked}</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="• • • • • •"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              textAlign="center"
              autoFocus
            />
            <TouchableOpacity style={styles.btn} onPress={handleVerify} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Verify & Login</Text>}
            </TouchableOpacity>
            <TouchableOpacity disabled={countdown > 0 || loading} onPress={sendCode}>
              <Text style={[styles.resend, countdown > 0 && styles.resendDisabled]}>
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setStep('email'); setOtp(''); }}>
              <Text style={styles.resend}>← Change email</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Step 3: TOTP (2FA) — only shown if account has 2FA enabled ─ */}
        {step === 'totp' && (
          <>
            <View style={styles.twoFaBadge}>
              <Text style={styles.twoFaIcon}>🔐</Text>
              <View>
                <Text style={styles.twoFaTitle}>Two-Factor Authentication</Text>
                <Text style={styles.twoFaSubtitle}>Open your authenticator app</Text>
              </View>
            </View>
            <Text style={styles.label}>Authenticator code</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              value={totp}
              onChangeText={setTotp}
              textAlign="center"
              autoFocus
            />
            <Text style={styles.twoFaHint}>
              Enter the 6-digit code from Google Authenticator, Authy, or any TOTP app. Codes refresh every 30 seconds.
            </Text>
            <TouchableOpacity style={styles.btn} onPress={handleVerifyTotp} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Verify Code</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setStep('email'); setPendingUserId(null); setTotp(''); }}>
              <Text style={styles.resend}>← Start over</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Step 4: first login — ask for a name ───────────────── */}
        {step === 'name' && (
          <>
            <Text style={styles.label}>Welcome! What should we call you?</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              autoCapitalize="words"
              maxLength={200}
              value={name}
              onChangeText={setName}
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
              autoFocus
            />
            <TouchableOpacity style={styles.btn} onPress={handleSaveName} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Continue</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.replace('/(app)')}>
              <Text style={styles.resend}>Skip for now</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.primary, justifyContent: 'center', padding: Spacing.lg },
  card:         { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.xl },
  brand:        { ...Typography.h1, color: Colors.primary, textAlign: 'center', marginBottom: Spacing.xs },
  subtitle:     { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl },
  label:        { ...Typography.body2, color: Colors.textSecondary, marginBottom: Spacing.xs },
  phoneRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  prefix:       { ...Typography.body1, color: Colors.textPrimary, marginRight: Spacing.xs, paddingVertical: Spacing.sm },
  input:        { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
                  padding: Spacing.sm, ...Typography.body1, color: Colors.textPrimary,
                  backgroundColor: Colors.surface },
  otpInput:     { letterSpacing: 8, fontSize: 24, fontWeight: '700', color: Colors.textPrimary,
                  backgroundColor: Colors.surface, marginBottom: Spacing.md },
  btn:          { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.md,
                  alignItems: 'center', marginTop: Spacing.sm },
  btnText:      { ...Typography.h4, color: Colors.textOnPrimary },
  resend:       { textAlign: 'center', marginTop: Spacing.md, color: Colors.primary, ...Typography.body2 },
  resendDisabled: { color: Colors.textDisabled },
  // 2FA styles
  twoFaBadge:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
                  backgroundColor: '#f0f4ff', borderRadius: Radius.md, padding: Spacing.sm,
                  marginBottom: Spacing.md },
  twoFaIcon:    { fontSize: 28 },
  twoFaTitle:   { ...Typography.h4, color: Colors.textPrimary },
  twoFaSubtitle:{ ...Typography.body2, color: Colors.textSecondary },
  twoFaHint:    { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center',
                  marginBottom: Spacing.sm, lineHeight: 18 },
});
