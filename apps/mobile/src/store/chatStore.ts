import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PendingMessage } from '../screens/chat/chatModel';

const OUTBOX_KEY = 'ds_chat_outbox';

export interface Presence { online: boolean; lastSeenAt: string | null }

interface ChatState {
  /** Who is online, filled from the live connection and from the presence query. */
  presence: Record<string, Presence>;
  /** Messages written on this phone that the server has not confirmed yet (kept across restarts). */
  outbox: PendingMessage[];
  /** The conversation on screen, so new messages in it are marked read at once. */
  openConversationId: string | null;
  hydrated: boolean;

  setPresence: (userId: string, p: Presence) => void;
  setManyPresence: (rows: { userId: string; online: boolean; lastSeenAt: string | null }[]) => void;
  setOpenConversation: (id: string | null) => void;
  addPending: (p: PendingMessage) => void;
  updatePending: (clientId: string, patch: Partial<PendingMessage>) => void;
  removePending: (clientId: string) => void;
  hydrate: () => Promise<void>;
  reset: () => void;
}

const save = (outbox: PendingMessage[]) => { AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox)).catch(() => {}); };

export const useChatStore = create<ChatState>((set, get) => ({
  presence: {},
  outbox: [],
  openConversationId: null,
  hydrated: false,

  setPresence: (userId, p) => set((s) => ({ presence: { ...s.presence, [userId]: p } })),
  setManyPresence: (rows) => set((s) => {
    const next = { ...s.presence };
    for (const r of rows) next[r.userId] = { online: r.online, lastSeenAt: r.lastSeenAt };
    return { presence: next };
  }),
  setOpenConversation: (id) => set({ openConversationId: id }),

  addPending: (p) => { const outbox = [...get().outbox, p]; set({ outbox }); save(outbox); },
  updatePending: (clientId, patch) => { const outbox = get().outbox.map((x) => (x.clientId === clientId ? { ...x, ...patch } : x)); set({ outbox }); save(outbox); },
  removePending: (clientId) => { const outbox = get().outbox.filter((x) => x.clientId !== clientId); set({ outbox }); save(outbox); },

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(OUTBOX_KEY);
      // Anything that was mid-send when the app closed is retried, not shown as failed forever.
      const outbox: PendingMessage[] = raw ? JSON.parse(raw) : [];
      set({ outbox: [...get().outbox, ...outbox.filter((o) => !get().outbox.some((x) => x.clientId === o.clientId))], hydrated: true });
    } catch { set({ hydrated: true }); }
  },

  reset: () => { AsyncStorage.removeItem(OUTBOX_KEY).catch(() => {}); set({ presence: {}, outbox: [], openConversationId: null, hydrated: false }); },
}));
