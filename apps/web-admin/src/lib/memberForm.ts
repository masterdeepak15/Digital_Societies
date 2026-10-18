/** Roles management can give a person, as the server names them. */
export const MEMBER_ROLES = [
  { value: 'resident',   label: 'Resident',   needsFlat: true },
  { value: 'guard',      label: 'Guard',      needsFlat: false },
  { value: 'staff',      label: 'Staff',      needsFlat: false },
  { value: 'accountant', label: 'Accountant', needsFlat: false },
  { value: 'admin',      label: 'Admin',      needsFlat: false },
] as const

export const RELATIONSHIPS = [
  { value: 'owner',  label: 'Owner' },
  { value: 'tenant', label: 'Tenant' },
  { value: 'family', label: 'Family member' },
] as const

export const roleLabel = (role: string) => MEMBER_ROLES.find(r => r.value === role)?.label ?? role

export interface MemberFormValues {
  name: string
  email: string
  phone: string
  role: string
  flatId: string
  relationship: string
}

export const EMPTY_MEMBER_FORM: MemberFormValues = {
  name: '', email: '', phone: '', role: 'resident', flatId: '', relationship: 'owner',
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Returns the first problem in plain words, or null when the form is fine to send. */
export function memberFormError(v: MemberFormValues): string | null {
  if (v.name.trim().length < 2) return 'Enter the person’s full name.'
  if (!EMAIL.test(v.email.trim())) return 'Enter a valid email address. They sign in with it.'
  const phone = v.phone.replace(/[\s-]/g, '')
  if (phone && !/^\+?[0-9]{10,13}$/.test(phone)) return 'Enter a valid phone number, or leave it empty.'
  const role = MEMBER_ROLES.find(r => r.value === v.role)
  if (!role) return 'Choose a role.'
  if (role.needsFlat && !v.flatId) return 'Choose the flat this resident lives in.'
  return null
}

export function toMemberPayload(v: MemberFormValues) {
  const needsFlat = MEMBER_ROLES.find(r => r.value === v.role)?.needsFlat ?? false
  return {
    email: v.email.trim(),
    name: v.name.trim(),
    role: v.role,
    phone: v.phone.replace(/[\s-]/g, '') || null,
    memberType: needsFlat ? v.relationship : null,
    flatId: needsFlat ? v.flatId : null,
  }
}

/** "A-807" for a flat whose number already carries its wing, "A-101" for wing A + 101, "—" for none. */
export function flatText(wing?: string | null, number?: string | null): string {
  if (!number) return '—'
  if (!wing || number.toUpperCase().startsWith(`${wing.toUpperCase()}-`)) return number
  return `${wing}-${number}`
}

/** Flat ids and labels from the server, in the order a person expects (A-2 before A-10). */
export function sortedFlats(labels: Record<string, string>): { id: string; label: string }[] {
  return Object.entries(labels)
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
}

export interface MemberRow {
  userId: string
  name: string
  email?: string
  phone?: string | null
  role: string
  memberType?: string
  flatNumber?: string
  wing?: string
  flatId?: string | null
  joinedAt?: string
  membershipId: string
}

export interface PersonRole {
  membershipId: string
  role: string
  flatId?: string | null
  flatText: string
  memberType?: string
  /** An admin role can never be removed or changed to another role. */
  isProtected: boolean
}

export interface Person {
  userId: string
  name: string
  email?: string
  phone?: string | null
  joinedAt?: string
  roles: PersonRole[]
}

const ROLE_ORDER = ['admin', 'accountant', 'resident', 'guard', 'staff']

/** One entry per person, with every role they hold in one list (admin first). */
export function groupMembers(rows: MemberRow[]): Person[] {
  const people = new Map<string, Person>()
  for (const r of rows) {
    const p = people.get(r.userId) ?? { userId: r.userId, name: r.name, email: r.email, phone: r.phone, joinedAt: r.joinedAt, roles: [] }
    p.roles.push({
      membershipId: r.membershipId, role: r.role, flatId: r.flatId, memberType: r.memberType,
      flatText: flatText(r.wing, r.flatNumber), isProtected: r.role === 'admin',
    })
    if (r.joinedAt && (!p.joinedAt || r.joinedAt < p.joinedAt)) p.joinedAt = r.joinedAt
    people.set(r.userId, p)
  }
  return Array.from(people.values())
    .map(p => ({ ...p, roles: p.roles.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** "Resident · A-807 · Owner", "Guard", "Admin": one role, written for people. */
export function roleSummary(r: PersonRole): string {
  const parts = [roleLabel(r.role)]
  if (r.role === 'resident') {
    if (r.flatText !== '—') parts.push(r.flatText)
    if (r.memberType) parts.push(r.memberType.charAt(0).toUpperCase() + r.memberType.slice(1))
  }
  return parts.join(' · ')
}

/** True when the form changes nothing about the person's details, so no save is needed. */
export const nothingToSave = (a: { name: string; phone: string }, p: { name: string; phone?: string | null }) =>
  a.name.trim() === p.name && a.phone.replace(/[\s-]/g, '') === (p.phone ?? '').replace(/^\+91/, '')
