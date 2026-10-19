import { useEffect } from 'react';
import { HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { useHubUrl } from '../../config/useHubUrl';
import { queryClient } from '../queryClient';
import { appendMessage, applyReceipt, type ChatMessage, type Conversation } from '../../screens/chat/chatModel';
import { flushOutbox, markDelivered, markRead, fetchPresence } from './chatService';
import { registerForPush, setupNotifications, showAlert } from '../notifications/notificationService';
import { chatAlert, emergencyAlert, visitorAlert } from '../notifications/notificationModel';

/**
 * The one live connection while anybody is signed in, whatever role view is open: chat messages, ticks, who is online,
 * and the alerts that must be noticed at once (a visitor at the gate rings and vibrates; so does an emergency). When the connection drops and comes back, the phone catches up (delivery receipts,
 * the chat list, anything it could not send) so offline time is invisible.
 */
export function useChatHub(): void {
  const hubUrl = useHubUrl();
  const { accessToken, activeSocietyId, userId } = useAuthStore();

  useEffect(() => { void useChatStore.getState().hydrate(); }, []);

  // Rings, vibration and (once the app has a push project) alerts while the app is closed.
  useEffect(() => {
    if (!userId) return;
    void setupNotifications().then(registerForPush);
  }, [userId, activeSocietyId]);

  useEffect(() => {
    if (!accessToken || !activeSocietyId || !hubUrl || !userId) return;

    const conn = new HubConnectionBuilder()
      .withUrl(`${hubUrl}?access_token=${accessToken}`, { headers: { 'X-Society-Id': activeSocietyId } })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 20000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();

    const catchUp = () => {
      void markDelivered();
      void flushOutbox();
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
    };

    conn.on('ChatMessage', (m: ChatMessage) => {
      const mine = { ...m, isMine: false, status: 'Received' as const };
      queryClient.setQueryData<ChatMessage[]>(['chat-messages', m.conversationId], (old) => (old ? appendMessage(old, mine) : old));
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      if (useChatStore.getState().openConversationId === m.conversationId) void markRead(m.conversationId);
      else {
        void markDelivered();
        const title = queryClient.getQueryData<Conversation[]>(['chat-conversations'])?.find((c) => c.id === m.conversationId)?.title ?? null;
        void showAlert(chatAlert(m, title));
      }
    });

    // A guard added a visitor for this flat: ring and vibrate, and refresh the waiting list.
    conn.on('VisitorPendingApproval', (p) => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      void showAlert(visitorAlert(p));
    });
    conn.on('EmergencyAlert', (p) => void showAlert(emergencyAlert(p)));

    conn.on('ChatReceipt', (r: { conversationId: string; state: 'delivered' | 'read'; at: string }) => {
      const convs = queryClient.getQueryData<Conversation[]>(['chat-conversations']);
      const isGroup = convs?.find((c) => c.id === r.conversationId)?.type === 'Group';
      if (isGroup) queryClient.invalidateQueries({ queryKey: ['chat-messages', r.conversationId] });      // the server settles group ticks
      else queryClient.setQueryData<ChatMessage[]>(['chat-messages', r.conversationId], (old) => (old ? applyReceipt(old, r.state, r.at, false) : old));
    });

    conn.on('ChatConversation', () => queryClient.invalidateQueries({ queryKey: ['chat-conversations'] }));

    conn.on('Presence', (p: { userId: string; online: boolean; lastSeenAt: string | null }) =>
      useChatStore.getState().setPresence(p.userId, { online: p.online, lastSeenAt: p.lastSeenAt }));

    conn.onreconnected(catchUp);
    conn.start().then(catchUp).catch((e) => console.warn('[Chat hub]', e));

    // The phone's own network coming back is a faster signal than SignalR's retry timer.
    const unsubscribe = NetInfo.addEventListener((s) => {
      if (s.isConnected && s.isInternetReachable !== false) {
        if (conn.state === HubConnectionState.Disconnected) conn.start().then(catchUp).catch(() => {});
        else void flushOutbox();
      }
    });

    return () => { unsubscribe(); conn.stop(); };
  }, [accessToken, activeSocietyId, hubUrl, userId]);
}

/** Looks up who is online among people shown on screen (the live "Presence" events only cover changes). */
export async function loadPresence(ids: string[]): Promise<void> {
  try { useChatStore.getState().setManyPresence(await fetchPresence(ids)); } catch { /* shown as unknown */ }
}
