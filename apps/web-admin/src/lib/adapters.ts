/**
 * The backend's list endpoints answer in several shapes (bare arrays, `totalCount`, `{ facilities }`
 * ...) and with field names that differ from what the console pages read. The pages are written
 * against `{ items, total }`; this module is the one place that translates, so a response change
 * is fixed here rather than in thirteen pages.
 */

export interface Page<T> { items: T[]; total: number }

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Any list-shaped response -> `{ items, total }`. */
export function toPage<T = unknown>(raw: unknown, listKeys: string[] = []): Page<T> {
  if (Array.isArray(raw)) return { items: raw as T[], total: raw.length }
  if (isRec(raw)) {
    for (const key of [...listKeys, 'items']) {
      const list = raw[key]
      if (Array.isArray(list)) {
        const total = typeof raw.total === 'number' ? raw.total : typeof raw.totalCount === 'number' ? raw.totalCount : list.length
        return { items: list as T[], total }
      }
    }
  }
  return { items: [], total: 0 }
}

const mapItems = <T>(page: Page<unknown>, fn: (row: Rec) => T): Page<T> => ({
  total: page.total,
  items: page.items.filter(isRec).map(fn),
})

const num = (v: unknown): number => (typeof v === 'number' ? v : 0)
const pathOf = (path: string) => path.split('?')[0].replace(/\/+$/, '')

/** Translate a GET response for `path` into the shape the console pages expect. */
export function adaptResponse(path: string, data: unknown): unknown {
  const p = pathOf(path)

  switch (true) {
    case p === '/members':
      return mapItems(toPage(data), m => ({ ...m, isActive: m.isActive ?? true }))

    case p === '/complaints':
    case p === '/notices':
    case p === '/accounting/entries':
    case p === '/facilities/bookings':
      return toPage(data)

    case p === '/visitors':
      return mapItems(toPage(data), v => ({
        ...v,
        name: v.name ?? v.visitorName,
        phone: v.phone ?? v.visitorPhone,
        purposeOfVisit: v.purposeOfVisit ?? v.purpose,
      }))

    case p === '/accounting/report': {
      if (!isRec(data)) return data
      const expense = Array.isArray(data.expenseByCategory) ? data.expenseByCategory.filter(isRec) : []
      return {
        period: `${data.year}-${String(data.month).padStart(2, '0')}`,
        totalIncome: num(data.totalIncomePaise),
        totalExpense: num(data.totalExpensePaise),
        netProfit: num(data.netPaise),
        expenseBreakdown: expense.map(e => ({ category: e.category, amount: num(e.amountPaise) })),
        pendingApprovals: num(data.pendingApprovals),
      }
    }

    case p === '/facilities': {
      const page = mapItems(toPage(data, ['facilities']), f => ({
        ...f,
        capacity: f.capacity ?? f.capacityPersons,
        slotDuration: f.slotDuration ?? f.slotDurationMinutes,
      }))
      return { facilities: page.items }
    }

    case p === '/parking/levels': {
      const page = mapItems(toPage(data, ['levels']), l => ({
        ...l,
        occupiedSlots: l.occupiedSlots ?? Math.max(0, num(l.totalSlots) - num(l.availableSlots)),
      }))
      return { levels: page.items }
    }

    case p === '/marketplace/listings':
      return mapItems(toPage(data), l => ({
        ...l,
        price: l.price ?? l.baseRateRupees,
        rating: l.rating ?? l.averageRating,
      }))

    case p === '/social/posts':
      return mapItems(toPage(data), post => ({
        ...post,
        authorName: post.authorName ?? post.authorFlatDisplay ?? 'Resident',
        authorFlat: post.authorFlat ?? post.authorFlatDisplay,
        reactionsCount: post.reactionsCount ?? post.reactionCount ?? 0,
        imageCount: Array.isArray(post.imageUrls) ? post.imageUrls.length : 0,
      }))

    case p === '/wallet/balance': {
      if (!isRec(data)) return data
      return { balance: num(data.balanceRupees), currency: 'INR', lastUpdated: data.lastUpdated ?? '' }
    }

    case p === '/wallet/transactions':
      return mapItems(toPage(data), t => ({
        id: t.id,
        type: t.direction ?? t.type,
        amount: t.amount ?? num(t.amountPaise) / 100,
        description: t.description,
        refTransactionId: t.referenceId,
        timestamp: t.timestamp ?? t.createdAt,
      }))

    default:
      return data
  }
}
