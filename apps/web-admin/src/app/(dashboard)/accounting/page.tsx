'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Plus, BookOpen, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { isAdminUser } from '@/lib/roles'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal, Field } from '@/components/ui/Modal'
import { Table, Thead, Tbody, Th, Td, Tr } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  canDecide, canReopen, entryEditError, ledgerTotals, monthQuery, monthValue, needsApproval, statusText, toLedgerRows, toPaise,
  type ApiLedgerEntry, type LedgerRow,
} from '@/lib/ledger'

interface LedgerEntriesPage { items: ApiLedgerEntry[]; total: number; page: number; pageSize: number }

// API monthly report (adapted): { period, totalIncome, totalExpense, netProfit, ... }
interface MonthlyReportDto { totalIncome: number; totalExpense: number; netProfit: number }
interface PnL { month: string; income: number; expense: number; net: number }

type Tab = 'ledger' | 'expenses' | 'pnl'

const EXPENSE_CATEGORIES = ['maintenance', 'utilities', 'salary', 'security', 'event', 'legal', 'insurance', 'other']
const INCOME_CATEGORIES  = ['maintenance', 'collection', 'penalty', 'interest', 'other']

const selectClass =
  'min-h-[40px] w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-saffron'

export default function AccountingPage() {
  const qc = useQueryClient()
  const isAdmin = isAdminUser(getUser())
  const [tab, setTab]             = useState<Tab>('ledger')
  const [month, setMonth]         = useState(monthValue())
  const [rejecting, setRejecting] = useState<{ id: string; title: string } | null>(null)
  const [showAdd, setShowAdd]     = useState(false)
  const [editing, setEditing]     = useState<LedgerRow | null>(null)

  const { month: m, year: y } = monthQuery(month)

  const { data: ledgerPage, isLoading } = useQuery<LedgerEntriesPage>({
    queryKey: ['accounting', 'ledger', month],
    queryFn:  () => api.get(`/accounting/entries?month=${m}&year=${y}&pageSize=200`),
    enabled:  tab === 'ledger',
  })
  const ledger = toLedgerRows(ledgerPage?.items ?? [])

  const { data: pendingPage } = useQuery<LedgerEntriesPage>({
    queryKey: ['accounting', 'expenses'],
    queryFn:  () => api.get('/accounting/entries?pendingOnly=true&pageSize=200'),
    enabled:  tab === 'expenses',
  })
  const pending = pendingPage?.items ?? []

  // P&L tab: the API returns one month at a time, so the last six months are fetched together.
  const { data: pnl = [] } = useQuery<PnL[]>({
    queryKey: ['accounting', 'pnl'],
    queryFn: async () => {
      const today = new Date()
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1)
        return { month: d.getMonth() + 1, year: d.getFullYear(), label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }) }
      })
      const reports = await Promise.all(months.map(x =>
        api.get<MonthlyReportDto>(`/accounting/report?month=${x.month}&year=${x.year}`)))
      return months.map((x, i) => ({ month: x.label, income: reports[i].totalIncome, expense: reports[i].totalExpense, net: reports[i].netProfit }))
    },
    enabled: tab === 'pnl',
  })

  // Every change refreshes all accounting screens, so what is shown always matches the server.
  const refresh = () => qc.invalidateQueries({ queryKey: ['accounting'] })

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/accounting/entries/${id}/approve`, {}),
    onSuccess:  () => { toast.success('Expense approved'); refresh() },
    onError:    (e: Error) => { toast.error(e.message); refresh() },
  })

  const reject = useMutation({
    mutationFn: (v: { id: string; reason: string }) => api.post(`/accounting/entries/${v.id}/reject`, { reason: v.reason }),
    onSuccess:  () => { toast.success('Expense rejected'); refresh(); setRejecting(null) },
    onError:    (e: Error) => { toast.error(e.message); refresh(); setRejecting(null) },
  })

  const reopen = useMutation({
    mutationFn: (id: string) => api.post(`/accounting/entries/${id}/reopen`, {}),
    onSuccess:  () => { toast.success('Reopened. It is waiting for approval again.'); refresh() },
    onError:    (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/accounting/entries/${id}`),
    onSuccess:  () => { toast.success('Entry deleted'); refresh() },
    onError:    (e: Error) => toast.error(e.message),
  })

  const totals = ledgerTotals(ledger)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Accounting"
        description="Society ledger, expense approvals, and P&L"
        action={<Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> New entry</Button>}
      />

      <div className="grid grid-cols-3 gap-4">
        <Summary label="Income (approved)" value={formatCurrency(totals.income)} tone="good" />
        <Summary label="Expenses (approved)" value={formatCurrency(totals.expense)} tone="bad" />
        <Summary label="Balance this month" value={formatCurrency(Math.abs(totals.balance))} tone={totals.balance >= 0 ? 'brand' : 'bad'} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-fit gap-1 rounded-xl bg-surface-alt p-1">
          {(['ledger', 'expenses', 'pnl'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('rounded-lg px-4 py-2 text-sm font-medium transition', tab === t ? 'bg-surface text-ink shadow-sm' : 'text-mute hover:text-ink')}>
              {t === 'pnl' ? 'P&L' : t === 'expenses' ? 'Approvals' : 'Ledger'}
            </button>
          ))}
        </div>
        {tab === 'ledger' && (
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} aria-label="Month"
            className="min-h-[40px] rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-saffron" />
        )}
      </div>

      {tab === 'ledger' && (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {ledger.length === 0 && !isLoading ? (
            <EmptyState icon={BookOpen} title="No entries this month" description="Pick another month, or add an entry with New entry." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Date</Th>
                  <Th>Description</Th>
                  <Th>Category</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Debit</Th>
                  <Th className="text-right">Credit</Th>
                  <Th className="text-right">Balance</Th>
                  {isAdmin && <Th><span className="sr-only">Actions</span></Th>}
                </Tr>
              </Thead>
              <Tbody>
                {ledger.map(e => {
                  const counted = e.status === 'Approved'
                  return (
                    <Tr key={e.id} className={cn(!counted && 'opacity-80')}>
                      <Td>{formatDate(e.date)}</Td>
                      <Td>
                        <p className="font-medium text-ink">{e.description}</p>
                        {e.status === 'Rejected' && e.rejectionReason && <p className="text-xs text-bad">Rejected: {e.rejectionReason}</p>}
                      </Td>
                      <Td><Badge label={e.category} /></Td>
                      <Td><Badge label={statusText(e.status)} /></Td>
                      <Td className={cn('text-right', counted ? 'text-bad' : 'text-mute')}>
                        {e.type === 'Expense' ? <span className={cn(!counted && 'line-through')}>{formatCurrency(e.amountPaise)}</span> : '—'}
                      </Td>
                      <Td className={cn('text-right', counted ? 'text-good' : 'text-mute')}>
                        {e.type === 'Income' ? <span className={cn(!counted && 'line-through')}>{formatCurrency(e.amountPaise)}</span> : '—'}
                      </Td>
                      <Td className={cn('text-right font-semibold', e.balance >= 0 ? 'text-ink' : 'text-bad')}>{formatCurrency(e.balance)}</Td>
                      {isAdmin && (
                        <Td>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" className="min-h-[32px] px-2" aria-label={`Edit ${e.description}`} title="Edit" onClick={() => setEditing(e)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {canReopen(e) && (
                              <Button variant="ghost" className="min-h-[32px] px-2" aria-label={`Reopen ${e.description}`} title="Reopen: take back the decision"
                                loading={reopen.isPending && reopen.variables === e.id}
                                onClick={() => { if (confirm(`Take back the decision on "${e.description}" so it can be approved or rejected again?`)) reopen.mutate(e.id) }}>
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" className="min-h-[32px] px-2 text-bad" aria-label={`Delete ${e.description}`} title="Delete"
                              loading={remove.isPending && remove.variables === e.id}
                              onClick={() => { if (confirm(`Delete "${e.description}"? It disappears from the ledger and the reports.`)) remove.mutate(e.id) }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </Td>
                      )}
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          )}
        </div>
      )}

      {tab === 'expenses' && (
        <div className="space-y-3">
          {pending.length === 0 ? (
            <div className="rounded-xl border border-line bg-surface">
              <EmptyState icon={CheckCircle2} title="Nothing waiting for approval" description="Expenses above ₹10,000 appear here until someone approves or rejects them." />
            </div>
          ) : pending.map(exp => (
            <div key={exp.id} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h3 className="font-semibold text-ink">{exp.description}</h3>
                    <Badge label={statusText(exp.status)} />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-mute">
                    <span>{exp.type}</span>
                    <Badge label={exp.category} />
                    <span>{formatDate(exp.entryDate)}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xl font-bold text-ink">{formatCurrency(exp.amountPaise)}</p>
                  {canDecide(exp.status) && (
                    <div className="mt-2 flex gap-2">
                      <Button variant="danger" className="min-h-[32px] px-3 text-xs" disabled={reject.isPending}
                        onClick={() => setRejecting({ id: exp.id, title: exp.description })}>
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                      <Button variant="secondary" className="min-h-[32px] px-3 text-xs" loading={approve.isPending && approve.variables === exp.id}
                        onClick={() => approve.mutate(exp.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'pnl' && (
        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="mb-4 font-semibold text-ink">Last 6 months</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={pnl} barSize={20} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#8893A8" strokeOpacity={0.25} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(val: number) => [formatCurrency(val), '']} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income"  fill="#22c55e" name="Income"  radius={[3, 3, 0, 0]} />
              <Bar dataKey="expense" fill="#f87171" name="Expense" radius={[3, 3, 0, 0]} />
              <Bar dataKey="net"     fill="#2563eb" name="Net"     radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {showAdd && <CreateEntryModal onClose={() => setShowAdd(false)} onCreated={() => { refresh(); setShowAdd(false) }} />}
      {editing && <EditEntryModal entry={editing} onClose={() => setEditing(null)} onSaved={() => { refresh(); setEditing(null) }} />}
      {rejecting && (
        <RejectExpenseModal
          title={rejecting.title}
          isPending={reject.isPending}
          onClose={() => setRejecting(null)}
          onConfirm={reason => reject.mutate({ id: rejecting.id, reason })}
        />
      )}
    </div>
  )
}

function Summary({ label, value, tone }: { label: string; value: string; tone: 'good' | 'bad' | 'brand' }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="mb-1 text-xs text-mute">{label}</p>
      <p className={cn('text-2xl font-bold', tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-brand-600')}>{value}</p>
    </div>
  )
}

// ── New entry ─────────────────────────────────────────────────────────────────
function CreateEntryModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [type, setType]           = useState<'Income' | 'Expense'>('Expense')
  const [category, setCategory]   = useState('maintenance')
  const [description, setDesc]    = useState('')
  const [amount, setAmount]       = useState('')
  const [date, setDate]           = useState(today)
  const [showError, setShowError] = useState(false)

  const error = entryEditError({ category, description, amount, date })
  const categories = type === 'Income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  const save = useMutation({
    mutationFn: () => api.post('/accounting/entries', {
      entryDate: date, type, category, description: description.trim(), amountPaise: toPaise(amount),
    }),
    onSuccess: () => {
      toast.success(needsApproval(type, Number(amount)) ? 'Saved. It is waiting for approval.' : 'Entry saved')
      onCreated()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Modal title="New ledger entry" onClose={onClose}>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (error) setShowError(true); else save.mutate() }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
          <Field label="Type">
            <select className={selectClass} value={type} onChange={e => { setType(e.target.value as 'Income' | 'Expense'); setCategory('other') }}>
              <option value="Expense">Expense</option>
              <option value="Income">Income</option>
            </select>
          </Field>
        </div>
        <Field label="Category">
          <select className={selectClass} value={category} onChange={e => setCategory(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Description"><Input value={description} onChange={e => setDesc(e.target.value)} placeholder="Lift AMC payment" maxLength={500} autoFocus /></Field>
        <Field label="Amount (₹)" hint={type === 'Expense' ? 'Expenses above ₹10,000 wait for approval.' : undefined}>
          <Input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
        </Field>
        {showError && error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={save.isPending}>Save entry</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Correct an entry (admin) ──────────────────────────────────────────────────
function EditEntryModal({ entry, onClose, onSaved }: { entry: LedgerRow; onClose: () => void; onSaved: () => void }) {
  const [category, setCategory]   = useState(entry.category)
  const [description, setDesc]    = useState(entry.description)
  const [amount, setAmount]       = useState(String(entry.amountPaise / 100))
  const [date, setDate]           = useState(entry.date.slice(0, 10))
  const [showError, setShowError] = useState(false)

  const error = entryEditError({ category, description, amount, date })
  const categories = Array.from(new Set([entry.category, ...(entry.type === 'Income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)]))
  const resubmits = entry.type === 'Expense' && (toPaise(amount) !== entry.amountPaise || entry.status === 'Rejected')

  const save = useMutation({
    mutationFn: () => api.put(`/accounting/entries/${entry.id}`, { category, description: description.trim(), amountPaise: toPaise(amount), entryDate: date }),
    onSuccess: () => { toast.success('Entry updated'); onSaved() },
    onError:   (e: Error) => toast.error(e.message),
  })

  return (
    <Modal title={`Edit ${entry.type.toLowerCase()}`} onClose={onClose}>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (error) setShowError(true); else save.mutate() }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
          <Field label="Category">
            <select className={selectClass} value={category} onChange={e => setCategory(e.target.value)}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Description"><Input value={description} onChange={e => setDesc(e.target.value)} maxLength={500} autoFocus /></Field>
        <Field label="Amount (₹)"><Input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
        {resubmits && needsApproval(entry.type, Number(amount)) && (
          <p className="text-xs text-mute">This is above ₹10,000, so after saving it waits for approval again.</p>
        )}
        {showError && error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={save.isPending}>Save changes</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Reject an expense, with a reason ──────────────────────────────────────────
function RejectExpenseModal({
  title, onClose, onConfirm, isPending,
}: { title: string; onClose: () => void; onConfirm: (reason: string) => void; isPending: boolean }) {
  const [reason, setReason] = useState('')
  return (
    <Modal title="Reject expense" onClose={onClose}>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (reason.trim().length >= 3) onConfirm(reason.trim()) }}>
        <p className="truncate text-sm text-mute">{title}</p>
        <Field label="Reason" hint="Shown next to the entry, for example: missing invoice, wrong category.">
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} autoFocus
            className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-saffron" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" loading={isPending} disabled={reason.trim().length < 3}>Reject expense</Button>
        </div>
      </form>
    </Modal>
  )
}
