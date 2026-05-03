'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, CheckCircle2, XCircle, Plus, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Table, Thead, Tbody, Th, Td, Tr } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// ── Types — aligned with API (LedgerEntryDto + MonthlyReportDto) ─────────────
// API entry: { id, entryDate, type:'Income'|'Expense', category, description, amountPaise, status }
interface ApiLedgerEntry {
  id:          string
  entryDate:   string
  type:        'Income' | 'Expense'
  category:    string
  description: string
  amountPaise: number
  status:      'PendingApproval' | 'Approved' | 'Rejected'
  referenceDoc?: string | null
}

interface LedgerEntriesPage { items: ApiLedgerEntry[]; total: number; page: number; pageSize: number }

// UI-shaped row used by the ledger table (with debit/credit/running balance derived client-side).
interface LedgerEntry {
  id:          string
  date:        string
  description: string
  category:    string
  debit:       number   // paise
  credit:      number   // paise
  balance:     number   // paise
  reference?:  string
  status?:     string
}

// API monthly report: { period, totalIncome, totalExpense, netProfit, expenseBreakdown[], pendingApprovals }
interface MonthlyReportDto {
  period:        string
  totalIncome:   number
  totalExpense:  number
  netProfit:     number
  expenseBreakdown: { category: string; amount: number }[]
  pendingApprovals: number
}

interface PnL {
  month:   string
  income:  number
  expense: number
  net:     number
}

type Tab = 'ledger' | 'expenses' | 'pnl'

// Helper: turn server LedgerEntryDto[] (paged) into UI rows w/ debit/credit/running balance.
function toLedgerRows(items: ApiLedgerEntry[]): LedgerEntry[] {
  // Process oldest → newest so the running balance accumulates correctly.
  const sorted = [...items].sort((a, b) =>
    new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())
  let running = 0
  const rows: LedgerEntry[] = sorted.map(e => {
    const credit = e.type === 'Income'  ? e.amountPaise : 0
    const debit  = e.type === 'Expense' ? e.amountPaise : 0
    running += credit - debit
    return {
      id:          e.id,
      date:        e.entryDate,
      description: e.description,
      category:    e.category,
      debit, credit,
      balance:     running,
      reference:   e.referenceDoc ?? undefined,
      status:      e.status,
    }
  })
  // Render newest first in the table.
  return rows.reverse()
}

