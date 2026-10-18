export type EntryStatus = 'PendingApproval' | 'Approved' | 'Rejected'

/** One ledger entry as the server sends it. */
export interface ApiLedgerEntry {
  id: string
  entryDate: string
  type: 'Income' | 'Expense'
  category: string
  description: string
  amountPaise: number
  status: EntryStatus
  referenceDoc?: string | null
  rejectionReason?: string | null
}

/** A row of the ledger table, with debit / credit and the running balance worked out. */
export interface LedgerRow {
  id: string
  date: string
  type: 'Income' | 'Expense'
  description: string
  category: string
  amountPaise: number
  debit: number
  credit: number
  balance: number
  reference?: string
  status: EntryStatus
  rejectionReason?: string
}

/**
 * Oldest to newest, so the balance accumulates in order; returned newest first for the table.
 * Only approved entries move the balance: a rejected or waiting expense has not been spent yet.
 */
export function toLedgerRows(items: ApiLedgerEntry[]): LedgerRow[] {
  const sorted = [...items].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())
  let running = 0
  const rows = sorted.map(e => {
    const counts = e.status === 'Approved'
    const credit = counts && e.type === 'Income' ? e.amountPaise : 0
    const debit = counts && e.type === 'Expense' ? e.amountPaise : 0
    running += credit - debit
    return {
      id: e.id, date: e.entryDate, type: e.type, description: e.description, category: e.category,
      amountPaise: e.amountPaise, debit, credit, balance: running,
      reference: e.referenceDoc ?? undefined, status: e.status, rejectionReason: e.rejectionReason ?? undefined,
    }
  })
  return rows.reverse()
}

export function ledgerTotals(rows: LedgerRow[]): { income: number; expense: number; balance: number } {
  const income = rows.reduce((s, r) => s + r.credit, 0)
  const expense = rows.reduce((s, r) => s + r.debit, 0)
  return { income, expense, balance: income - expense }
}

export const statusText = (s: EntryStatus): string =>
  s === 'PendingApproval' ? 'Waiting for approval' : s === 'Approved' ? 'Approved' : 'Rejected'

/** Approve / reject apply only while an entry is waiting. */
export const canDecide = (s: EntryStatus): boolean => s === 'PendingApproval'

/** A decision can be taken back for an expense that is no longer waiting. */
export const canReopen = (r: Pick<LedgerRow, 'type' | 'status'>): boolean => r.type === 'Expense' && r.status !== 'PendingApproval'

/** Expenses above this many rupees wait for approval (same rule as the server). */
export const APPROVAL_LIMIT_RUPEES = 10_000

export const needsApproval = (type: 'Income' | 'Expense', rupees: number): boolean => type === 'Expense' && rupees > APPROVAL_LIMIT_RUPEES

/** "2026-10" for the month input. */
export const monthValue = (d: Date = new Date()): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/** "2026-10" becomes month 10 of year 2026 for the query; an unusable value means the current month. */
export function monthQuery(value: string): { month: number; year: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(value)
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) {
    const now = new Date()
    return { month: now.getMonth() + 1, year: now.getFullYear() }
  }
  return { month: Number(m[2]), year: Number(m[1]) }
}

export interface EntryEditValues { category: string; description: string; amount: string; date: string }

/** Returns the first problem in plain words, or null when the correction can be saved. */
export function entryEditError(v: EntryEditValues): string | null {
  if (v.description.trim().length < 3) return 'Describe the entry in a few words.'
  if (!v.category.trim()) return 'Choose a category.'
  const amount = Number(v.amount)
  if (!v.amount.trim() || !Number.isFinite(amount) || amount <= 0) return 'Enter the amount in rupees.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return 'Choose the date.'
  return null
}

/** Whole paise from a rupee amount typed by a person (₹1,234.5 is 123450 paise). */
export const toPaise = (rupees: string | number): number => Math.round(Number(rupees) * 100)
