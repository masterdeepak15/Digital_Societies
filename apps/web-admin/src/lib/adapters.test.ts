import { describe, it, expect } from 'vitest'
import { toPage, adaptResponse, applyFlatLabels, needsFlatLabels } from './adapters'

describe('toPage', () => {
  it('wraps a bare array', () => {
    expect(toPage([{ a: 1 }, { a: 2 }])).toEqual({ items: [{ a: 1 }, { a: 2 }], total: 2 })
  })
  it('keeps items and total', () => {
    expect(toPage({ items: [1], total: 9 })).toEqual({ items: [1], total: 9 })
  })
  it('reads totalCount', () => {
    expect(toPage({ items: [1, 2], totalCount: 7, page: 1 })).toEqual({ items: [1, 2], total: 7 })
  })
  it('falls back to the list length when no total is sent', () => {
    expect(toPage({ items: [1, 2, 3] })).toEqual({ items: [1, 2, 3], total: 3 })
  })
  it('reads a named list key', () => {
    expect(toPage({ facilities: [1, 2] }, ['facilities'])).toEqual({ items: [1, 2], total: 2 })
  })
  it('returns an empty page for anything else', () => {
    expect(toPage(null)).toEqual({ items: [], total: 0 })
    expect(toPage('nope')).toEqual({ items: [], total: 0 })
    expect(toPage({})).toEqual({ items: [], total: 0 })
  })
})

