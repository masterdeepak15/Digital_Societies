import { create } from 'zustand';
import { MembershipInfo } from '../services/api/authService';
import { queryClient } from '../services/queryClient';
import { useChatStore } from './chatStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultView, membershipForView, validView, type RoleView } from '../navigation/roleViews';

interface AuthState {
  isAuthenticated:  boolean;
  userId:           string | null;
  name:             string | null;
  email:            string | null;
  phone:            string | null;
  memberships:      MembershipInfo[];
  activeSocietyId:  string | null;
  activeRole:       string | null;
  activeView:       RoleView | null; // which of the person's roles they are using right now (see roleViews.ts)
  societyName:      string | null;   // display name of the active society
  flatId:           string | null;   // flat tied to the active membership
  accessToken:      string | null;   // in-memory JWT used by SignalR connections

  // Actions
  login:            (
    profile: { userId: string; name: string; email: string; phone?: string | null; memberships: MembershipInfo[] },
    accessToken: string,
  ) => void;
  setActiveSociety: (societyId: string) => void;
  setActiveView:    (view: RoleView) => void;
  restoreView:      () => Promise<void>;
  setProfileFields: (fields: { name?: string; phone?: string | null }) => void;
  logout:           () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  userId:          null,
  name:            null,
  email:           null,
  phone:           null,
  memberships:     [],
  activeSocietyId: null,
  activeRole:      null,
  activeView:      null,
  societyName:     null,
  flatId:          null,
  accessToken:     null,

  login: (profile, accessToken) => {
    const first = profile.memberships[0];
    set({
      isAuthenticated: true,
      userId:          profile.userId,
      name:            profile.name,
      email:           profile.email,
      phone:           profile.phone ?? null,
      memberships:     profile.memberships,
      activeSocietyId: first?.societyId    ?? null,
      activeRole:      first?.role         ?? null,
      activeView:      defaultView(profile.memberships, first?.societyId ?? null),
      societyName:     first?.societyName  ?? null,
      flatId:          first?.flatId       ?? null,
      accessToken,
    });
    // Come back to the view the person was last using (admin, home, gate ...).
    void get().restoreView();
  },

  setActiveSociety: (societyId) => {
    const membership = get().memberships.find((m) => m.societyId === societyId);
    set({
      activeSocietyId: societyId,
      activeRole:      membership?.role        ?? null,
      activeView:      defaultView(get().memberships, societyId),
      societyName:     membership?.societyName ?? null,
      flatId:          membership?.flatId      ?? null,
    });
    void get().restoreView();
  },

  // A person who holds several roles uses one view at a time. activeRole follows the view, so every screen
  // that asks "is this an admin?" gives the right answer for the view that is open.
  setActiveView: (view) => {
    const { memberships, activeSocietyId } = get();
    const m = membershipForView(memberships, activeSocietyId, view);
    if (!m) return;
    set({ activeView: view, activeRole: m.role, flatId: m.flatId ?? null });
    if (activeSocietyId) AsyncStorage.setItem(`ds_view_${activeSocietyId}`, view).catch(() => {});
  },

  restoreView: async () => {
    const { memberships, activeSocietyId } = get();
    if (!activeSocietyId) return;
    try {
      const saved = validView(await AsyncStorage.getItem(`ds_view_${activeSocietyId}`), memberships, activeSocietyId);
      if (saved && saved !== get().activeView) get().setActiveView(saved);
    } catch { /* keep the default view */ }
  },

  setProfileFields: (fields) =>
    set((s) => ({
      name:  fields.name !== undefined ? fields.name : s.name,
      phone: fields.phone !== undefined ? fields.phone : s.phone,
    })),

  logout: () => {
    // Cached answers belong to the signed-in person; drop them with the session.
    queryClient.clear();
    useChatStore.getState().reset();      // unsent chat messages and who-is-online belong to this person too
    set({
      isAuthenticated: false,
      userId:          null,
      name:            null,
      email:           null,
      phone:           null,
      memberships:     [],
      activeSocietyId: null,
      activeRole:      null,
      activeView:      null,
      societyName:     null,
      flatId:          null,
      accessToken:     null,
    });
  },
}));
