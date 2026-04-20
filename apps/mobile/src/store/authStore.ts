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

  // Actions
  login:            (profile: { userId: string; name: string; phone: string; memberships: MembershipInfo[] }) => void;
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

  login: (profile) => {
    const firstMembership = profile.memberships[0];
    set({
      isAuthenticated: true,
      userId:          profile.userId,
      name:            profile.name,
      phone:           profile.phone,
      memberships:     profile.memberships,
      activeSocietyId: firstMembership?.societyId ?? null,
      activeRole:      firstMembership?.role ?? null,
    });
  },

  setActiveSociety: (societyId) => {
    const membership = get().memberships.find(m => m.societyId === societyId);
    set({ activeSocietyId: societyId, activeRole: membership?.role ?? null });
  },

  logout: () => set({
    isAuthenticated: false, userId: null, name: null, phone: null,
    memberships: [], activeSocietyId: null, activeRole: null,
  }),
}));
