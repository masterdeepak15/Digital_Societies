import { describe, it, expect } from 'vitest'
import { EMPTY_LISTING_FORM, listingFormError, toListingPayload, categoryLabel, rateUnitLabel, listingToForm } from './listingForm'

const ok = { ...EMPTY_LISTING_FORM, providerName: 'Ramesh Kale', phone: '99750 01173', title: 'Leak repair', rate: '350' }

describe('listingFormError', () => {
  it('accepts a complete listing', () => expect(listingFormError(ok)).toBeNull())
  it('needs the provider name and a title', () => {
    expect(listingFormError({ ...ok, providerName: ' ' })).toMatch(/name/i)
    expect(listingFormError({ ...ok, title: '' })).toMatch(/few words/i)
  })
  it('checks the phone number, ignoring spaces and dashes', () => {
    expect(listingFormError({ ...ok, phone: '12345' })).toMatch(/phone/i)
    expect(listingFormError({ ...ok, phone: '+91 99750-01173' })).toBeNull()
  })
  it('needs a positive rate', () => {
    expect(listingFormError({ ...ok, rate: '' })).toMatch(/rate/i)
    expect(listingFormError({ ...ok, rate: '0' })).toMatch(/rate/i)
    expect(listingFormError({ ...ok, rate: 'abc' })).toMatch(/rate/i)
  })
  it('keeps commission between 0 and 100', () => {
    expect(listingFormError({ ...ok, commission: '101' })).toMatch(/commission/i)
    expect(listingFormError({ ...ok, commission: '-1' })).toMatch(/commission/i)
    expect(listingFormError({ ...ok, commission: '15' })).toBeNull()
  })
})

describe('toListingPayload', () => {
  it('sends a clean phone number, numeric rate and server category names', () => {
    expect(toListingPayload({ ...ok, category: 'AcRepair', rateUnit: 'PerHour', commission: '10' })).toEqual({
      providerName: 'Ramesh Kale', phone: '9975001173', category: 'AcRepair', title: 'Leak repair',
      description: '', baseRateRupees: 350, rateUnit: 'PerHour', commissionPct: 10,
    })
  })
})

describe('labels', () => {
  it('shows people-friendly names', () => {
    expect(categoryLabel('PestControl')).toBe('Pest control')
    expect(categoryLabel('Unknown')).toBe('Unknown')
    expect(rateUnitLabel('PerDay')).toBe('per day')
  })
})

describe('listingToForm', () => {
  it('fills the form from a listing and the result can be saved as it is', () => {
    const form = listingToForm({ providerName: 'Ramesh Kale', phone: '+919975001173', category: 'Plumber', title: 'Leak repair', price: 350, rateUnit: 'PerVisit', commissionPct: 10 })
    expect(form).toMatchObject({ rate: '350', commission: '10', rateUnit: 'PerVisit', description: '' })
    expect(listingFormError(form)).toBeNull()
  })
})
