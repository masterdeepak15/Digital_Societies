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

// ── Types ─────────────────────────────────────────────────────────────────────
interface LedgerEntry {
  id:          string
  date:        string
  description: string
  category:    string
  debit:       number   // paise
  credit:      number   // paise
  balance:     number   // paise
  reference?:  string
}

interface ExpenseRequest {
  id:          string
  title:       string
  amount:      number
  category:    string
  requestedBy: string
  submittedAt: string
  status:      'pending' | 'approved' | 'rejected'
  notes?:      string
  receiptUrl?: string
}

interface PnL {
  month:   string
  income:  number
  expense: number
  net:     number
}

type Tab = 'ledger' | 'expenses' | 'pnl'

export default function AccountingPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('ledger')

  const { data: ledger = DEMO_LEDGER } = useQuery<LedgerEntry[]>({
    queryKey: ['accounting', 'ledger'],
    queryFn:  () => api.get('/accounting/entries'),
    enabled:  tab === 'ledger',
  })

  const { data: expenses = DEMO_EXPENSES } = useQuery<ExpenseRequest[]>({
    queryKey: ['accounting', 'expenses'],
    queryFn:  () => api.get('/accounting/entries?pendingOnly=true'),
    enabled:  tab === 'expenses',
  })

  const { data: pnl = DEMO_PNL } = useQuery<PnL[]>({
    queryKey: ['accounting', 'pnl'],
    queryFn:  () => api.get('/accounting/report'),
    enabled:  tab === 'pnl',
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/accounting/entries/${id}/approve`, {}),
    onSuccess:  () => { toast.success('Expense approved'); qc.invalidateQueries({ queryKey: ['accounting'] }) },
    onError:    (e: Error) => toast.error(e.message),
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/accounting/entries/${id}/reject`, {}),
    onSuccess:  () => { toast.success('Expense rejected'); qc.invalidateQueries({ queryKey: ['accounting'] }) },
    onError:    (e: Error) => toast.error(e.message),
  })

  const totalIncome  = ledger.reduce((s, e) => s + e.credit, 0)
  const totalExpense = ledger.reduce((s, e) => s + e.debit,  0)
  const currentBalance = ledger[ledger.length - 1]?.balance ?? 0

  return (
    <div className="space-y-5">
      <PageHeader
        title="Accounting"
        description="Society ledger, expense approvals, and P&L"
        action={
          <button className="flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium">
            <Download className="w-4 h-4" /> Export
          </button>
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
          {expenses.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
              <EmptyState icon={Plus} title="No expense requests" />
            </div>
          ) : (
            expenses.map(exp => (
              <div key={exp.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-800">{exp.title}</h3>
                      <Badge label={exp.status} />
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                      <span>Requested by <b className="text-gray-700">{exp.requestedBy}</b></span>
                      <span>Category: <Badge label={exp.category} /></span>
                      <span>{formatDate(exp.submittedAt)}</span>
                    </div>
                    {exp.notes && <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded-lg p-2">{exp.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(exp.amount)}</p>
                    {exp.status === 'pending' && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => rejectMutation.mutate(exp.id)}
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
          )}
        </div>
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

const DEMO_EXPENSES: ExpenseRequest[] = [
  { id: '1', title: 'Emergency pump repair',     amount: 15000_00, category: 'maintenance', requestedBy: 'Rajesh Sharma', submittedAt: '2026-04-26', status: 'pending',  notes: 'Main water pump failed — needs immediate replacement. Got 2 quotes, this is the lowest.' },
  { id: '2', title: 'CCTV camera replacement',   amount: 28000_00, category: 'security',    requestedBy: 'Sanjay Gupta',  submittedAt: '2026-04-24', status: 'pending',  notes: '3 cameras in Block B parking have malfunctioned.' },
  { id: '3', title: 'Society event — Diwali 25', amount: 12000_00, category: 'event',       requestedBy: 'Rajesh Sharma', submittedAt: '2025-10-20', status: 'approved', notes: 'Diwali celebration event — decorations, sweets, fireworks.' },
  { id: '4', title: 'Pest control — quarterly',  amount: 6500_00,  category: 'maintenance', requestedBy: 'Pooja Verma',   submittedAt: '2026-04-10', status: 'approved'  },
]

const DEMO_PNL: PnL[] = [
  { month: 'Nov 25', income: 510000_00, expense: 118000_00, net: 392000_00 },
  { month: 'Dec 25', income: 520000_00, expense: 135000_00, net: 385000_00 },
  { month: 'Jan 26', income: 540000_00, expense: 142000_00, net: 398000_00 },
  { month: 'Feb 26', income: 535000_00, expense: 120000_00, net: 415000_00 },
  { month: 'Mar 26', income: 545000_00, expense: 155000_00, net: 390000_00 },
  { month: 'Apr 26', income: 565000_00, expense: 133500_00, net: 431500_00 },
]
