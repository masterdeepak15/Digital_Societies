import {
  appendMessage, applyReceipt, betterStatus, dayLabel, filterConversations, listTime, mergeMessages, pendingToMessage, presenceText,
  tickFor, toRows, totalUnread, type ChatMessage, type Conversation,
} from './chatModel';

const NOW = new Date(2026, 9, 19, 15, 0);          // 19 Oct 2026, 3 pm
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString();

const msg = (o: Partial<ChatMessage>): ChatMessage => ({
  id: 'm1', conversationId: 'c', senderUserId: 'a', senderName: 'Asha', clientId: 'k1', kind: 'Text', body: 'hi', mediaId: null,
  sentAt: at(19, 10), isMine: false, status: 'Received', ...o,
});

describe('ticks', () => {
  it('shows one tick sent, two delivered, two blue read', () => {
    expect(tickFor('Sent')).toEqual({ text: '✓', read: false });
    expect(tickFor('Delivered')).toEqual({ text: '✓✓', read: false });
    expect(tickFor('Read')).toEqual({ text: '✓✓', read: true });
    expect(tickFor('Sending').text).toBe('🕓');
    expect(tickFor('Failed').text).toBe('⚠');
    expect(tickFor('Received').text).toBe('');
  });
  it('never moves a tick backwards', () => {
    expect(betterStatus('Read', 'Delivered')).toBe('Read');
    expect(betterStatus('Sent', 'Read')).toBe('Read');
    expect(betterStatus('Sending', 'Sent')).toBe('Sent');
  });
});

describe('times', () => {
  it('words a day and a list time for people', () => {
    expect(dayLabel(at(19, 9), NOW)).toBe('Today');
    expect(dayLabel(at(18, 9), NOW)).toBe('Yesterday');
    expect(dayLabel(at(10, 9), NOW)).toMatch(/10 October/);
    expect(listTime(at(19, 9, 5), NOW)).toMatch(/9:05/);
    expect(listTime(at(18, 23), NOW)).toBe('Yesterday');
    expect(listTime(at(2, 9), NOW)).toMatch(/02 Oct/);
    expect(listTime(null, NOW)).toBe('');
  });
  it('says online, or when they were last seen', () => {
    expect(presenceText(true, null, NOW)).toBe('online');
    expect(presenceText(false, at(19, 14, 40), NOW)).toMatch(/^last seen today at 2:40/);
    expect(presenceText(false, at(18, 21, 5), NOW)).toMatch(/^last seen yesterday at 9:05/);
    expect(presenceText(false, at(2, 9), NOW)).toMatch(/^last seen 2 Oct/);
    expect(presenceText(false, null, NOW)).toBe('');
  });
});

describe('toRows', () => {
  it('adds a separator for each new day and names the sender once per run in a group', () => {
    const rows = toRows([
      msg({ id: '1', clientId: 'a1', sentAt: at(18, 9) }),
      msg({ id: '2', clientId: 'a2', sentAt: at(19, 9) }),
      msg({ id: '3', clientId: 'a3', sentAt: at(19, 10) }),
      msg({ id: '4', clientId: 'b1', sentAt: at(19, 11), senderUserId: 'b', senderName: 'Bhaskar' }),
      msg({ id: '5', clientId: 'm1', sentAt: at(19, 12), isMine: true, senderUserId: 'me' }),
    ], true, NOW);
    expect(rows.map((r) => (r.type === 'day' ? r.label : r.message.id))).toEqual(['Yesterday', '1', 'Today', '2', '3', '4', '5']);
    const shown = rows.filter((r) => r.type === 'message').map((r: any) => r.showSender);
    expect(shown).toEqual([true, true, false, true, false]);       // never for your own message
  });
  it('never names the sender in a one-to-one chat', () => {
    const rows = toRows([msg({})], false, NOW);
    expect((rows[1] as any).showSender).toBe(false);
  });
});

describe('merging with messages not sent yet', () => {
  it('shows pending messages after the server ones and drops them once the server has them', () => {
    const server = [msg({ id: '1', clientId: 'a', sentAt: at(19, 9), isMine: true, status: 'Sent' })];
    const p = pendingToMessage({ clientId: 'b', conversationId: 'c', kind: 'Text', body: 'later', localUri: null, mediaId: null, createdAt: at(19, 10), failed: false }, 'me');
    expect(mergeMessages(server, [p]).map((m) => m.clientId)).toEqual(['a', 'b']);
    const confirmed = [...server, msg({ id: '2', clientId: 'b', sentAt: at(19, 10), isMine: true, status: 'Sent' })];
    expect(mergeMessages(confirmed, [p])).toHaveLength(2);
    expect(p.status).toBe('Sending');
    expect(pendingToMessage({ clientId: 'x', conversationId: 'c', kind: 'Text', body: '', localUri: null, mediaId: null, createdAt: at(19, 10), failed: true }, 'me').status).toBe('Failed');
  });
});

describe('live updates', () => {
  it('appends a new message in order and ignores a duplicate', () => {
    const base = [msg({ id: '1', clientId: 'a', sentAt: at(19, 9) })];
    const next = appendMessage(base, msg({ id: '2', clientId: 'b', sentAt: at(19, 10) }));
    expect(next.map((m) => m.id)).toEqual(['1', '2']);
    expect(appendMessage(next, msg({ id: '2', clientId: 'b', sentAt: at(19, 10) }))).toHaveLength(2);
  });
  it('turns your pending copy into the confirmed one without losing a tick', () => {
    const mine = msg({ id: 'pending-k', clientId: 'k', isMine: true, status: 'Delivered' });
    const out = appendMessage([mine], msg({ id: 'real', clientId: 'k', isMine: false, status: 'Sent' }));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'real', isMine: true, status: 'Delivered' });
  });
  it('moves your ticks when the other person receives or reads, in a one-to-one chat', () => {
    const list = [msg({ id: '1', clientId: 'a', isMine: true, status: 'Sent', sentAt: at(19, 9) }), msg({ id: '2', clientId: 'b', isMine: true, status: 'Sent', sentAt: at(19, 12) })];
    const read = applyReceipt(list, 'read', at(19, 10), false);
    expect(read.map((m) => m.status)).toEqual(['Read', 'Sent']);
    expect(applyReceipt(read, 'delivered', at(19, 13), false).map((m) => m.status)).toEqual(['Read', 'Delivered']);
  });
  it('leaves group ticks to the server', () => {
    const list = [msg({ isMine: true, status: 'Sent' })];
    expect(applyReceipt(list, 'read', at(19, 23), true)).toEqual(list);
  });
});

describe('the chat list', () => {
  const c = (o: Partial<Conversation>): Conversation => ({
    id: 'c', type: 'Direct', title: 'Bhaskar Rao', otherUserId: 'b', lastMessagePreview: 'See you at 6', lastMessageAt: at(19, 9), lastMessageMine: false,
    unreadCount: 0, isOnline: false, lastSeenAt: null, memberCount: 2, isAdmin: false, ...o,
  });
  it('counts chats with something unread', () => {
    expect(totalUnread([c({ unreadCount: 3 }), c({ unreadCount: 1 }), c({})])).toBe(2);
  });
  it('searches by name or last message', () => {
    const list = [c({}), c({ id: 'd', title: 'Wing A', lastMessagePreview: 'Water cut tomorrow' })];
    expect(filterConversations(list, 'rao').map((x) => x.id)).toEqual(['c']);
    expect(filterConversations(list, 'water').map((x) => x.id)).toEqual(['d']);
    expect(filterConversations(list, '  ')).toHaveLength(2);
  });
});
