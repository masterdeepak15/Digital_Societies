import { describe, it, expect } from 'vitest'
import { canOpen } from './roles'

const user = (roles: string[]) => ({ userId: 'u', name: 'n', email: 'e', roles, societyId: 's' })

describe('canOpen', () => {
  it('lets an admin open everything', () => {
    expect(canOpen(user(['admin']), '/members')).toBe(true)
    expect(canOpen(user(['admin']), '/settings')).toBe(true)
  })
  it('keeps an accountant out of admin-only pages and their sub-paths', () => {
    expect(canOpen(user(['accountant']), '/members')).toBe(false)
    expect(canOpen(user(['accountant']), '/complaints/123')).toBe(false)
    expect(canOpen(user(['accountant']), '/settings')).toBe(false)
  })
  it('lets an accountant open finance pages', () => {
    expect(canOpen(user(['accountant']), '/billing')).toBe(true)
    expect(canOpen(user(['accountant']), '/accounting')).toBe(true)
    expect(canOpen(user(['accountant']), '/dashboard')).toBe(true)
  })
  it('does not match on a shared prefix', () => {
    expect(canOpen(user(['accountant']), '/membership-info')).toBe(true)
  })
  it('lets an unknown user through (the API enforces access)', () => {
    expect(canOpen(null, '/members')).toBe(true)
  })
})
