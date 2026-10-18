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
