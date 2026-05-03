'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Download, Search, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { formatCurrency, formatDate, statusColor } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Table, Thead, Tbody, Th, Td, Tr } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types — aligned with API BillDto ─────────────────────────────────────────
// GET /billing/bills → { items: ApiBillDto[], total, page, pageSize (or limit) }
// ApiBillDto: { id, flatId, period:"YYYY-MM", amountRupees, dueDate:"YYYY-MM-DD", status }
interface ApiBillDto {
  id:           string
  flatId:       string
  period:       string   // "YYYY-MM"
  amountRupees: number
  dueDate:      string   // "YYYY-MM-DD"
  status:       'Pending' | 'Paid' | 'Overdue'
}

interface ApiBillPage {
  items:    ApiBillDto[]
  total:    number
  page:     number
  pageSize?: number
  limit?:   number
}

// UI-shaped row used by the table.
// API doesn't join flat/owner names in the list endpoint — we show flatId until a join exists.
interface Bill {
  id:          string
  flatDisplay: string   // flatId for now; will be flatNumber once backend joins
  period:      string   // "YYYY-MM" — shown as bill date
  dueDate:     string
  amountRupees: number
  status:      'Pending' | 'Paid' | 'Overdue'
}

function toUiBill(a: ApiBillDto): Bill {
  return {
    id:           a.id,
    flatDisplay:  a.flatId,   // fallback until /billing/bills returns flatNumber
    period:       a.period,
    dueDate:      a.dueDate,
    amountRupees: a.amountRupees,
    status:       a.status,
  }
}

// API accepts "all" | "Pending" | "Paid" | "Overdue" for the status filter
type FilterStatus = 'all' | 'Pending' | 'Paid' | 'Overdue'

