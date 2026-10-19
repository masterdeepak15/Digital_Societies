/** Chat rules and wording without any screen: ticks, day separators, last seen, pending messages. */

export type MessageStatus = 'Sending' | 'Failed' | 'Sent' | 'Delivered' | 'Read' | 'Received';
export type MessageKind = 'Text' | 'Image';

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName: string;
  clientId: string;
  kind: MessageKind;
  body: string;
  mediaId: string | null;
  sentAt: string;
  isMine: boolean;
  status: MessageStatus;
}

export interface Conversation {
  id: string;
  type: 'Direct' | 'Group';
  title: string;
  otherUserId: string | null;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  lastMessageMine: boolean;
  unreadCount: number;
  isOnline: boolean;
  lastSeenAt: string | null;
  memberCount: number;
  isAdmin: boolean;
}

export interface Person { userId: string; name: string; flat: string }

/** The ticks next to a message you sent. */
export function tickFor(status: MessageStatus): { text: string; read: boolean } {
  switch (status) {
    case 'Sending': return { text: '🕓', read: false };
    case 'Failed': return { text: '⚠', read: false };
    case 'Sent': return { text: '✓', read: false };
    case 'Delivered': return { text: '✓✓', read: false };
    case 'Read': return { text: '✓✓', read: true };
    default: return { text: '', read: false };
  }
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const DAY = 24 * 60 * 60 * 1000;

const clock = (d: Date) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase().replace(' ', ' ');

/** "10:42 am" */
export const timeOf = (iso: string): string => clock(new Date(iso));

/** The label of a day separator: Today, Yesterday, then the date. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

/** The time shown in the chat list: the clock today, "Yesterday", or the short date. */
export function listTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / DAY);
  if (diff === 0) return timeOf(iso);
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/** "online", "last seen today at 3:40 pm", "last seen yesterday at 9:05 pm", "last seen 12 Oct". */
export function presenceText(online: boolean, lastSeenAt: string | null | undefined, now: Date = new Date()): string {
  if (online) return 'online';
  if (!lastSeenAt) return '';
  const d = new Date(lastSeenAt);
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / DAY);
  if (diff === 0) return `last seen today at ${clock(d)}`;
  if (diff === 1) return `last seen yesterday at ${clock(d)}`;
  return `last seen ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}

export type ChatRow =
  | { type: 'day'; key: string; label: string }
  | { type: 'message'; key: string; message: ChatMessage; showSender: boolean; firstOfRun: boolean };

/**
 * Messages (oldest first) become rows with a day separator before each new day. In a group the sender's name
 * shows above the first message of each run by the same person.
 */
export function toRows(messages: ChatMessage[], isGroup: boolean, now: Date = new Date()): ChatRow[] {
  const rows: ChatRow[] = [];
  let lastDay = '';
  let lastSender = '';
  for (const m of messages) {
    const day = new Date(m.sentAt).toDateString();
    if (day !== lastDay) { rows.push({ type: 'day', key: `day-${day}`, label: dayLabel(m.sentAt, now) }); lastDay = day; lastSender = ''; }
    const firstOfRun = m.senderUserId !== lastSender;
    rows.push({ type: 'message', key: m.clientId || m.id, message: m, showSender: isGroup && !m.isMine && firstOfRun, firstOfRun });
    lastSender = m.senderUserId;
  }
  return rows;
}

/**
 * The server's messages plus the ones still waiting to be sent from this phone. A pending message disappears as
 * soon as the server's copy (same clientId) arrives, so nothing shows twice. Always oldest first.
 */
export function mergeMessages(server: ChatMessage[], pending: ChatMessage[]): ChatMessage[] {
  const have = new Set(server.map((m) => m.clientId));
  const all = [...server, ...pending.filter((p) => !have.has(p.clientId))];
  return all.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
}

/** Applies a live message to the cached list: replaces the same clientId, ignores duplicates, keeps order. */
export function appendMessage(list: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const i = list.findIndex((m) => m.id === incoming.id || (!!incoming.clientId && m.clientId === incoming.clientId));
  if (i >= 0) { const next = list.slice(); next[i] = { ...list[i], ...incoming, isMine: list[i].isMine, status: list[i].isMine ? betterStatus(list[i].status, incoming.status) : incoming.status }; return next; }
  return [...list, incoming].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
}

const ORDER: MessageStatus[] = ['Sending', 'Failed', 'Sent', 'Delivered', 'Read'];
/** A tick never goes backwards. */
export function betterStatus(a: MessageStatus, b: MessageStatus): MessageStatus {
  const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
  if (ia < 0) return b;
  if (ib < 0) return a;
  return ib > ia ? b : a;
}

/** A receipt from someone else: your messages up to that moment are now delivered or read. (Groups are settled by the server on the next load.) */
export function applyReceipt(list: ChatMessage[], state: 'delivered' | 'read', at: string, isGroup: boolean): ChatMessage[] {
  if (isGroup) return list;                                       // needs every member's receipt; the server works it out
  const to: MessageStatus = state === 'read' ? 'Read' : 'Delivered';
  const t = new Date(at).getTime();
  return list.map((m) => (m.isMine && new Date(m.sentAt).getTime() <= t ? { ...m, status: betterStatus(m.status, to) } : m));
}

export interface PendingMessage { clientId: string; conversationId: string; kind: MessageKind; body: string; localUri: string | null; mediaId: string | null; createdAt: string; failed: boolean }

/** How a pending message looks in the list until the server confirms it. */
export function pendingToMessage(p: PendingMessage, me: string): ChatMessage {
  return {
    id: `pending-${p.clientId}`, conversationId: p.conversationId, senderUserId: me, senderName: 'You', clientId: p.clientId,
    kind: p.kind, body: p.body, mediaId: p.mediaId, sentAt: p.createdAt, isMine: true, status: p.failed ? 'Failed' : 'Sending',
  };
}

export const totalUnread = (list: Conversation[]): number => list.reduce((n, c) => n + (c.unreadCount > 0 ? 1 : 0), 0);

/** Quick emoji row above the keyboard (the phone's own emoji keyboard still works for the rest). */
export const QUICK_EMOJI = ['😀', '😂', '😍', '🙏', '👍', '🎉', '❤️', '😢', '😮', '🔥', '👏', '✅'];

/** Chats listed by who matches the search (name, last message). */
export function filterConversations(list: Conversation[], term: string): Conversation[] {
  const t = term.trim().toLowerCase();
  if (!t) return list;
  return list.filter((c) => c.title.toLowerCase().includes(t) || c.lastMessagePreview.toLowerCase().includes(t));
}
