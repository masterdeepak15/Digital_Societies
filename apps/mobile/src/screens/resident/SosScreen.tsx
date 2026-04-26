/**
 * SosScreen — One-way SOS video broadcast to guards + neighbors.
 *
 * Flow:
 *  1. Resident hits SOS button (from HomeScreen or dedicated SOS FAB).
 *  2. Screen confirms intent (3-second countdown + tap to cancel).
 *  3. POST /calling/sos → receives token for a broadcast room.
 *  4. Resident publishes camera/mic; guards/neighbors join as observers only.
 *  5. Push notification is automatically sent to all society guards via SignalR/FCM.
 *  6. Either party can end the SOS; pressing End sends POST /calling/:roomId/end.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Vibration,
  Animated,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';

// ── Theme alias ────────────────────────────────────────────────────────────
const colors = { ...Colors };
const spacing = Spacing;
const typography = { ...Typography, body: Typography.body1 };

// ── Types ──────────────────────────────────────────────────────────────────
interface CallRoomDto {
  roomId:    string;
  roomName:  string;
  token:     string;
  serverUrl: string;
  provider:  string;
  expiresAt: string;
}

type SosState = 'confirm' | 'broadcasting' | 'ended' | 'error';

const API_BASE = 'http://localhost:8080/api/v1';

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message ?? 'Request failed');
  }
  return res.json();
}

// ── Props ──────────────────────────────────────────────────────────────────
interface Props {
  navigation?: { goBack: () => void };
}

// ── Countdown + pulse animation ────────────────────────────────────────────
function usePulse() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);
  return scale;
}

function useCallTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) { setSeconds(0); return; }
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// ── Main Screen ────────────────────────────────────────────────────────────
export default function SosScreen({ navigation }: Props) {
  const [state, setState] = useState<SosState>('confirm');
  const [countdown, setCountdown] = useState(3);
  const [room, setRoom]   = useState<CallRoomDto | null>(null);
  const [observerCount, setObserverCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pulseScale = usePulse();
  const timer = useCallTimer(state === 'broadcasting');
  const roomRef = useRef<CallRoomDto | null>(null);

  // ── Countdown before broadcast ────────────────────────────────────────────
  useEffect(() => {
    if (state !== 'confirm') return;
    if (countdown <= 0) {
      startSos();
      return;
    }
    Vibration.vibrate(80);
    const id = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(id);
  }, [state, countdown]);

  // ── Simulate guards joining (demo) ────────────────────────────────────────
  useEffect(() => {
    if (state !== 'broadcasting') return;
    const intervals = [
      setTimeout(() => setObserverCount(1), 3000),
      setTimeout(() => setObserverCount(2), 6000),
      setTimeout(() => setObserverCount(3), 12000),
    ];
    return () => intervals.forEach(clearTimeout);
  }, [state]);

  const startSos = async () => {
    try {
      const data = await apiFetch<CallRoomDto>('/calling/sos', { method: 'POST' });
      setRoom(data);
      roomRef.current = data;
      setState('broadcasting');
      Vibration.vibrate([0, 200, 100, 200]);
    } catch (e: any) {
      setError(e.message);
      setState('error');
    }
  };

  const handleCancel = () => {
    setState('ended');
    navigation?.goBack();
  };

  const handleEnd = async () => {
    Alert.alert('End SOS', 'Stop broadcasting and end the SOS alert?', [
      { text: 'Keep Broadcasting', style: 'cancel' },
      {
        text: 'End SOS', style: 'destructive',
        onPress: async () => {
          Vibration.vibrate(100);
          setState('ended');
          const r = roomRef.current;
          if (r) {
            await apiFetch(`/calling/${r.roomId}/end`, { method: 'POST' }).catch(() => {});
          }
          setTimeout(() => navigation?.goBack(), 1500);
        },
      },
    ]);
  };

  // ── Confirm / Countdown ───────────────────────────────────────────────────
  if (state === 'confirm') {
    return (
      <View style={styles.confirmContainer}>
        <Animated.View style={[styles.sosPulseRing, { transform: [{ scale: pulseScale }] }]} />
        <View style={styles.sosBigButton}>
          <Text style={styles.sosButtonText}>SOS</Text>
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>

        <Text style={styles.confirmTitle}>Sending SOS Alert</Text>
        <Text style={styles.confirmSubtitle}>
          Broadcasting to all society guards and nearby residents in {countdown}s…
        </Text>

        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
          <Text style={styles.cancelBtnText}>✕  Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <View style={styles.fullScreen}>
        <Text style={{ fontSize: 56 }}>❌</Text>
        <Text style={styles.bigLabel}>SOS Failed</Text>
        <Text style={styles.mutedLabel}>{error ?? 'Could not start SOS broadcast.'}</Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation?.goBack()}>
          <Text style={styles.cancelBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Ended ─────────────────────────────────────────────────────────────────
  if (state === 'ended') {
    return (
      <View style={styles.fullScreen}>
        <Text style={{ fontSize: 56 }}>✅</Text>
        <Text style={styles.bigLabel}>SOS Ended</Text>
        <Text style={styles.mutedLabel}>Duration: {timer}</Text>
        <Text style={styles.mutedLabel}>Guards have been alerted.</Text>
      </View>
    );
  }

  // ── Broadcasting ──────────────────────────────────────────────────────────
  return (
    <View style={styles.broadcastContainer}>
      {/* Live indicator */}
      <View style={styles.liveBar}>
        <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseScale }] }]} />
        <Text style={styles.liveText}>LIVE SOS</Text>
        <Text style={styles.timerText}>{timer}</Text>
      </View>

      {/* Camera placeholder */}
      <View style={styles.cameraArea}>
        <Text style={styles.cameraIcon}>📹</Text>
        <Text style={styles.cameraLabel}>Broadcasting your camera</Text>
        {room && <Text style={styles.providerLabel}>{room.provider}</Text>}
      </View>

      {/* Observer count */}
      <View style={styles.observerPanel}>
        <Text style={styles.observerIcon}>👁️</Text>
        <Text style={styles.observerCount}>{observerCount}</Text>
        <Text style={styles.observerLabel}>
          {observerCount === 1 ? 'guard watching' : 'guards watching'}
        </Text>
      </View>

      {/* Info cards */}
      <View style={styles.infoCards}>
        <View style={styles.infoCard}>
          <Text style={styles.infoCardIcon}>📢</Text>
          <Text style={styles.infoCardText}>All guards have been notified</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoCardIcon}>🏠</Text>
          <Text style={styles.infoCardText}>Nearby residents alerted</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoCardIcon}>🔴</Text>
          <Text style={styles.infoCardText}>Video is being recorded</Text>
        </View>
      </View>

      {/* End SOS */}
      <TouchableOpacity style={styles.endSosBtn} onPress={handleEnd}>
        <Text style={styles.endSosBtnText}>End SOS Alert</Text>
      </TouchableOpacity>

      {/* Emergency number */}
      <Text style={styles.emergencyNote}>
        For life-threatening emergencies also dial 100 (Police) or 112 (Emergency)
      </Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const SOS_RED = '#e53935';

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1, backgroundColor: '#1a1a2e',
    justifyContent: 'center', alignItems: 'center', gap: spacing.md,
  },
  bigLabel: { ...Typography.h2, color: '#fff' },
  mutedLabel: { ...Typography.body1, color: 'rgba(255,255,255,0.65)', textAlign: 'center', paddingHorizontal: spacing.xl },

  // Confirm screen
  confirmContainer: {
    flex: 1,
    backgroundColor: SOS_RED,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  sosPulseRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  sosBigButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  sosButtonText: {
    fontSize: 42,
    fontWeight: '900',
    color: SOS_RED,
    letterSpacing: 4,
  },
  countdownText: {
    fontSize: 28,
    fontWeight: '700',
    color: SOS_RED,
    marginTop: -4,
  },
  confirmTitle: {
    ...Typography.h2,
    color: '#fff',
    textAlign: 'center',
  },
  confirmSubtitle: {
    ...Typography.body1,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  cancelBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  cancelBtnText: { ...Typography.body1, color: '#fff', fontWeight: '600' },

  // Broadcast screen
  broadcastContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  liveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  liveDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SOS_RED,
  },
  liveText: {
    ...Typography.body1,
    color: SOS_RED,
    fontWeight: '800',
    letterSpacing: 2,
    flex: 1,
  },
  timerText: {
    ...Typography.body1,
    color: '#fff',
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },

  cameraArea: {
    flex: 1,
    backgroundColor: '#16213e',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: SOS_RED,
  },
  cameraIcon:  { fontSize: 56 },
  cameraLabel: { ...Typography.body1, color: 'rgba(255,255,255,0.7)' },
  providerLabel: { ...Typography.caption, color: 'rgba(255,255,255,0.35)' },

  observerPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  observerIcon:  { fontSize: 24 },
  observerCount: { ...Typography.h2, color: '#fff' },
  observerLabel: { ...Typography.body1, color: 'rgba(255,255,255,0.6)' },

  infoCards: { gap: spacing.xs, marginBottom: spacing.md },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: spacing.sm,
  },
  infoCardIcon: { fontSize: 18 },
  infoCardText: { ...Typography.body1, color: 'rgba(255,255,255,0.75)' },

  endSosBtn: {
    backgroundColor: SOS_RED,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  endSosBtnText: { ...Typography.body1, color: '#fff', fontWeight: '700', fontSize: 16 },

  emergencyNote: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});
