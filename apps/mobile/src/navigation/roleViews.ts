import type { MembershipInfo } from '../services/api/authService';

/**
 * One person can hold several roles in a society (admin and resident, or a guard who also lives there).
 * Every role has its own set of screens (a "view"); the person sees the views of ALL the roles they hold
 * and switches between them. Nothing a role is given is ever hidden.
 */
export type RoleView = 'resident' | 'admin' | 'guard' | 'staff';

/** The order the switcher shows them in. */
export const VIEW_ORDER: RoleView[] = ['resident', 'admin', 'guard', 'staff'];

export const VIEW_LABEL: Record<RoleView, string> = {
  resident: 'My home',
  admin: 'Management',
  guard: 'Gate',
  staff: 'My work',
};

export const VIEW_HINT: Record<RoleView, string> = {
  resident: 'Visitors, bills, chat, services',
  admin: 'Dashboard, members, billing, complaints',
  guard: 'Gate entry, visitor log, SOS',
  staff: 'Complaints assigned to you',
};

/** Which view a role belongs to. Residents, family and tenants share one. */
export function viewOf(role: string | null | undefined): RoleView {
  switch ((role ?? '').toLowerCase()) {
    case 'admin':
    case 'accountant': return 'admin';
    case 'guard': return 'guard';
    case 'staff': return 'staff';
    default: return 'resident';
  }
}

const inSociety = (memberships: MembershipInfo[], societyId: string | null) =>
  memberships.filter((m) => m.societyId === societyId);

/** The views this person can use in a society, in switcher order. */
export function availableViews(memberships: MembershipInfo[], societyId: string | null): RoleView[] {
  const have = new Set(inSociety(memberships, societyId).map((m) => viewOf(m.role)));
  return VIEW_ORDER.filter((v) => have.has(v));
}

/** Where a person lands when they sign in: the first role they were given. */
export function defaultView(memberships: MembershipInfo[], societyId: string | null): RoleView {
  const first = inSociety(memberships, societyId)[0];
  return viewOf(first?.role);
}

/**
 * The membership that stands for a view: for management the admin role beats accountant;
 * for the home view the one that has a flat.
 */
export function membershipForView(memberships: MembershipInfo[], societyId: string | null, view: RoleView): MembershipInfo | undefined {
  const mine = inSociety(memberships, societyId).filter((m) => viewOf(m.role) === view);
  if (view === 'admin') return mine.find((m) => m.role === 'admin') ?? mine[0];
  if (view === 'resident') return mine.find((m) => !!m.flatId) ?? mine[0];
  return mine[0];
}

/** A saved choice is used only while the person still holds that role. */
export function validView(saved: string | null | undefined, memberships: MembershipInfo[], societyId: string | null): RoleView | null {
  const v = VIEW_ORDER.find((x) => x === saved);
  return v && availableViews(memberships, societyId).includes(v) ? v : null;
}