export default function AccountingPage() {
  const qc = useQueryClient()
  const [tab, setTab]           = useState<Tab>('ledger')
  const [rejecting, setRejecting] = useState<{ id: string; title: string } | null>(null)
  const [showAddEntry, setShowAddEntry] = useState(false)

  const { data: ledgerPage } = useQuery<LedgerEntriesPage>({
    queryKey: ['accounting', 'ledger'],
    queryFn:  () => api.get('/accounting/entries'),
    enabled:  tab === 'ledger',
  })
  const ledger: LedgerEntry[] = ledgerPage?.items
    ? toLedgerRows(ledgerPage.items)
    : DEMO_LEDGER

  const { data: pendingPage } = useQuery<LedgerEntriesPage>({
    queryKey: ['accounting', 'expenses'],
    queryFn:  () => api.get('/accounting/entries?pendingOnly=true'),
    enabled:  tab === 'expenses',
  })

  // P&L tab: API returns ONE month at a time. Fetch the last 6 months in parallel.
  const { data: pnl = DEMO_PNL } = useQuery<PnL[]>({
    queryKey: ['accounting', 'pnl'],
    queryFn: async () => {
      const today = new Date()
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1)
        return { month: d.getMonth() + 1, year: d.getFullYear(), label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }) }
      })
      const reports = await Promise.all(months.map(m =>
        api.get<MonthlyReportDto>(`/accounting/report?month=${m.month}&year=${m.year}`)
      ))
      return months.map((m, i) => ({
        month:   m.label,
        income:  reports[i].totalIncome,
        expense: reports[i].totalExpense,
        net:     reports[i].netProfit,
      }))
    },
    enabled:  tab === 'pnl',
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/accounting/entries/${id}/approve`, {}),
    onSuccess:  () => { toast.success('Expense approved'); qc.invalidateQueries({ queryKey: ['accounting'] }) },
    onError:    (e: Error) => toast.error(e.message),
  })

  // API requires { rejectionReason: string }
  const rejectMutation = useMutation({
    mutationFn: (input: { id: string; rejectionReason: string }) =>
      api.post(`/accounting/entries/${input.id}/reject`, { rejectionReason: input.rejectionReason }),
    onSuccess:  () => { toast.success('Expense rejected'); qc.invalidateQueries({ queryKey: ['accounting'] }); setRejecting(null) },
    onError:    (e: Error) => toast.error(e.message),
  })

  const totalIncome    = ledger.reduce((s, e) => s + e.credit, 0)
  const totalExpense   = ledger.reduce((s, e) => s + e.debit,  0)
  // After toLedgerRows() the array is reversed (newest first), so the latest balance is at index 0.
  const currentBalance = ledger[0]?.balance ?? 0

  return (
    <div className="space-y-5">
      <PageHeader
        title="Accounting"
        description="Society ledger, expense approvals, and P&L"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddEntry(true)}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> New Entry
            </button>
            <button className="flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Total Income (YTD)</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Total Expenses (YTD)</p>
          <p className="text-2xl font-bold text-red-500">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Current Balance</p>
          <p className={`text-2xl font-bold ${currentBalance >= 0 ? 'text-brand-600' : 'text-red-600'}`}>
            {formatCurrency(Math.abs(currentBalance))}
          </p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['ledger', 'expenses', 'pnl'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium capitalize transition',
              tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {t === 'pnl' ? 'P&L' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Ledger tab ──────────────────────────────────────────────────────── */}
      {tab === 'ledger' && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
          {ledger.length === 0 ? (
            <EmptyState icon={BookOpen} title="No transactions yet" />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Date</Th>
                  <Th>Description</Th>
                  <Th>Category</Th>
                  <Th>Reference</Th>
                  <Th className="text-right">Debit</Th>
                  <Th className="text-right">Credit</Th>
                  <Th className="text-right">Balance</Th>
                </Tr>
              </Thead>
              <Tbody>
                {ledger.map(e => (
                  <Tr key={e.id}>
                    <Td>{formatDate(e.date)}</Td>
                    <Td className="font-medium text-gray-800">{e.description}</Td>
                    <Td><Badge label={e.category} /></Td>
                    <Td className="text-gray-400 text-xs">{e.reference ?? '—'}</Td>
                    <Td className="text-right text-red-500">{e.debit  ? formatCurrency(e.debit)  : '—'}</Td>
                    <Td className="text-right text-green-600">{e.credit ? formatCurrency(e.credit) : '—'}</Td>
                    <Td className={`text-right font-semibold ${e.balance >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                      {formatCurrency(e.balance)}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </div>
      )}

      {/* ── Expense approvals tab ───────────────────────────────────────────── */}
      {tab === 'expenses' && (
        <div className="space-y-3">
          {(() => {
            const pending = pendingPage?.items ?? DEMO_PENDING
            if (pending.length === 0) return (
              <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
                <EmptyState icon={Plus} title="No expense requests" />
              </div>
            )
            return pending.map(exp => (
              <div key={exp.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-800">{exp.description}</h3>
                      <Badge label={exp.status} />
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                      <span>Type: <Badge label={exp.type} /></span>
                      <span>Category: <Badge label={exp.category} /></span>
                      <span>{formatDate(exp.entryDate)}</span>
                    </div>
                    {exp.referenceDoc && <p className="text-xs text-gray-400 mt-2">Ref: {exp.referenceDoc}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(exp.amountPaise)}</p>
                    {exp.status === 'PendingApproval' && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => setRejecting({ id: exp.id, title: exp.description })}
                          disabled={rejectMutation.isPending}
                          className="flex items-center gap-1 text-xs text-red-600 border border-red-200 hover:bg-red-50 px-2 py-1.5 rounded-lg"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                        <button
                          onClick={() => approveMutation.mutate(exp.id)}
                          disabled={approveMutation.isPending}
                          className="flex items-center gap-1 text-xs text-green-700 border border-green-200 hover:bg-green-50 px-2 py-1.5 rounded-lg"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          })()}
        </div>
      )}

      {/* New Ledger Entry modal */}
      {showAddEntry && (
        <CreateEntryModal
          onClose={() => setShowAddEntry(false)}
          onCreated={() => { qc.invalidateQueries({ queryKey: ['accounting'] }); setShowAddEntry(false) }}
        />
      )}

      {/* Reject-with-reason modal */}
      {rejecting && (
        <RejectExpenseModal
          title={rejecting.title}
          isPending={rejectMutation.isPending}
          onClose={() => setRejecting(null)}
          onConfirm={reason => rejectMutation.mutate({ id: rejecting.id, rejectionReason: reason })}
        />
      )}

      {/* ── P&L tab ─────────────────────────────────────────────────────────── */}
      {tab === 'pnl' && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Monthly P&L — FY 2025-26</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={pnl} barSize={20} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(val: number) => [formatCurrency(val), '']} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income"  fill="#22c55e" name="Income"  radius={[3,3,0,0]} />
              <Bar dataKey="expense" fill="#f87171" name="Expense" radius={[3,3,0,0]} />
              <Bar dataKey="net"     fill="#2563eb" name="Net"     radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs text-gray-500 uppercase font-semibold">Month</th>
                  <th className="text-right py-2 text-xs text-gray-500 uppercase font-semibold">Income</th>
                  <th className="text-right py-2 text-xs text-gray-500 uppercase font-semibold">Expense</th>
                  <th className="text-right py-2 text-xs text-gray-500 uppercase font-semibold">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pnl.map(row => (
                  <tr key={row.month}>
                    <td className="py-2">{row.month}</td>
                    <td className="py-2 text-right text-green-600">{formatCurrency(row.income)}</td>
                    <td className="py-2 text-right text-red-500">{formatCurrency(row.expense)}</td>
                    <td className={`py-2 text-right font-semibold ${row.net >= 0 ? 'text-brand-600' : 'text-red-600'}`}>
                      {formatCurrency(row.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Create Ledger Entry Modal ─────────────────────────────────────────────────
// API: POST /accounting/entries — { entryDate, type, category, description, amountPaise, referenceDoc? }
const EXPENSE_CATEGORIES = ['maintenance', 'utilities', 'salary', 'security', 'event', 'legal', 'insurance', 'other']
const INCOME_CATEGORIES  = ['maintenance', 'collection', 'penalty', 'interest', 'other']

interface EntryForm {
  entryDate:    string
  type:         'Income' | 'Expense'
  category:     string
  description:  string
  amountRupees: number   // UI in rupees; converted to paise before POST
  referenceDoc: string
}

function CreateEntryModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState<EntryForm>({
    entryDate: today, type: 'Expense', category: 'maintenance',
    description: '', amountRupees: 0, referenceDoc: '',
  })
  const set = <K extends keyof EntryForm>(k: K, v: EntryForm[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const categories = form.type === 'Income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  const mutation = useMutation({
    mutationFn: () => api.post('/accounting/entries', {
      entryDate:    form.entryDate,
      type:         form.type,
      category:     form.category,
      description:  form.description.trim(),
      amountPaise:  Math.round(form.amountRupees * 100),
      referenceDoc: form.referenceDoc.trim() || null,
    }),
    onSuccess: () => { toast.success('Entry created'); onCreated() },
    onError:   (e: Error) => toast.error(e.message),
  })

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
  const isValid = form.description.trim().length >= 3 && form.amountRupees > 0

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="font-semibold text-lg">New Ledger Entry</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input type="date" value={form.entryDate} onChange={e => set('entryDate', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select value={form.type} onChange={e => { set('type', e.target.value as 'Income' | 'Expense'); set('category', 'other') }} className={inputClass}>
              <option value="Expense">Expense</option>
              <option value="Income">Income</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)} className={inputClass}>
            {categories.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <input value={form.description} onChange={e => set('description', e.target.value)}
            placeholder="Lift AMC payment — Apr 2026" className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Amount (₹)</label>
          <input type="number" min={1} value={form.amountRupees || ''}
            onChange={e => set('amountRupees', Number(e.target.value))}
            placeholder="0" className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Reference Doc <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
          <input value={form.referenceDoc} onChange={e => set('referenceDoc', e.target.value)}
            placeholder="INV-2041" className={inputClass} />
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 border border-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !isValid}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60"
          >
            {mutation.isPending ? 'Saving…' : 'Save Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Reject expense modal ──────────────────────────────────────────────────────
function RejectExpenseModal({
  title, onClose, onConfirm, isPending,
}: { title: string; onClose: () => void; onConfirm: (reason: string) => void; isPending: boolean }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="font-semibold text-lg">Reject expense</h2>
        <p className="text-sm text-gray-500 truncate">{title}</p>
        <div>
          <label className="block text-sm font-medium mb-1">Reason <span className="text-red-500">*</span></label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="Missing invoice / wrong category / etc."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 border border-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={isPending || reason.trim().length < 3}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60"
          >
            {isPending ? 'Rejecting…' : 'Reject expense'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_LEDGER: LedgerEntry[] = [
  { id: '1', date: '2026-04-01', description: 'Opening balance',             category: 'balance',      debit: 0,          credit: 0,          balance: 485000_00, reference: 'FY2026' },
  { id: '2', date: '2026-04-01', description: 'April maintenance bills',     category: 'maintenance',  debit: 0,          credit: 560000_00,  balance: 1045000_00                    },
  { id: '3', date: '2026-04-03', description: 'Lift AMC payment',            category: 'maintenance',  debit: 22000_00,   credit: 0,          balance: 1023000_00, reference: 'INV-2041' },
  { id: '4', date: '2026-04-07', description: 'Maintenance collections',     category: 'collection',   debit: 0,          credit: 320000_00,  balance: 1343000_00                    },
  { id: '5', date: '2026-04-10', description: 'Security staff salaries',     category: 'salary',       debit: 85000_00,   credit: 0,          balance: 1258000_00                    },
  { id: '6', date: '2026-04-15', description: 'Electricity bill — common',   category: 'utilities',    debit: 18500_00,   credit: 0,          balance: 1239500_00, reference: 'MSEB-Apr26' },
  { id: '7', date: '2026-04-20', description: 'Garden maintenance',          category: 'maintenance',  debit: 8000_00,    credit: 0,          balance: 1231500_00                    },
  { id: '8', date: '2026-04-25', description: 'Late fee collections',        category: 'collection',   debit: 0,          credit: 5000_00,    balance: 1236500_00                    },
]

const DEMO_PENDING: ApiLedgerEntry[] = [
  { id: '1', entryDate: '2026-04-26', type: 'Expense', category: 'maintenance', description: 'Emergency pump repair',     amountPaise: 15000_00, status: 'PendingApproval', referenceDoc: 'INV-PUMP-0426' },
  { id: '2', entryDate: '2026-04-24', type: 'Expense', category: 'security',    description: 'CCTV camera replacement',   amountPaise: 28000_00, status: 'PendingApproval', referenceDoc: 'INV-CCTV-0424' },
  { id: '3', entryDate: '2025-10-20', type: 'Expense', category: 'event',       description: 'Society event — Diwali 25', amountPaise: 12000_00, status: 'Approved' },
  { id: '4', entryDate: '2026-04-10', type: 'Expense', category: 'maintenance', description: 'Pest control — quarterly',  amountPaise: 6500_00,  status: 'Approved' },
]

const DEMO_PNL: PnL[] = [
  { month: 'Nov 25', income: 510000_00, expense: 118000_00, net: 392000_00 },
  { month: 'Dec 25', income: 520000_00, expense: 135000_00, net: 385000_00 },
  { month: 'Jan 26', income: 540000_00, expense: 142000_00, net: 398000_00 },
  { month: 'Feb 26', income: 535000_00, expense: 120000_00, net: 415000_00 },
  { month: 'Mar 26', income: 545000_00, expense: 155000_00, net: 390000_00 },
  { month: 'Apr 26', income: 565000_00, expense: 133500_00, net: 431500_00 },
]
