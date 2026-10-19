import { describe, it, expect } from 'vitest'
import { ACTIVE_RULES, RULE_DEFAULTS, rulesError, rulesFrom, type SocietyRules } from './societySettings'

const base = { id: '1', name: 'Govindbaug', address: 'Dehugaon', registrationNumber: 'NA', tier: 'free', isActive: true, totalFlats: 64 }

describe('rulesFrom', () => {
  it('uses real defaults (not zeros) when nothing was ever saved', () => {
    expect(rulesFrom({ ...base })).toEqual(RULE_DEFAULTS)
    expect(rulesFrom(undefined).billingCycleDay).toBe(1)
    expect(rulesFrom(null).gracePeriodDays).toBe(7)
  })

  it('shows what was saved, exactly', () => {
    const r = rulesFrom({ ...base, settings: { maintenanceAmount: 3500, billingCycleDay: 5, gracePeriodDays: 10, latePenaltyPercent: 2.5, city: 'Pune', visitorAlerts: false } })
    expect(r).toMatchObject({ maintenanceAmount: 3500, billingCycleDay: 5, gracePeriodDays: 10, latePenaltyPercent: 2.5, city: 'Pune', visitorAlerts: false, pushEnabled: true })
  })

  it('ignores a value of the wrong kind rather than showing nonsense', () => {
    const r = rulesFrom({ ...base, settings: { maintenanceAmount: 'lots' as unknown as number, visitorAlerts: 'yes' as unknown as boolean } })
    expect(r.maintenanceAmount).toBe(0)
    expect(r.visitorAlerts).toBe(true)
  })
})

describe('rulesError', () => {
  const ok: SocietyRules = { ...RULE_DEFAULTS, maintenanceAmount: 3500 }
  it('accepts good values', () => expect(rulesError(ok)).toBeNull())
  it('checks each rule in plain words', () => {
    expect(rulesError({ ...ok, contactEmail: 'nope' })).toMatch(/email/i)
    expect(rulesError({ ...ok, maintenanceAmount: -1 })).toMatch(/maintenance/i)
    expect(rulesError({ ...ok, billingCycleDay: 0 })).toMatch(/billing day/i)
    expect(rulesError({ ...ok, billingCycleDay: 29 })).toMatch(/billing day/i)
    expect(rulesError({ ...ok, gracePeriodDays: 31 })).toMatch(/grace/i)
    expect(rulesError({ ...ok, latePenaltyPercent: 37 })).toMatch(/penalty/i)
    expect(rulesError({ ...ok, gstEnabled: true, gstNumber: '123' })).toMatch(/GST/)
    expect(rulesError({ ...ok, gstEnabled: true, gstNumber: '27AAPFU0939F1ZV' })).toBeNull()
    expect(rulesError({ ...ok, visitorQrTtlMinutes: 31 })).toMatch(/QR/)
    expect(rulesError({ ...ok, piiWipeDays: 0 })).toMatch(/days/)
  })
})

describe('ACTIVE_RULES', () => {
  it('names the settings that already change how the system behaves', () => {
    for (const k of ['maintenanceAmount', 'gracePeriodDays', 'latePenaltyPercent', 'visitorAlerts', 'visitorQrTtlMinutes'] as const) expect(ACTIVE_RULES.has(k)).toBe(true)
    expect(ACTIVE_RULES.has('city')).toBe(false)
  })
})
