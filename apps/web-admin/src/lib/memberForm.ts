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
