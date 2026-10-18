export interface LayoutFormValues {
  wings: string        // "A, B" — one or more building names
  floors: string
  flatsPerFloor: string
}

export const EMPTY_LAYOUT_FORM: LayoutFormValues = { wings: 'A', floors: '8', flatsPerFloor: '8' }

/** "A, b ,A" becomes ["A", "b"]: trimmed, no blanks, no repeats (ignoring case). */
export function parseWings(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of text.split(/[,\n;]/)) {
    const w = part.trim()
    if (w && !seen.has(w.toLowerCase())) { seen.add(w.toLowerCase()); out.push(w) }
  }
  return out
}

const whole = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v) : NaN)

/** Returns the first problem in plain words, or null when the layout can be sent. */
export function layoutError(v: LayoutFormValues): string | null {
  const wings = parseWings(v.wings)
  if (wings.length === 0) return 'Enter at least one wing or building name, for example A.'
  if (wings.length > 26) return 'That is more than 26 wings.'
  if (wings.some(w => w.length > 10)) return 'Wing names can be at most 10 characters.'
  const floors = whole(v.floors)
  if (!(floors >= 1 && floors <= 60)) return 'Floors must be between 1 and 60.'
  const per = whole(v.flatsPerFloor)
  if (!(per >= 1 && per <= 50)) return 'Flats per floor must be between 1 and 50.'
  return null
}

/** The numbers the server will create for one floor: 101, 102 … on floor 1, 201, 202 … on floor 2. */
export const flatNumber = (floor: number, n: number) => `${floor}${String(n).padStart(2, '0')}`

/** A short sentence telling the admin what Apply will build, for example "64 flats: A-101 to A-808". */
export function layoutPreview(v: LayoutFormValues): string | null {
  if (layoutError(v)) return null
  const wings = parseWings(v.wings)
  const floors = Number(v.floors)
  const per = Number(v.flatsPerFloor)
  const total = wings.length * floors * per
  const first = `${wings[0]}-${flatNumber(1, 1)}`
  const last = `${wings[wings.length - 1]}-${flatNumber(floors, per)}`
  return `${total} flats: ${first} to ${last}${wings.length > 1 ? ` (${wings.length} wings)` : ''}`
}

export interface FlatRow { id: string; wing: string; number: string; label: string; floor: number; residents: number }

/** Groups flats by wing, then floor, in reading order. */
export function groupFlats(flats: FlatRow[]): { wing: string; floors: { floor: number; flats: FlatRow[] }[] }[] {
  const wings = new Map<string, Map<number, FlatRow[]>>()
  for (const f of flats) {
    const floors = wings.get(f.wing) ?? new Map<number, FlatRow[]>()
    floors.set(f.floor, [...(floors.get(f.floor) ?? []), f])
    wings.set(f.wing, floors)
  }
  return Array.from(wings.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([wing, floors]) => ({
      wing,
      floors: Array.from(floors.entries())
        .sort(([a], [b]) => a - b)
        .map(([floor, list]) => ({ floor, flats: list.sort((x, y) => x.label.localeCompare(y.label, undefined, { numeric: true })) })),
    }))
}
