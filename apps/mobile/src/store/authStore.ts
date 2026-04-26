import { create } from 'zustand';
import { MembershipInfo } from '../services/api/authService';

interface AuthState {
  isAuthenticated:  boolean;
  userId:           string | null;
  name:             string | null;
  phone:            string | null;
  memberships:      MembershipInfo[];
  activeSocietyId:  string | null;
  activeRole:       string | null;
  societyName:      string | null;   // display name of the active society
  flatId:           string | null;   // flat tied to the active membership
  accessToken:      string | null;   // in-memory JWT used by SignalR connections

  // Actions
  login:            (
    profile: { userId: string; name: string; phone: string; memberships: MembershipInfo[] },
    accessToken: string,
  ) => void;
  setActiveSociety: (societyId: string) => void;
  logout:           () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  userId:          null,
  name:            null,
  phone:           null,
  memberships:     [],
  activeSocietyId: null,
  activeRole:      null,
  societyName:     null,
  flatId:          null,
  accessToken:     null,

  login: (profile, accessToken) => {
    const first = profile.memberships[0];
    set({
      isAuthenticated: true,
      userId:          profile.userId,
      name:            profile.name,
      phone:           profile.phone,
      memberships:     profile.memberships,
      activeSocietyId: first?.societyId    ?? null,
      activeRole:      first?.role         ?? null,
      societyName:     first?.societyName  ?? null,
      flatId:          first?.flatId       ?? null,
      accessToken,
    });
  },

  setActiveSociety: (societyId) => {
    const membership = get().memberships.find((m) => m.societyId === societyId);
    set({
      activeSocietyId: societyId,
      activeRole:      membership?.role        ?? null,
      societyName:     membership?.societyName ?? null,
      flatId:          membership?.flatId      ?? null,
    });
  },

  logout: () =>
    set({
      isAuthenticated: false,
      userId:          null,
      name:            null,
      phone:           null,
      memberships:     [],
      activeSocietyId: null,
      activeRole:      null,
      societyName:     null,
      flatId:          null,
      accessToken:     null,
    }),
}));
