import { describe, it, expect } from 'vitest'
import { EMPTY_FACILITY_FORM, facilityFormError, toFacilityPayload, facilityToForm } from './facilityForm'

const ok = { ...EMPTY_FACILITY_FORM, name: 'Clubhouse' }

describe('facilityFormError', () => {
  it('accepts a sensible facility', () => expect(facilityFormError(ok)).toBeNull())
  it('needs a name', () => expect(facilityFormError({ ...ok, name: '  ' })).toMatch(/name/i))
  it('needs a whole-number capacity of at least one', () => {
    expect(facilityFormError({ ...ok, capacity: '0' })).toMatch(/capacity/i)
    expect(facilityFormError({ ...ok, capacity: '2.5' })).toMatch(/capacity/i)
    expect(facilityFormError({ ...ok, capacity: '' })).toMatch(/capacity/i)
  })
  it('rejects a slot shorter than 15 minutes', () => expect(facilityFormError({ ...ok, slotMinutes: '10' })).toMatch(/slot/i))
  it('rejects closing at or before opening', () => {
    expect(facilityFormError({ ...ok, openTime: '22:00', closeTime: '08:00' })).toMatch(/after opening/i)
    expect(facilityFormError({ ...ok, openTime: '08:00', closeTime: '08:00' })).toMatch(/after opening/i)
  })
  it('rejects open hours shorter than one slot', () =>
    expect(facilityFormError({ ...ok, openTime: '08:00', closeTime: '09:00', slotMinutes: '120' })).toMatch(/shorter than one/i))
  it('limits advance days and bookings per flat', () => {
    expect(facilityFormError({ ...ok, advanceDays: '0' })).toMatch(/advance/i)
    expect(facilityFormError({ ...ok, maxPerFlat: '21' })).toMatch(/per flat/i)
  })
})

describe('toFacilityPayload / facilityToForm', () => {
  it('sends numbers and trimmed text', () => {
    expect(toFacilityPayload({ ...ok, name: ' Gym ', description: ' Free weights ', capacity: '12' })).toMatchObject({
      name: 'Gym', description: 'Free weights', capacityPersons: 12, slotDurationMinutes: 60,
      openTime: '06:00', closeTime: '22:00', advanceBookingDays: 7, maxBookingsPerFlat: 2,
    })
  })
  it('round-trips a facility from the server into the form', () => {
    const form = facilityToForm({ name: 'Pool', capacity: 30, slotDuration: 45, openTime: '07:00:00', closeTime: '20:00', advanceBookingDays: 3, maxBookingsPerFlat: 1 })
    expect(form).toMatchObject({ name: 'Pool', capacity: '30', slotMinutes: '45', openTime: '07:00', closeTime: '20:00', advanceDays: '3', maxPerFlat: '1' })
    expect(facilityFormError(form)).toBeNull()
  })
})