describe('adaptResponse', () => {
  it('leaves unknown paths untouched', () => {
    const body = { hello: 'world' }
    expect(adaptResponse('/something/else', body)).toBe(body)
  })

  it('wraps the bare members array', () => {
    const out = adaptResponse('/members?role=resident', [{ userId: 'u1', name: 'A' }]) as { items: unknown[]; total: number }
    expect(out.items).toHaveLength(1)
    expect(out.total).toBe(1)
  })

  it('maps visitor field names to the ones the page reads', () => {
    const out = adaptResponse('/visitors?page=1', {
      items: [{ id: 'v1', visitorName: 'Ravi', visitorPhone: '+9198', purpose: 'Delivery', status: 'Pending' }],
      totalCount: 4,
    }) as { items: Record<string, unknown>[]; total: number }
    expect(out.total).toBe(4)
    expect(out.items[0]).toMatchObject({ id: 'v1', name: 'Ravi', phone: '+9198', purposeOfVisit: 'Delivery', status: 'Pending' })
  })

  it('maps complaints, notices and ledger entries to {items,total}', () => {
    for (const path of ['/complaints', '/notices', '/accounting/entries?pendingOnly=true']) {
      expect(adaptResponse(path, { items: [{ id: '1' }], totalCount: 3 })).toEqual({ items: [{ id: '1' }], total: 3 })
    }
  })

  it('maps the monthly report', () => {
    const out = adaptResponse('/accounting/report?month=10&year=2026', {
      month: 10, year: 2026, totalIncomePaise: 1000, totalExpensePaise: 400, netPaise: 600,
      incomeByCategory: [], expenseByCategory: [{ category: 'Repairs', amountPaise: 400, count: 1 }], pendingApprovals: 2,
    })
    expect(out).toEqual({
      period: '2026-10', totalIncome: 1000, totalExpense: 400, netProfit: 600,
      expenseBreakdown: [{ category: 'Repairs', amount: 400 }], pendingApprovals: 2,
    })
  })

  it('wraps facilities and maps their field names', () => {
    const out = adaptResponse('/facilities', [
      { id: 'f1', name: 'Pool', capacityPersons: 20, slotDurationMinutes: 60, openTime: '06:00', closeTime: '20:00', isActive: true },
    ]) as { facilities: Record<string, unknown>[] }
    expect(out.facilities[0]).toMatchObject({ id: 'f1', capacity: 20, slotDuration: 60, openTime: '06:00' })
  })

  it('wraps facility bookings', () => {
    expect(adaptResponse('/facilities/bookings?date=2026-10-17', [{ id: 'b1' }])).toEqual({ items: [{ id: 'b1' }], total: 1 })
  })

  it('wraps parking levels and derives occupied slots', () => {
    const out = adaptResponse('/parking/levels', [{ id: 'l1', name: 'B1', totalSlots: 20, availableSlots: 5 }]) as { levels: Record<string, unknown>[] }
    expect(out.levels[0]).toMatchObject({ id: 'l1', totalSlots: 20, occupiedSlots: 15, availableSlots: 5 })
  })

  it('maps marketplace listings', () => {
    const out = adaptResponse('/marketplace/listings', [
      { id: 'm1', title: 'Plumber', providerName: 'Ramesh', baseRateRupees: 400, averageRating: 4.5, category: 'Plumber', isActive: true },
    ]) as { items: Record<string, unknown>[] }
    expect(out.items[0]).toMatchObject({ id: 'm1', price: 400, rating: 4.5, providerName: 'Ramesh' })
  })

  it('maps social posts', () => {
    const out = adaptResponse('/social/posts?page=1', {
      items: [{ id: 'p1', body: 'Hi', authorFlatDisplay: 'A-101', reactionCount: 3, imageUrls: ['x'], commentCount: 2, isPinned: false, isLocked: false, createdAt: '2026-10-01T00:00:00Z' }],
      totalCount: 1,
    }) as { items: Record<string, unknown>[] }
    expect(out.items[0]).toMatchObject({ id: 'p1', authorName: 'A-101', authorFlat: 'A-101', reactionsCount: 3, imageCount: 1, commentCount: 2 })
  })

  it('maps the wallet balance and transactions', () => {
    expect(adaptResponse('/wallet/balance', { walletId: 'w', balanceRupees: 2250, totalTransactions: 3 }))
      .toMatchObject({ balance: 2250, currency: 'INR' })
    const out = adaptResponse('/wallet/transactions?page=1&pageSize=50', [
      { id: 't1', amountPaise: 25000, direction: 'Credit', type: 'Cashback', description: 'Cashback', createdAt: '2026-10-01T00:00:00Z' },
    ]) as { items: Record<string, unknown>[]; total: number }
    expect(out.total).toBe(1)
    expect(out.items[0]).toMatchObject({ id: 't1', type: 'Credit', amount: 250, description: 'Cashback', timestamp: '2026-10-01T00:00:00Z' })
  })

  it('survives unexpected shapes without throwing', () => {
    expect(() => adaptResponse('/visitors', null)).not.toThrow()
    expect(() => adaptResponse('/facilities', { nope: true })).not.toThrow()
  })
})

describe('applyFlatLabels', () => {
  const labels = { f1: 'A-101' }
  it('names the flat on bookings', () => {
    const out = applyFlatLabels('/facilities/bookings?date=2026-10-18', { items: [{ id: 'b', flatId: 'f1' }], total: 1 }, labels) as { items: Record<string, unknown>[] }
    expect(out.items[0].flatDisplay).toBe('A-101')
  })
  it('replaces the flat id used as author on posts', () => {
    const out = applyFlatLabels('/social/posts', { items: [{ id: 'p', authorFlat: 'f1', authorName: 'f1' }], total: 1 }, labels) as { items: Record<string, unknown>[] }
    expect(out.items[0]).toMatchObject({ authorFlat: 'A-101', authorName: 'A-101' })
  })
  it('leaves unknown flats untouched and only applies to those paths', () => {
    const data = { items: [{ id: 'p', authorFlat: 'zzz' }], total: 1 }
    expect(applyFlatLabels('/social/posts', data, labels)).toEqual(data)
    expect(needsFlatLabels('/notices')).toBe(false)
    expect(needsFlatLabels('/social/posts?page=1')).toBe(true)
  })
})
