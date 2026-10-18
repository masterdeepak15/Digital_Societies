/** Service categories and rate units, exactly as the server names them. */
export const SERVICE_CATEGORIES = [
  { value: 'Plumber', label: 'Plumber' },
  { value: 'Electrician', label: 'Electrician' },
  { value: 'Carpenter', label: 'Carpenter' },
  { value: 'Painter', label: 'Painter' },
  { value: 'Cleaner', label: 'Cleaner' },
  { value: 'PestControl', label: 'Pest control' },
  { value: 'AcRepair', label: 'AC repair' },
  { value: 'ApplianceRepair', label: 'Appliance repair' },
  { value: 'Gardener', label: 'Gardener' },
  { value: 'Other', label: 'Other' },
] as const

export const RATE_UNITS = [
  { value: 'PerVisit', label: 'per visit' },
  { value: 'PerHour', label: 'per hour' },
  { value: 'PerDay', label: 'per day' },
] as const

export const categoryLabel = (value: string) =>
  SERVICE_CATEGORIES.find(c => c.value === value)?.label ?? value

export const rateUnitLabel = (value: string) =>
  RATE_UNITS.find(u => u.value === value)?.label ?? value

export interface ListingFormValues {
  providerName: string
  phone: string
  category: string
  title: string
  description: string
  rate: string
  rateUnit: string
  commission: string
}

export const EMPTY_LISTING_FORM: ListingFormValues = {
  providerName: '', phone: '', category: 'Plumber', title: '',
  description: '', rate: '', rateUnit: 'PerVisit', commission: '0',
}

/** Returns the first problem in plain words, or null when the form is fine to send. */
export function listingFormError(v: ListingFormValues): string | null {
  if (!v.providerName.trim()) return 'Enter the service provider’s name.'
  if (!/^\+?[0-9]{10,13}$/.test(v.phone.replace(/[\s-]/g, ''))) return 'Enter a valid phone number, for example 9975001173.'
  if (!v.title.trim()) return 'Describe the service in a few words, for example “Leak repair”.'
  const rate = Number(v.rate)
  if (!v.rate.trim() || !Number.isFinite(rate) || rate <= 0) return 'Enter the rate in rupees.'
  const commission = Number(v.commission)
  if (!Number.isFinite(commission) || commission < 0 || commission > 100) return 'Commission must be between 0 and 100 percent.'
  return null
}

export function toListingPayload(v: ListingFormValues) {
  return {
    providerName: v.providerName.trim(),
    phone: v.phone.replace(/[\s-]/g, ''),
    category: v.category,
    title: v.title.trim(),
    description: v.description.trim(),
    baseRateRupees: Number(v.rate),
    rateUnit: v.rateUnit,
    commissionPct: Number(v.commission),
  }
}
