import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../utils/api';
import { queryClient } from '../queryClient';
import { uploadImage } from '../media/mediaService';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { appendMessage, type ChatMessage, type Conversation, type Person, type PendingMessage } from '../../screens/chat/chatModel';

const CONVS_KEY = 'ds_chat_conversations';
const msgsKey = (id: string) => `ds_chat_messages_${id}`;

const read = async <T>(key: string): Promise<T | null> => {
  try { const raw = await AsyncStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
};
const write = (key: string, value: unknown) => { AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {}); };

/** The last thing the server told us is kept on the phone, so chats open with no connection. */
export async function fetchConversations(): Promise<Conversation[]> {
  try {
    const list = await apiFetch<Conversation[]>('/chat/conversations');
    write(CONVS_KEY, list);
    return list;
  } catch (e) {
    const cached = await read<Conversation[]>(CONVS_KEY);
    if (cached) return cached;
    throw e;
  }
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  try {
    const list = await apiFetch<ChatMessage[]>(`/chat/conversations/${conversationId}/messages?limit=50`);
    write(msgsKey(conversationId), list);
    return list;
  } catch (e) {
    const cached = await read<ChatMessage[]>(msgsKey(conversationId));
    if (cached) return cached;
    throw e;
  }
}

export async function fetchOlder(conversationId: string, before: string): Promise<ChatMessage[]> {
  return apiFetch<ChatMessage[]>(`/chat/conversations/${conversationId}/messages?limit=50&before=${encodeURIComponent(before)}`);
}

export const fetchPeople = (search: string) => apiFetch<Person[]>(`/chat/people?search=${encodeURIComponent(search)}`);

export const startDirect = (otherUserId: string) =>
  apiFetch<{ id: string }>('/chat/conversations/direct', { method: 'POST', body: JSON.stringify({ otherUserId }) });

export const createGroup = (title: string, memberUserIds: string[]) =>
  apiFetch<{ id: string }>('/chat/conversations/group', { method: 'POST', body: JSON.stringify({ title, memberUserIds }) });

export const addMembers = (id: string, userIds: string[]) =>
  apiFetch(`/chat/conversations/${id}/members`, { method: 'POST', body: JSON.stringify({ userIds }) });

export const leaveGroup = (id: string) => apiFetch(`/chat/conversations/${id}/leave`, { method: 'POST' });

export const markRead = (id: string) => apiFetch(`/chat/conversations/${id}/read`, { method: 'POST' }).catch(() => {});
export const markDelivered = () => apiFetch('/chat/delivered', { method: 'POST' }).catch(() => {});

export async function fetchPresence(ids: string[]) {
  if (ids.length === 0) return [];
  return apiFetch<{ userId: string; online: boolean; lastSeenAt: string | null }[]>(`/chat/presence?ids=${ids.join(',')}`);
}

const newId = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); });

/** Queue a message. It shows at once, and is sent now (or whenever there is a connection). */
export function queueMessage(conversationId: string, kind: 'Text' | 'Image', body: string, localUri: string | null) {
  const p: PendingMessage = { clientId: newId(), conversationId, kind, body, localUri, mediaId: null, createdAt: new Date().toISOString(), failed: false };
  useChatStore.getState().addPending(p);
  void sendPending(p.clientId);
}

const sending = new Set<string>();

/** Sends one queued message. A bad connection leaves it queued as "failed" and retrying later is safe (the server dedupes by clientId). */
export async function sendPending(clientId: string): Promise<void> {
  const store = useChatStore.getState();
  const p = store.outbox.find((x) => x.clientId === clientId);
  if (!p || sending.has(clientId)) return;
  sending.add(clientId);
  store.updatePending(clientId, { failed: false });
  try {
    let mediaId = p.mediaId;
    if (p.kind === 'Image' && !mediaId && p.localUri) {
      mediaId = (await uploadImage(p.localUri)).id;
      useChatStore.getState().updatePending(clientId, { mediaId });
    }
    const sent = await apiFetch<ChatMessage>(`/chat/conversations/${p.conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ clientId: p.clientId, kind: p.kind, body: p.body, mediaId }),
    });
    useChatStore.getState().removePending(clientId);
    queryClient.setQueryData<ChatMessage[]>(['chat-messages', p.conversationId], (old) => appendMessage(old ?? [], { ...sent, isMine: true }));
    queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
  } catch (e: any) {
    // A refused message (not in the group any more, too long) will not work on retry: drop it from the queue.
    const status = e?.response?.status;
    if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) useChatStore.getState().removePending(clientId);
    else useChatStore.getState().updatePending(clientId, { failed: true });
  } finally {
    sending.delete(clientId);
  }
}

/** Retries everything waiting, oldest first (when the connection comes back). */
export async function flushOutbox(): Promise<void> {
  const waiting = [...useChatStore.getState().outbox].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const p of waiting) await sendPending(p.clientId);
}

export const currentUserId = (): string => useAuthStore.getState().userId ?? '';
