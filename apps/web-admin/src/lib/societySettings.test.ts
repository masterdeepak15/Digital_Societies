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
  it('covers every setting on the page: none is kept without being used', () => {
    for (const k of Object.keys(RULE_DEFAULTS)) expect(ACTIVE_RULES.has(k as keyof SocietyRules)).toBe(true)
  })
})

describe('the automatic switches and the new numbers', () => {
  const ok: SocietyRules = { ...RULE_DEFAULTS, maintenanceAmount: 3500, latePenaltyPercent: 2 }
  it('start off for anything that sends mail or creates charges', () => {
    expect(RULE_DEFAULTS).toMatchObject({ autoGenerateBills: false, autoLateFees: false, emailEnabled: false, dueDays: 10, gstPercent: 18 })
  })
  it('need their numbers first', () => {
    expect(rulesError({ ...RULE_DEFAULTS, autoGenerateBills: true })).toMatch(/maintenance/i)
    expect(rulesError({ ...ok, autoGenerateBills: true })).toBeNull()
    expect(rulesError({ ...RULE_DEFAULTS, autoLateFees: true })).toMatch(/penalty/i)
    expect(rulesError({ ...ok, autoLateFees: true })).toBeNull()
  })
  it('check the due days and the GST rate', () => {
    expect(rulesError({ ...ok, dueDays: 0 })).toMatch(/fall due/i)
    expect(rulesError({ ...ok, dueDays: 61 })).toMatch(/fall due/i)
    expect(rulesError({ ...ok, gstEnabled: true, gstNumber: '27AAPFU0939F1ZV', gstPercent: 0 })).toMatch(/GST rate/i)
    expect(rulesError({ ...ok, gstEnabled: true, gstNumber: '27AAPFU0939F1ZV', gstPercent: 18 })).toBeNull()
  })
})
