import { describe, it, expect } from 'vitest'
import { EMPTY_LAYOUT_FORM, parseWings, layoutError, layoutPreview, flatNumber, groupFlats, type FlatRow } from './flatLayout'

const ok = EMPTY_LAYOUT_FORM

describe('parseWings', () => {
  it('trims, drops blanks and repeats', () => expect(parseWings(' A, b ,A,, ')).toEqual(['A', 'b']))
  it('accepts commas, semicolons and new lines', () => expect(parseWings('A;B\nC')).toEqual(['A', 'B', 'C']))
})

describe('layoutError', () => {
  it('accepts the default 1 wing, 8 floors, 8 flats a floor', () => expect(layoutError(ok)).toBeNull())
  it('needs a wing', () => expect(layoutError({ ...ok, wings: ' , ' })).toMatch(/wing/i))
  it('limits floors and flats per floor', () => {
    expect(layoutError({ ...ok, floors: '0' })).toMatch(/floors/i)
    expect(layoutError({ ...ok, floors: '61' })).toMatch(/floors/i)
    expect(layoutError({ ...ok, floors: '2.5' })).toMatch(/floors/i)
    expect(layoutError({ ...ok, flatsPerFloor: '51' })).toMatch(/per floor/i)
    expect(layoutError({ ...ok, flatsPerFloor: '' })).toMatch(/per floor/i)
  })
  it('limits wing names', () => expect(layoutError({ ...ok, wings: 'ABCDEFGHIJK' })).toMatch(/10 characters/))
})

describe('layoutPreview', () => {
  it('describes one 8 x 8 wing', () => expect(layoutPreview(ok)).toBe('64 flats: A-101 to A-808'))
  it('counts every wing', () => expect(layoutPreview({ wings: 'A, B', floors: '2', flatsPerFloor: '3' })).toBe('12 flats: A-101 to B-203 (2 wings)'))
  it('says nothing while the form is wrong', () => expect(layoutPreview({ ...ok, floors: '' })).toBeNull())
})

describe('flatNumber', () => {
  it('writes floor then a two-digit flat', () => { expect(flatNumber(1, 1)).toBe('101'); expect(flatNumber(8, 8)).toBe('808'); expect(flatNumber(12, 10)).toBe('1210') })
})

describe('groupFlats', () => {
  const row = (wing: string, floor: number, label: string): FlatRow => ({ id: label, wing, number: label, label, floor, residents: 0 })
  it('groups by wing and floor in reading order', () => {
    const g = groupFlats([row('B', 1, 'B-101'), row('A', 2, 'A-201'), row('A', 1, 'A-102'), row('A', 1, 'A-101')])
    expect(g.map(x => x.wing)).toEqual(['A', 'B'])
    expect(g[0].floors.map(f => f.floor)).toEqual([1, 2])
    expect(g[0].floors[0].flats.map(f => f.label)).toEqual(['A-101', 'A-102'])
  })
  it('returns nothing for no flats', () => expect(groupFlats([])).toEqual([]))
})
