import { describe, it, expect } from 'vitest'
import {
  toLedgerRows, ledgerTotals, statusText, canDecide, canReopen, needsApproval, monthValue, monthQuery,
  entryEditError, toPaise, type ApiLedgerEntry,
} from './ledger'

const entry = (o: Partial<ApiLedgerEntry>): ApiLedgerEntry => ({
  id: 'e', entryDate: '2026-10-10', type: 'Expense', category: 'maintenance', description: 'Lift AMC',
  amountPaise: 5_000_000, status: 'Approved', ...o,
})

describe('toLedgerRows', () => {
  it('counts only approved entries in the balance', () => {
    const rows = toLedgerRows([
      entry({ id: 'a', type: 'Income', amountPaise: 1_000_000, entryDate: '2026-10-01' }),
      entry({ id: 'b', amountPaise: 300_000, entryDate: '2026-10-02' }),
      entry({ id: 'c', amountPaise: 5_000_000, status: 'Rejected', entryDate: '2026-10-03' }),
      entry({ id: 'd', amountPaise: 2_000_000, status: 'PendingApproval', entryDate: '2026-10-04' }),
    ])
    expect(rows.map(r => r.id)).toEqual(['d', 'c', 'b', 'a'])          // newest first
    expect(rows.map(r => r.balance)).toEqual([700_000, 700_000, 700_000, 1_000_000])
    expect(rows.find(r => r.id === 'c')).toMatchObject({ debit: 0, amountPaise: 5_000_000, status: 'Rejected' })
  })
  it('keeps the rejection reason for display', () =>
    expect(toLedgerRows([entry({ status: 'Rejected', rejectionReason: 'Not budgeted' })])[0].rejectionReason).toBe('Not budgeted'))
  it('handles an empty list', () => expect(toLedgerRows([])).toEqual([]))
})

describe('ledgerTotals', () => {
  it('sums income and expenses of counted entries', () => {
    const rows = toLedgerRows([entry({ type: 'Income', amountPaise: 900, id: 'i' }), entry({ amountPaise: 400, id: 'x' }), entry({ amountPaise: 777, status: 'Rejected', id: 'r' })])
    expect(ledgerTotals(rows)).toEqual({ income: 900, expense: 400, balance: 500 })
  })
})

describe('what can be done to an entry', () => {
  it('decides only while waiting', () => {
    expect(canDecide('PendingApproval')).toBe(true)
    expect(canDecide('Rejected')).toBe(false)
    expect(canDecide('Approved')).toBe(false)
  })
  it('reopens a decided expense, never income or a waiting expense', () => {
    expect(canReopen({ type: 'Expense', status: 'Rejected' })).toBe(true)
    expect(canReopen({ type: 'Expense', status: 'Approved' })).toBe(true)
    expect(canReopen({ type: 'Expense', status: 'PendingApproval' })).toBe(false)
    expect(canReopen({ type: 'Income', status: 'Approved' })).toBe(false)
  })
  it('writes statuses for people', () => {
    expect(statusText('PendingApproval')).toBe('Waiting for approval')
    expect(statusText('Rejected')).toBe('Rejected')
  })
})

describe('needsApproval', () => {
  it('matches the server rule: expenses above 10,000 rupees', () => {
    expect(needsApproval('Expense', 10_000)).toBe(false)
    expect(needsApproval('Expense', 10_000.5)).toBe(true)
    expect(needsApproval('Income', 90_000)).toBe(false)
  })
})

describe('months', () => {
  it('formats and parses the month input', () => {
    expect(monthValue(new Date(2026, 9, 18))).toBe('2026-10')
    expect(monthQuery('2025-03')).toEqual({ month: 3, year: 2025 })
  })
  it('falls back to the current month for nonsense', () => {
    const now = new Date()
    expect(monthQuery('')).toEqual({ month: now.getMonth() + 1, year: now.getFullYear() })
    expect(monthQuery('2026-13')).toEqual({ month: now.getMonth() + 1, year: now.getFullYear() })
  })
})

describe('entryEditError', () => {
  const ok = { category: 'maintenance', description: 'Lift AMC', amount: '50000', date: '2026-10-18' }
  it('accepts a good correction', () => expect(entryEditError(ok)).toBeNull())
  it('checks each field', () => {
    expect(entryEditError({ ...ok, description: 'ab' })).toMatch(/few words/i)
    expect(entryEditError({ ...ok, category: '' })).toMatch(/category/i)
    expect(entryEditError({ ...ok, amount: '0' })).toMatch(/amount/i)
    expect(entryEditError({ ...ok, amount: 'abc' })).toMatch(/amount/i)
    expect(entryEditError({ ...ok, date: '' })).toMatch(/date/i)
  })
})

describe('toPaise', () => {
  it('turns rupees into whole paise without floating-point drift', () => {
    expect(toPaise('50000')).toBe(5_000_000)
    expect(toPaise(1234.5)).toBe(123_450)
    expect(toPaise('0.29')).toBe(29)
  })
})