export default function BillingPage() {
  const qc = useQueryClient()
  const [search,  setSearch]  = useState('')
  const [status,  setStatus]  = useState<FilterStatus>('all')
  const [page,    setPage]    = useState(1)
  const [showGen, setShowGen] = useState(false)

  // API: GET /billing/bills?status=&search=&page=&limit=
  // Response: { items: ApiBillDto[], total, page, pageSize }
  const { data, isLoading } = useQuery<ApiBillPage>({
    queryKey: ['bills', status, search, page],
    queryFn: () => api.get<ApiBillPage>(
      `/billing/bills?status=${status}&search=${encodeURIComponent(search)}&page=${page}&limit=20`
    ),
    placeholderData: prev => prev,
  })

  // Backend contract: POST /billing/generate
  //   { societyId, period:"YYYY-MM", amountPerFlat:decimal, description, dueDate:"YYYY-MM-DD" }
  interface GenerateBillsInput {
    period:        string  // YYYY-MM
    amountPerFlat: number
    description:   string
    dueDate:       string  // YYYY-MM-DD
  }

  const generateMutation = useMutation({
    mutationFn: (input: GenerateBillsInput) => {
      const societyId = getUser()?.societyId
      if (!societyId) throw new Error('Not signed in to a society')
      return api.post('/billing/generate', { societyId, ...input })
    },
    onSuccess: () => {
      toast.success('Bills generated successfully')
      qc.invalidateQueries({ queryKey: ['bills'] })
      setShowGen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Map API DTOs → UI rows; fall back to DEMO when API hasn't responded yet.
  const bills: Bill[] = data?.items ? data.items.map(toUiBill) : DEMO_BILLS

  // Compute totals from UI rows (amountRupees, not paise)
  const summary = {
    total:     bills.reduce((a, b) => a + b.amountRupees, 0),
    collected: bills.filter(b => b.status === 'Paid').reduce((a, b) => a + b.amountRupees, 0),
    pending:   bills.filter(b => b.status !== 'Paid').reduce((a, b) => a + b.amountRupees, 0),
  }

  // Pagination — API returns `total` (count); derive total pages from it.
  const pageSize   = data?.pageSize ?? data?.limit ?? 20
  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1

  return (
    <div className="space-y-5">
      <PageHeader
        title="Billing"
        description="Maintenance bills and payment tracking"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setShowGen(true)}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              <Plus className="w-4 h-4" /> Generate Bills
            </button>
            <button className="flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Billed',    val: summary.total,     color: 'text-gray-900'  },
          { label: 'Collected',       val: summary.collected, color: 'text-green-600' },
          { label: 'Pending/Overdue', val: summary.pending,   color: 'text-red-500'   },
        ].map(c => (
          <div key={c.label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>
              ₹{c.val.toLocaleString('en-IN')}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search flat, owner…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['all', 'Pending', 'Overdue', 'Paid'] as FilterStatus[]).map(s => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1) }}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium capitalize transition',
                status === s ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : bills.length === 0 ? (
          <EmptyState icon={Receipt} title="No bills found" description="Generate bills for the current month to get started." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Flat</Th>
                <Th>Period</Th>
                <Th>Due Date</Th>
                <Th className="text-right">Amount (₹)</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {bills.map(bill => (
                <Tr key={bill.id}>
                  <Td className="font-medium">{bill.flatDisplay}</Td>
                  <Td>{bill.period}</Td>
                  <Td className={bill.status === 'Overdue' ? 'text-red-500 font-medium' : ''}>
                    {formatDate(bill.dueDate)}
                  </Td>
                  <Td className="text-right font-medium">
                    ₹{bill.amountRupees.toLocaleString('en-IN')}
                  </Td>
                  <Td><Badge label={bill.status} /></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={cn(
                'w-8 h-8 rounded-lg text-sm font-medium',
                page === i + 1 ? 'bg-brand-600 text-white' : 'border border-gray-200 hover:bg-gray-50'
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Generate Bills Modal */}
      {showGen && (
        <GenerateBillsModal
          onClose={() => setShowGen(false)}
          onGenerate={input => generateMutation.mutate(input)}
          isPending={generateMutation.isPending}
        />
      )}
    </div>
  )
}

// ── Generate Bills Modal ──────────────────────────────────────────────────────
interface GenerateInput { period: string; amountPerFlat: number; description: string; dueDate: string }

function GenerateBillsModal({
  onClose, onGenerate, isPending,
}: { onClose: () => void; onGenerate: (input: GenerateInput) => void; isPending: boolean }) {
  const today      = new Date()
  const defPeriod  = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  // Default due date = 10th of the period month
  const defDue     = `${defPeriod}-10`

  const [period,        setPeriod]        = useState(defPeriod)
  const [amount,        setAmount]        = useState(2500)
  const [description,   setDescription]   = useState(`Maintenance — ${defPeriod}`)
  const [dueDate,       setDueDate]       = useState(defDue)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="font-semibold text-lg">Generate Monthly Bills</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Billing Period</label>
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Amount per flat (₹)</label>
          <input type="number" min={1} value={amount} onChange={e => setAmount(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <input value={description} onChange={e => setDescription(e.target.value)}
            placeholder="May 2026 Maintenance"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Due date</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>

        <p className="text-xs text-gray-400">
          Bills will be generated for all active flats. Flats already billed for this period will be skipped (idempotent).
        </p>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 border border-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onGenerate({ period, amountPerFlat: amount, description, dueDate })}
            disabled={isPending || !description || amount <= 0}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60"
          >
            {isPending ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Demo data — shape matches UI Bill (already mapped from API) ───────────────
const DEMO_BILLS: Bill[] = [
  { id: '1', flatDisplay: 'flat-a101', period: '2026-04', dueDate: '2026-04-10', amountRupees: 2500, status: 'Paid'    },
  { id: '2', flatDisplay: 'flat-a102', period: '2026-04', dueDate: '2026-04-10', amountRupees: 2500, status: 'Pending' },
  { id: '3', flatDisplay: 'flat-a103', period: '2026-04', dueDate: '2026-04-10', amountRupees: 2500, status: 'Overdue' },
  { id: '4', flatDisplay: 'flat-a104', period: '2026-04', dueDate: '2026-04-10', amountRupees: 2500, status: 'Paid'    },
  { id: '5', flatDisplay: 'flat-a105', period: '2026-04', dueDate: '2026-04-10', amountRupees: 2500, status: 'Pending' },
  { id: '6', flatDisplay: 'flat-b101', period: '2026-04', dueDate: '2026-04-10', amountRupees: 2500, status: 'Paid'    },
  { id: '7', flatDisplay: 'flat-b102', period: '2026-04', dueDate: '2026-04-10', amountRupees: 2500, status: 'Overdue' },
  { id: '8', flatDisplay: 'flat-b103', period: '2026-04', dueDate: '2026-04-10', amountRupees: 2500, status: 'Pending' },
]
