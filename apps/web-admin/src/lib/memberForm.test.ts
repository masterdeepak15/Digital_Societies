import { describe, it, expect } from 'vitest'
import { EMPTY_MEMBER_FORM, memberFormError, toMemberPayload, flatText, sortedFlats, roleLabel } from './memberForm'

const resident = { ...EMPTY_MEMBER_FORM, name: 'Deepak Chougale', email: 'd@example.com', flatId: 'flat-1' }
const guard = { ...EMPTY_MEMBER_FORM, name: 'Ramu Singh', email: 'ramu@example.com', role: 'guard' }

describe('memberFormError', () => {
  it('accepts a resident with a flat and a guard without one', () => {
    expect(memberFormError(resident)).toBeNull()
    expect(memberFormError(guard)).toBeNull()
  })
  it('needs a name and a real email', () => {
    expect(memberFormError({ ...guard, name: 'R' })).toMatch(/name/i)
    expect(memberFormError({ ...guard, email: 'ramu' })).toMatch(/email/i)
  })
  it('needs a flat only for residents', () => {
    expect(memberFormError({ ...resident, flatId: '' })).toMatch(/flat/i)
    expect(memberFormError({ ...guard, flatId: '' })).toBeNull()
  })
  it('allows an empty phone but not a wrong one', () => {
    expect(memberFormError({ ...guard, phone: '' })).toBeNull()
    expect(memberFormError({ ...guard, phone: '99 7500-1173' })).toBeNull()
    expect(memberFormError({ ...guard, phone: '123' })).toMatch(/phone/i)
  })
  it('rejects an unknown role', () => expect(memberFormError({ ...guard, role: 'janitor' })).toMatch(/role/i))
})

describe('toMemberPayload', () => {
  it('sends flat and relationship only for residents', () => {
    expect(toMemberPayload({ ...resident, relationship: 'tenant' })).toMatchObject({ role: 'resident', flatId: 'flat-1', memberType: 'tenant' })
    expect(toMemberPayload({ ...guard, flatId: 'stale', relationship: 'tenant' })).toMatchObject({ role: 'guard', flatId: null, memberType: null })
  })
  it('trims text and cleans the phone', () => {
    expect(toMemberPayload({ ...guard, name: ' Ramu ', email: ' R@x.com ', phone: '99750 01173' }))
      .toMatchObject({ name: 'Ramu', email: 'R@x.com', phone: '9975001173' })
  })
})

describe('flatText', () => {
  it('does not repeat the wing when the number already has it', () => expect(flatText('A', 'A-807')).toBe('A-807'))
  it('joins wing and plain number', () => expect(flatText('B', '101')).toBe('B-101'))
  it('shows a dash when there is no flat', () => { expect(flatText(null, null)).toBe('—'); expect(flatText('A', '')).toBe('—') })
})

describe('sortedFlats / roleLabel', () => {
  it('sorts flats naturally', () =>
    expect(sortedFlats({ x: 'A-10', y: 'A-2', z: 'A-1' }).map(f => f.label)).toEqual(['A-1', 'A-2', 'A-10']))
  it('names roles for people', () => { expect(roleLabel('accountant')).toBe('Accountant'); expect(roleLabel('zzz')).toBe('zzz') })
})

import { groupMembers, roleSummary, nothingToSave, type MemberRow } from './memberForm'

const row = (over: Partial<MemberRow>): MemberRow => ({ userId: 'u1', name: 'Deepak', role: 'resident', membershipId: 'm1', ...over })

describe('groupMembers', () => {
  it('shows one person once, with every role together, admin first', () => {
    const people = groupMembers([
      row({ membershipId: 'm1', role: 'resident', wing: 'A', flatNumber: 'A-807', memberType: 'owner', joinedAt: '2026-10-18T10:00:00Z' }),
      row({ membershipId: 'm2', role: 'admin', joinedAt: '2026-10-18T09:00:00Z' }),
      row({ membershipId: 'm3', role: 'accountant' }),
    ])
    expect(people).toHaveLength(1)
    expect(people[0].roles.map(r => r.role)).toEqual(['admin', 'accountant', 'resident'])
    expect(people[0].joinedAt).toBe('2026-10-18T09:00:00Z')
  })
  it('keeps different people apart, sorted by name', () => {
    const people = groupMembers([row({ userId: 'b', name: 'Zed' }), row({ userId: 'a', name: 'Amy', membershipId: 'm2' })])
    expect(people.map(p => p.name)).toEqual(['Amy', 'Zed'])
  })
  it('marks only admin roles as protected', () => {
    const [p] = groupMembers([row({ role: 'admin' }), row({ role: 'guard', membershipId: 'm2' })])
    expect(p.roles.map(r => [r.role, r.isProtected])).toEqual([['admin', true], ['guard', false]])
  })
  it('returns nobody for an empty list', () => expect(groupMembers([])).toEqual([]))
})

describe('roleSummary', () => {
  const base = { membershipId: 'm', isProtected: false }
  it('writes a resident with flat and relationship', () =>
    expect(roleSummary({ ...base, role: 'resident', flatText: 'A-807', memberType: 'owner' })).toBe('Resident · A-807 · Owner'))
  it('writes other roles on their own', () => {
    expect(roleSummary({ ...base, role: 'guard', flatText: '—', memberType: 'staff' })).toBe('Guard')
    expect(roleSummary({ ...base, role: 'admin', flatText: '—' })).toBe('Admin')
  })
})

describe('nothingToSave', () => {
  it('is true when name and phone are as they were', () =>
    expect(nothingToSave({ name: 'Ramu ', phone: '9975001174' }, { name: 'Ramu', phone: '+919975001174' })).toBe(true))
  it('is false after a change', () =>
    expect(nothingToSave({ name: 'Ramu S', phone: '' }, { name: 'Ramu', phone: null })).toBe(false))
})
