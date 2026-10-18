/** What the "Add / edit facility" form holds, as typed by a person, and what the server wants. */
export interface FacilityFormValues {
  name: string
  description: string
  capacity: string
  slotMinutes: string
  openTime: string
  closeTime: string
  advanceDays: string
  maxPerFlat: string
}

export interface FacilityPayload {
  name: string
  description: string
  capacityPersons: number
  slotDurationMinutes: number
  openTime: string
  closeTime: string
  advanceBookingDays: number
  maxBookingsPerFlat: number
}

export const EMPTY_FACILITY_FORM: FacilityFormValues = {
  name: '', description: '', capacity: '20', slotMinutes: '60',
  openTime: '06:00', closeTime: '22:00', advanceDays: '7', maxPerFlat: '2',
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

const whole = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v) : NaN)

/** Returns the first problem in plain words, or null when the form is fine to send. */
export function facilityFormError(v: FacilityFormValues): string | null {
  if (!v.name.trim()) return 'Give the facility a name.'
  const capacity = whole(v.capacity)
  if (!(capacity >= 1 && capacity <= 1000)) return 'Capacity must be between 1 and 1000 people.'
  const slot = whole(v.slotMinutes)
  if (!(slot >= 15 && slot <= 480)) return 'Each booking slot must be between 15 and 480 minutes.'
  if (!v.openTime || !v.closeTime) return 'Set the opening and closing time.'
  if (toMinutes(v.closeTime) <= toMinutes(v.openTime)) return 'Closing time must be after opening time.'
  if (toMinutes(v.closeTime) - toMinutes(v.openTime) < slot) return 'Open hours are shorter than one booking slot.'
  const advance = whole(v.advanceDays)
  if (!(advance >= 1 && advance <= 90)) return 'Advance booking must be between 1 and 90 days.'
  const perFlat = whole(v.maxPerFlat)
  if (!(perFlat >= 1 && perFlat <= 20)) return 'Bookings per flat must be between 1 and 20.'
  return null
}

export function toFacilityPayload(v: FacilityFormValues): FacilityPayload {
  return {
    name: v.name.trim(),
    description: v.description.trim(),
    capacityPersons: Number(v.capacity),
    slotDurationMinutes: Number(v.slotMinutes),
    openTime: v.openTime,
    closeTime: v.closeTime,
    advanceBookingDays: Number(v.advanceDays),
    maxBookingsPerFlat: Number(v.maxPerFlat),
  }
}

export function facilityToForm(f: {
  name: string; description?: string; capacity?: number; slotDuration?: number
  openTime?: string; closeTime?: string; advanceBookingDays?: number; maxBookingsPerFlat?: number
}): FacilityFormValues {
  return {
    name: f.name,
    description: f.description ?? '',
    capacity: String(f.capacity ?? 20),
    slotMinutes: String(f.slotDuration ?? 60),
    openTime: (f.openTime ?? '06:00').slice(0, 5),
    closeTime: (f.closeTime ?? '22:00').slice(0, 5),
    advanceDays: String(f.advanceBookingDays ?? 7),
    maxPerFlat: String(f.maxBookingsPerFlat ?? 2),
  }
}
