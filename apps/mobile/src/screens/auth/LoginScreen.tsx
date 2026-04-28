import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { authService } from '../../services/api/authService';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

// Login flow: phone → OTP → (TOTP if 2FA enabled) → app
type LoginStep = 'phone' | 'otp' | 'totp';

export default function LoginScreen() {
  const { login } = useAuthStore();
  const [step,          setStep]          = useState<LoginStep>('phone');
  const [phone,         setPhone]         = useState('');
  const [otp,           setOtp]           = useState('');
  const [totp,          setTotp]          = useState('');
  const [loading,       setLoading]       = useState(false);
  const [masked,        setMasked]        = useState('');
  const [countdown,     setCountdown]     = useState(0);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const handleSendOtp = async () => {
    if (phone.replace(/\D/g, '').length < 10) {
      Alert.alert('Invalid number', 'Enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await authService.sendOtp({ phone: `+91${phone.replace(/\D/g, '')}` });
      setMasked(data.maskedPhone);
      setStep('otp');
      startCountdown(60);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail ?? 'Failed to send OTP. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Enter the 6-digit OTP.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await authService.verifyOtp({ phone: `+91${phone.replace(/\D/g, '')}`, otp });

      // 2FA gate: backend says we need a second factor before issuing tokens
      if (data.requiresTwoFactor && data.pendingUserId) {
        setPendingUserId(data.pendingUserId);
        setTotp('');
        setStep('totp');
        return;
      }

      // Standard login (no 2FA)
      await authService.saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      login(data.profile, data.accessToken);
      if (data.profile.memberships.length > 0)
        await authService.setActiveSociety(data.profile.memberships[0].societyId);
      router.replace('/(app)');
    } catch (e: any) {
      Alert.alert('Incorrect OTP', e.response?.data?.detail ?? 'Verification failed.');
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
      await authService.saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      login(data.profile, data.accessToken);
      if (data.profile.memberships.length > 0)
        await authService.setActiveSociety(data.profile.memberships[0].societyId);
      router.replace('/(app)');
    } catch (e: any) {
      Alert.alert('Incorrect code', e.response?.data?.detail ?? 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  const startCountdown = (seconds: number) => {
    setCountdown(seconds);
    const interval = setInterval(() => {
      setCountdown((prev: number) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.brand}>🏢 Digital Societies</Text>
        <Text style={styles.subtitle}>Society ka digital OS</Text>

        {/* ── Step 1: Phone number ──────────────────────────────── */}
        {step === 'phone' && (
          <>
            <Text style={styles.label}>Mobile Number</Text>
            <View style={styles.phoneRow}>
              <Text style={styles.prefix}>+91</Text>
              <TextInput
                style={styles.input}
                placeholder="98765 43210"
                keyboardType="number-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
                returnKeyType="done"
                onSubmitEditing={handleSendOtp}
              />
            </View>
            <TouchableOpacity style={styles.btn} onPress={handleSendOtp} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Send OTP</Text>}
            </TouchableOpacity>
          </>
        )}

        {/* ── Step 2: SMS OTP ───────────────────────────────────── */}
        {step === 'otp' && (
          <>
            <Text style={styles.label}>Enter OTP sent to {masked}</Text>
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
            <TouchableOpacity
              disabled={countdown > 0}
              onPress={() => { setStep('phone'); setOtp(''); }}>
              <Text style={[styles.resend, countdown > 0 && styles.resendDisabled]}>
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
              </Text>
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
            <TouchableOpacity onPress={() => { setStep('phone'); setPendingUserId(null); setTotp(''); }}>
              <Text style={styles.resend}>← Start over</Text>
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
