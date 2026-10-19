/** The society's own rules, as the server stores them (GET /settings → settings, PATCH /settings ← settings). */
export interface SocietyRules {
  contactEmail: string
  contactPhone: string
  city: string
  pincode: string
  maintenanceAmount: number
  billingCycleDay: number
  gracePeriodDays: number
  latePenaltyPercent: number
  gstEnabled: boolean
  gstNumber: string
  gstPercent: number
  dueDays: number
  autoGenerateBills: boolean
  autoLateFees: boolean
  pushEnabled: boolean
  smsEnabled: boolean
  emailEnabled: boolean
  visitorAlerts: boolean
  paymentReminders: boolean
  visitorQrTtlMinutes: number
  piiWipeDays: number
  offlineSyncEnabled: boolean
}

export interface ApiSettings {
  id: string
  name: string
  address: string
  registrationNumber: string
  tier: string
  isActive: boolean
  totalFlats: number
  settings?: Partial<SocietyRules> | null
}

/** What a society that has never saved anything starts with (the same values the server uses). */
export const RULE_DEFAULTS: SocietyRules = {
  contactEmail: '', contactPhone: '', city: '', pincode: '',
  maintenanceAmount: 0, billingCycleDay: 1, gracePeriodDays: 7, latePenaltyPercent: 0, gstEnabled: false, gstNumber: '',
  gstPercent: 18, dueDays: 10, autoGenerateBills: false, autoLateFees: false,
  pushEnabled: true, smsEnabled: false, emailEnabled: false, visitorAlerts: true, paymentReminders: true,
  visitorQrTtlMinutes: 2, piiWipeDays: 7, offlineSyncEnabled: true,
}

/** Server values over the defaults, field by field, so a value the server did not send is never undefined or zero by accident. */
export function rulesFrom(api: ApiSettings | undefined | null): SocietyRules {
  const s = api?.settings ?? {}
  const out = { ...RULE_DEFAULTS } as Record<string, unknown>
  for (const key of Object.keys(RULE_DEFAULTS) as (keyof SocietyRules)[]) {
    const v = s[key]
    if (v !== undefined && v !== null && typeof v === typeof RULE_DEFAULTS[key]) out[key] = v
  }
  return out as unknown as SocietyRules
}

/** First problem in plain words, or null (the server checks the same rules). */
export function rulesError(r: SocietyRules): string | null {
  if (r.contactEmail && !r.contactEmail.includes('@')) return 'Enter a valid contact email, or leave it empty.'
  if (!(r.maintenanceAmount >= 0 && r.maintenanceAmount <= 1_000_000)) return 'Monthly maintenance must be between 0 and 10,00,000 rupees.'
  if (!Number.isInteger(r.billingCycleDay) || r.billingCycleDay < 1 || r.billingCycleDay > 28) return 'The billing day must be between 1 and 28.'
  if (!Number.isInteger(r.gracePeriodDays) || r.gracePeriodDays < 0 || r.gracePeriodDays > 30) return 'The grace period must be between 0 and 30 days.'
  if (!(r.latePenaltyPercent >= 0 && r.latePenaltyPercent <= 36)) return 'The late penalty must be between 0 and 36 percent.'
  if (r.gstEnabled && r.gstNumber.trim().length !== 15) return 'A GST number has 15 characters. Add it, or switch GST off.'
  if (r.gstEnabled && !(r.gstPercent > 0 && r.gstPercent <= 28)) return 'The GST rate must be between 0 and 28 percent.'
  if (!Number.isInteger(r.dueDays) || r.dueDays < 1 || r.dueDays > 60) return 'A bill must fall due between 1 and 60 days after it goes out.'
  if (r.autoGenerateBills && r.maintenanceAmount <= 0) return 'Set the monthly maintenance before turning on automatic bills.'
  if (r.autoLateFees && r.latePenaltyPercent <= 0) return 'Set a late penalty before turning on automatic late fees.'
  if (!Number.isInteger(r.visitorQrTtlMinutes) || r.visitorQrTtlMinutes < 1 || r.visitorQrTtlMinutes > 30) return 'The visitor QR code lifetime must be between 1 and 30 minutes.'
  if (!Number.isInteger(r.piiWipeDays) || r.piiWipeDays < 1 || r.piiWipeDays > 30) return 'Visitor details are kept for 1 to 30 days on the guard’s phone.'
  return null
}

/** Every setting on the page is acted on by the system: this lists them so the page (and a test) can say so. */
export const ACTIVE_RULES: ReadonlySet<keyof SocietyRules> = new Set(Object.keys(RULE_DEFAULTS) as (keyof SocietyRules)[])
