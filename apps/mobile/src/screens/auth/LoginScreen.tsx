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

export default function LoginScreen() {
  const { login } = useAuthStore();
  const [phone,      setPhone]      = useState('');
  const [otp,        setOtp]        = useState('');
  const [otpSent,    setOtpSent]    = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [masked,     setMasked]     = useState('');
  const [countdown,  setCountdown]  = useState(0);

  const handleSendOtp = async () => {
    if (phone.replace(/\D/g, '').length < 10) {
      Alert.alert('Invalid number', 'Enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await authService.sendOtp({ phone: `+91${phone.replace(/\D/g, '')}` });
      setMasked(data.maskedPhone);
      setOtpSent(true);
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
      await authService.saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      login(data.profile, data.accessToken);   // populate Zustand store (sets isAuthenticated)
      if (data.profile.memberships.length > 0)
        await authService.setActiveSociety(data.profile.memberships[0].societyId);
      router.replace('/(app)');
    } catch (e: any) {
      Alert.alert('Incorrect OTP', e.response?.data?.detail ?? 'Verification failed.');
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

        {!otpSent ? (
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
        ) : (
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
              onPress={() => { setOtpSent(false); setOtp(''); }}>
              <Text style={[styles.resend, countdown > 0 && styles.resendDisabled]}>
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.primary, justifyContent: 'center', padding: Spacing.lg },
  card:       { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.xl },
  brand:      { ...Typography.h1, color: Colors.primary, textAlign: 'center', marginBottom: Spacing.xs },
  subtitle:   { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl },
  label:      { ...Typography.body2, color: Colors.textSecondary, marginBottom: Spacing.xs },
  phoneRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  prefix:     { ...Typography.body1, color: Colors.textPrimary, marginRight: Spacing.xs, paddingVertical: Spacing.sm },
  input:      { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
                padding: Spacing.sm, ...Typography.body1, color: Colors.textPrimary,
                backgroundColor: Colors.surface },
  otpInput:   { letterSpacing: 8, fontSize: 24, fontWeight: '700', color: Colors.textPrimary,
                backgroundColor: Colors.surface, marginBottom: Spacing.md },
  btn:        { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.md,
                alignItems: 'center', marginTop: Spacing.sm },
  btnText:    { ...Typography.h4, color: Colors.textOnPrimary },
  resend:     { textAlign: 'center', marginTop: Spacing.md, color: Colors.primary, ...Typography.body2 },
  resendDisabled: { color: Colors.textDisabled },
});
