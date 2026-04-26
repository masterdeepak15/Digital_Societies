/**
 * VideoCallScreen — Resident ↔ Guard video callback triggered from visitor approval flow.
 *
 * Flow:
 *  1. Resident taps "Call Guard" from VisitorsScreen (passes visitorId as route param).
 *  2. This screen POSTs to /calling/visitor/:id to create the room and gets a JWT token.
 *  3. LiveKit (or Jitsi) SDK connects using the token; guard joins from their GateScreen.
 *  4. Either party can end the call; pressing End sends POST /calling/:roomId/end.
 *
 * Note: @livekit/react-native is used when available.  For now the screen handles the
 * signalling lifecycle and renders a placeholder video frame — full SDK integration
 * requires native build (expo prebuild).  The token + roomName are logged/available.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Vibration,
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

type CallState = 'connecting' | 'ringing' | 'active' | 'ended' | 'error';

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
  route?: { params?: { visitorId?: string; visitorName?: string } };
  navigation?: { goBack: () => void };
}

// ── Timer hook ─────────────────────────────────────────────────────────────
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
export default function VideoCallScreen({ route, navigation }: Props) {
  const visitorId   = route?.params?.visitorId;
  const visitorName = route?.params?.visitorName ?? 'Visitor';

  const [callState, setCallState] = useState<CallState>('connecting');
  const [room, setRoom]           = useState<CallRoomDto | null>(null);
  const [muted, setMuted]         = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const timer = useCallTimer(callState === 'active');
  const roomRef = useRef<CallRoomDto | null>(null);

  // ── Initiate call ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visitorId) {
      setError('No visitor ID provided.');
      setCallState('error');
      return;
    }

    let cancelled = false;

    const startCall = async () => {
      try {
        const data = await apiFetch<CallRoomDto>(
          `/calling/visitor/${visitorId}`,
          { method: 'POST' });

        if (cancelled) return;

        setRoom(data);
        roomRef.current = data;
        setCallState('ringing');

        // Simulate guard answering after 2-4 s in dev/demo
        // In production, guard joins via deep link / push notification.
        const delay = 2000 + Math.random() * 2000;
        setTimeout(() => {
          if (!cancelled) setCallState('active');
        }, delay);

      } catch (e: any) {
        if (!cancelled) {
          setError(e.message);
          setCallState('error');
        }
      }
    };

    startCall();
    return () => { cancelled = true; };
  }, [visitorId]);

  // ── End call ─────────────────────────────────────────────────────────────
  const handleEnd = async () => {
    Vibration.vibrate(50);
    setCallState('ended');
    const r = roomRef.current;
    if (r) {
      await apiFetch(`/calling/${r.roomId}/end`, { method: 'POST' }).catch(() => {});
    }
    setTimeout(() => navigation?.goBack(), 1500);
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderVideoPlaceholder = (label: string, icon: string, isLocal = false) => (
    <View style={[styles.videoFrame, isLocal && styles.videoFrameLocal]}>
      <Text style={styles.videoIcon}>{icon}</Text>
      <Text style={[styles.videoLabel, isLocal && styles.videoLabelSmall]}>{label}</Text>
      {cameraOff && isLocal && (
        <View style={styles.cameraOffOverlay}>
          <Text style={styles.cameraOffText}>📷 Off</Text>
        </View>
      )}
    </View>
  );

  // ── State-based renders ───────────────────────────────────────────────────
  if (callState === 'connecting') {
    return (
      <View style={styles.fullScreen}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.statusText}>Connecting…</Text>
        <Text style={styles.statusSubText}>Setting up secure call room</Text>
      </View>
    );
  }

  if (callState === 'error') {
    return (
      <View style={styles.fullScreen}>
        <Text style={styles.errorIcon}>📵</Text>
        <Text style={styles.statusText}>Call Failed</Text>
        <Text style={styles.statusSubText}>{error ?? 'Unable to connect.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => navigation?.goBack()}>
          <Text style={styles.retryBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (callState === 'ended') {
    return (
      <View style={styles.fullScreen}>
        <Text style={styles.endedIcon}>👋</Text>
        <Text style={styles.statusText}>Call Ended</Text>
        {room && <Text style={styles.statusSubText}>Duration: {timer}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Remote video — guard / gate side */}
      <View style={styles.remoteVideo}>
        {renderVideoPlaceholder(
          callState === 'ringing' ? 'Calling Gate…' : 'Guard',
          callState === 'ringing' ? '📞' : '👮'
        )}

        {/* Ringing overlay */}
        {callState === 'ringing' && (
          <View style={styles.ringingOverlay}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.ringingText}>Waiting for guard to answer…</Text>
          </View>
        )}
      </View>

      {/* Local video PiP */}
      <View style={styles.localVideoContainer}>
        {renderVideoPlaceholder('You', '🧑', true)}
      </View>

      {/* Header info */}
      <View style={styles.callHeader}>
        <Text style={styles.callTitle}>{visitorName}</Text>
        <Text style={styles.callSubtitle}>
          {callState === 'ringing' ? 'Ringing…' : timer}
        </Text>
        {room && (
          <Text style={styles.providerBadge}>{room.provider}</Text>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Mute */}
        <TouchableOpacity
          style={[styles.controlBtn, muted && styles.controlBtnActive]}
          onPress={() => setMuted(m => !m)}>
          <Text style={styles.controlIcon}>{muted ? '🔇' : '🎙️'}</Text>
          <Text style={styles.controlLabel}>{muted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>

        {/* End call */}
        <TouchableOpacity style={[styles.controlBtn, styles.endCallBtn]} onPress={handleEnd}>
          <Text style={styles.controlIcon}>📵</Text>
          <Text style={[styles.controlLabel, { color: '#fff' }]}>End</Text>
        </TouchableOpacity>

        {/* Camera */}
        <TouchableOpacity
          style={[styles.controlBtn, cameraOff && styles.controlBtnActive]}
          onPress={() => setCameraOff(c => !c)}>
          <Text style={styles.controlIcon}>{cameraOff ? '📷' : '📹'}</Text>
          <Text style={styles.controlLabel}>{cameraOff ? 'Camera' : 'Camera'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  fullScreen: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  statusText: {
    ...typography.h2,
    color: '#fff',
  },
  statusSubText: {
    ...typography.body,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorIcon:  { fontSize: 56 },
  endedIcon:  { fontSize: 56 },
  retryBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  retryBtnText: { ...typography.body, color: '#fff' },

  // Video frames
  remoteVideo: {
    flex: 1,
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoFrame: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  videoFrameLocal: { flex: 1, width: '100%' },
  videoIcon: { fontSize: 64 },
  videoLabel: { ...typography.body, color: 'rgba(255,255,255,0.75)' },
  videoLabelSmall: { fontSize: 11 },
  cameraOffOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraOffText: { ...typography.body, color: '#fff' },

  // Ringing
  ringingOverlay: {
    position: 'absolute',
    bottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  ringingText: { ...typography.body, color: '#fff' },

  // Local PiP
  localVideoContainer: {
    position: 'absolute',
    top: spacing.xl + 60,
    right: spacing.md,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0f3460',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  // Header
  callHeader: {
    position: 'absolute',
    top: spacing.xl,
    left: 0, right: 0,
    alignItems: 'center',
    gap: 4,
  },
  callTitle: {
    ...typography.h2,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  callSubtitle: {
    ...typography.body,
    color: 'rgba(255,255,255,0.8)',
    fontVariant: ['tabular-nums'],
  },
  providerBadge: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },

  // Controls
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  controlBtn: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.12)',
    minWidth: 70,
  },
  controlBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  endCallBtn: {
    backgroundColor: '#e53935',
    paddingHorizontal: spacing.xl,
  },
  controlIcon: { fontSize: 28 },
  controlLabel: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
  },
});
