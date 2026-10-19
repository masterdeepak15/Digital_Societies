/** What each kind of alert sounds and feels like, and how a live event becomes a notification. No native code here. */

export type AlertChannel = 'visitors' | 'emergency' | 'chat' | 'general';

export interface ChannelSpec {
  id: AlertChannel;
  name: string;
  description: string;
  /** Android importance: 5 = MAX (rings and pops up), 4 = HIGH, 3 = DEFAULT. */
  importance: 3 | 4 | 5;
  /** Milliseconds: wait, buzz, wait, buzz ... A visitor at the gate must be noticed even in a pocket. */
  vibration: number[];
  /** A custom ring bundled with the app, or null for the phone's default notification sound. */
  sound: 'alert.wav' | null;
}

export const CHANNELS: Record<AlertChannel, ChannelSpec> = {
  visitors: {
    id: 'visitors', name: 'Visitors at the gate', description: 'Rings and vibrates when someone is waiting for your approval.',
    importance: 5, vibration: [0, 800, 400, 800, 400, 800, 400, 800], sound: 'alert.wav',
  },
  emergency: {
    id: 'emergency', name: 'Emergency alerts', description: 'SOS and emergency notices from your society.',
    importance: 5, vibration: [0, 1000, 300, 1000, 300, 1000, 300, 1000, 300, 1000], sound: 'alert.wav',
  },
  chat: {
    id: 'chat', name: 'Chat messages', description: 'Messages from your neighbours.',
    importance: 4, vibration: [0, 250, 150, 250], sound: null,
  },
  general: {
    id: 'general', name: 'Society updates', description: 'Notices, bills and everything else.',
    importance: 3, vibration: [0, 250], sound: null,
  },
};

export interface LiveAlert { channel: AlertChannel; title: string; body: string; data: Record<string, string> }

interface VisitorPayload { visitorId?: string; name?: string; purpose?: string }

/** A guard added a visitor for your flat: "Ramesh is at the gate (delivery)". */
export function visitorAlert(p: VisitorPayload | null | undefined): LiveAlert {
  const name = p?.name?.trim() || 'A visitor';
  const purpose = p?.purpose?.trim();
  return {
    channel: 'visitors',
    title: `${name} is at the gate`,
    body: purpose ? `${purpose}. Open the app to approve or deny.` : 'Open the app to approve or deny.',
    data: { type: 'visitor', ...(p?.visitorId ? { visitorId: p.visitorId } : {}) },
  };
}

export function emergencyAlert(p: { title?: string; message?: string; body?: string } | null | undefined): LiveAlert {
  return {
    channel: 'emergency',
    title: p?.title?.trim() || 'Emergency alert',
    body: (p?.message ?? p?.body ?? '').trim() || 'Open the app for details.',
    data: { type: 'emergency' },
  };
}

export function chatAlert(m: { senderName: string; kind: string; body: string; conversationId: string }, conversationTitle: string | null): LiveAlert {
  const preview = m.kind === 'Image' ? (m.body ? `📷 ${m.body}` : '📷 Photo') : m.body;
  const group = !!conversationTitle && conversationTitle !== m.senderName;
  return {
    channel: 'chat',
    title: conversationTitle || m.senderName,
    body: group ? `${m.senderName}: ${preview}` : preview,
    data: { type: 'chat', conversationId: m.conversationId },
  };
}

/** The app id the push service needs. A placeholder means push is not set up yet, so registration is skipped quietly. */
export function usablePushProjectId(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  const t = id.trim();
  return t.length > 0 && !t.startsWith('replace-with') ? t : null;
}
