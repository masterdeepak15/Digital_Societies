'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Download, Search, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatCurrency, formatDate, statusColor } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Table, Thead, Tbody, Th, Td, Tr } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Bill {
  id:          string
  flatDisplay: string
  ownerName:   string
  billDate:    string
  dueDate:     string
  amount:      number   // paise
  status:      'paid' | 'pending' | 'overdue' | 'partially_paid'
  paidAt?:     string
  paidAmount?: number
}

interface BillPage {
  items:      Bill[]
  totalCount: number
  totalPages: number
}

type FilterStatus = 'all' | 'paid' | 'pending' | 'overdue'

export default function BillingPage() {
  const qc = useQueryClient()
  const [search,  setSearch]  = useState('')
  const [status,  setStatus]  = useState<FilterStatus>('all')
  const [page,    setPage]    = useState(1)
  const [showGen, setShowGen] = useState(false)

  const { data, isLoading } = useQuery<BillPage>({
    queryKey: ['bills', status, search, page],
    queryFn: () => api.get(
      `/billing/bills?status=${status}&search=${encodeURIComponent(search)}&page=${page}&limit=20`
    ),
    placeholderData: prev => prev,
  })

  const generateMutation = useMutation({
    mutationFn: (month: string) => api.post('/billing/bills/generate', { month }),
    onSuccess: () => {
      toast.success('Bills generated successfully')
      qc.invalidateQueries({ queryKey: ['bills'] })
      setShowGen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const bills = data?.items ?? DEMO_BILLS

  const summary = {
    total:     bills.reduce((a, b) => a + b.amount, 0),
    collected: bills.filter(b => b.status === 'paid').reduce((a, b) => a + (b.paidAmount ?? b.amount), 0),
    pending:   bills.filter(b => b.status !== 'paid').reduce((a, b) => a + b.amount, 0),
  }

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
            <p className={`text-2xl font-bold ${c.color}`}>{formatCurrency(c.val)}</p>
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
          {(['all', 'pending', 'overdue', 'paid'] as FilterStatus[]).map(s => (
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
                <Th>Owner / Resident</Th>
                <Th>Bill Date</Th>
                <Th>Due Date</Th>
                <Th className="text-right">Amount</Th>
                <Th className="text-right">Paid</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {bills.map(bill => (
                <Tr key={bill.id}>
                  <Td className="font-medium">{bill.flatDisplay}</Td>
                  <Td>{bill.ownerName}</Td>
                  <Td>{formatDate(bill.billDate)}</Td>
                  <Td className={bill.status === 'overdue' ? 'text-red-500 font-medium' : ''}>
                    {formatDate(bill.dueDate)}
                  </Td>
                  <Td className="text-right font-medium">{formatCurrency(bill.amount)}</Td>
                  <Td className="text-right text-green-600">
                    {bill.paidAmount ? formatCurrency(bill.paidAmount) : '—'}
                  </Td>
                  <Td><Badge label={bill.status} /></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {(data?.totalPages ?? 1) > 1 && (
        <div className="flex justify-center gap-2">
          {[...Array(data!.totalPages)].map((_, i) => (
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
          onGenerate={month => generateMutation.mutate(month)}
          isPending={generateMutation.isPending}
        />
      )}
    </div>
  )
}

// ── Generate Bills Modal ──────────────────────────────────────────────────────
function GenerateBillsModal({
  onClose, onGenerate, isPending,
}: { onClose: () => void; onGenerate: (month: string) => void; isPending: boolean }) {
  const current = new Date()
  const [month, setMonth] = useState(
    `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`
  )
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="font-semibold text-lg">Generate Monthly Bills</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Billing Month</label>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <p className="text-xs text-gray-400">
          This will generate bills for all active flats. Bills already generated for this month will be skipped.
        </p>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 border border-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onGenerate(month)}
            disabled={isPending}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60"
          >
            {isPending ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_BILLS: Bill[] = [
  { id: '1', flatDisplay: 'A-101', ownerName: 'Rajesh Sharma',     billDate: '2026-04-01', dueDate: '2026-04-10', amount: 950000, status: 'paid',    paidAt: '2026-04-07', paidAmount: 950000 },
  { id: '2', flatDisplay: 'A-102', ownerName: 'Priya Mehta',       billDate: '2026-04-01', dueDate: '2026-04-10', amount: 950000, status: 'pending'                                           },
  { id: '3', flatDisplay: 'A-103', ownerName: 'Suresh Iyer',       billDate: '2026-04-01', dueDate: '2026-04-10', amount: 950000, status: 'overdue'                                           },
  { id: '4', flatDisplay: 'A-104', ownerName: 'Anita Desai',       billDate: '2026-04-01', dueDate: '2026-04-10', amount: 950000, status: 'paid',    paidAt: '2026-04-09', paidAmount: 950000 },
  { id: '5', flatDisplay: 'A-105', ownerName: 'Vikram Nair',       billDate: '2026-04-01', dueDate: '2026-04-10', amount: 950000, status: 'pending'                                           },
  { id: '6', flatDisplay: 'B-101', ownerName: 'Meena Patel',       billDate: '2026-04-01', dueDate: '2026-04-10', amount: 950000, status: 'paid',    paidAt: '2026-04-03', paidAmount: 950000 },
  { id: '7', flatDisplay: 'B-102', ownerName: 'Arvind Joshi',      billDate: '2026-04-01', dueDate: '2026-04-10', amount: 950000, status: 'overdue'                                           },
  { id: '8', flatDisplay: 'B-103', ownerName: 'Kavitha Rao',       billDate: '2026-04-01', dueDate: '2026-04-10', amount: 950000, status: 'pending'                                           },
]
