'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Wallet, ArrowUpRight, ArrowDownLeft, Search, TrendingUp } from 'lucide-react'
import { api } from '@/lib/api'
import { formatDate, cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────
interface SocietyWallet {
  balance:          number
  totalCredits:     number
  totalDebits:      number
  lastUpdatedAt:    string
}

interface WalletTransaction {
  id:          string
  type:        'credit' | 'debit'
  amount:      number
  description: string
  category:    'maintenance' | 'expense' | 'penalty' | 'refund' | 'transfer'
  reference:   string
  createdAt:   string
  createdBy:   string
}

type CategoryFilter = 'all' | 'maintenance' | 'expense' | 'penalty' | 'refund'

const CATEGORY_COLOR: Record<string, string> = {
  maintenance: 'bg-blue-100 text-blue-700',
  expense:     'bg-orange-100 text-orange-700',
  penalty:     'bg-red-100 text-red-700',
  refund:      'bg-purple-100 text-purple-700',
  transfer:    'bg-gray-100 text-gray-700',
}

const MONTH_DATA = [
  { month: 'Nov', credits: 185000, debits: 62000 },
  { month: 'Dec', credits: 190000, debits: 78000 },
  { month: 'Jan', credits: 178000, debits: 55000 },
  { month: 'Feb', credits: 195000, debits: 68000 },
  { month: 'Mar', credits: 210000, debits: 71000 },
  { month: 'Apr', credits: 202000, debits: 58000 },
]

export default function WalletPage() {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [search, setSearch] = useState('')

  const { data: wallet = DEMO_WALLET } = useQuery<SocietyWallet>({
    queryKey: ['society-wallet'],
    queryFn:  () => api.get('/wallet/balance'),
  })

  const { data: transactions = DEMO_TRANSACTIONS } = useQuery<WalletTransaction[]>({
    queryKey: ['wallet-transactions', categoryFilter],
    queryFn:  () => api.get(`/wallet/transactions?page=1&pageSize=50`),
  })

  const filtered = transactions.filter(t => {
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter
    const matchesSearch   = search === '' ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.reference.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Society Wallet"
        description="Corpus fund balance, credits, and expense tracking"
      />

      {/* Balance card */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-brand-200 text-sm font-medium">Society Corpus Balance</p>
            <p className="text-4xl font-bold mt-1">
              ₹{wallet.balance.toLocaleString('en-IN')}
            </p>
            <p className="text-brand-200 text-xs mt-2">
              Last updated {formatDate(wallet.lastUpdatedAt)}
            </p>
          </div>
          <div className="bg-white/20 rounded-xl p-3">
            <Wallet className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/20">
          <div>
            <p className="text-brand-200 text-xs">Total Credits (YTD)</p>
            <p className="text-xl font-bold text-green-300 mt-0.5">
              ₹{wallet.totalCredits.toLocaleString('en-IN')}
            </p>
          </div>
          <div>
            <p className="text-brand-200 text-xs">Total Debits (YTD)</p>
            <p className="text-xl font-bold text-red-300 mt-0.5">
              ₹{wallet.totalDebits.toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>

      {/* 6-month chart */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-brand-600" />
          <h3 className="font-semibold text-gray-800 text-sm">6-Month Flow</h3>
          <div className="flex items-center gap-3 ml-auto text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-brand-500 inline-block" /> Credits</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-red-400 inline-block" /> Debits</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={MONTH_DATA} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false}
              tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, '']} />
            <Bar dataKey="credits" fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="debits"  fill="#f87171" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search description, reference…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg flex-wrap">
          {(['all', 'maintenance', 'expense', 'penalty', 'refund'] as CategoryFilter[]).map(c => (
            <button key={c} onClick={() => setCategoryFilter(c)}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium capitalize transition',
                categoryFilter === c ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
              {c === 'all' ? 'All' : c}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction list */}
      {filtered.length === 0
        ? <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
            <EmptyState icon={Wallet} title="No transactions match this filter" />
          </div>
        : (
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm divide-y divide-gray-50">
            {filtered.map(t => (
              <div key={t.id} className="flex items-center gap-4 p-4">
                <div className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                  t.type === 'credit' ? 'bg-green-100' : 'bg-red-100'
                )}>
                  {t.type === 'credit'
                    ? <ArrowDownLeft className="w-4 h-4 text-green-600" />
                    : <ArrowUpRight  className="w-4 h-4 text-red-500"   />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-800 truncate">{t.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', CATEGORY_COLOR[t.category])}>
                      {t.category}
                    </span>
                    <span className="text-xs text-gray-400">{t.reference}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-semibold text-sm ${t.type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                    {t.type === 'credit' ? '+' : '−'}₹{t.amount.toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(t.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_WALLET: SocietyWallet = {
  balance:       748500,
  totalCredits:  1160000,
  totalDebits:   392000,
  lastUpdatedAt: '2026-04-28',
}

const DEMO_TRANSACTIONS: WalletTransaction[] = [
  { id:'1', type:'credit', amount:202000, description:'April maintenance collection', category:'maintenance', reference:'APR-2026-BATCH', createdAt:'2026-04-25', createdBy:'System' },
  { id:'2', type:'debit',  amount:18500,  description:'Lift AMC — Schindler India', category:'expense', reference:'INV-SCH-0412', createdAt:'2026-04-22', createdBy:'Admin' },
  { id:'3', type:'debit',  amount:6200,   description:'Common area electricity bill', category:'expense', reference:'MSEB-APR-26', createdAt:'2026-04-20', createdBy:'Admin' },
  { id:'4', type:'credit', amount:5000,   description:'Late payment penalty — A-201', category:'penalty', reference:'PEN-A201-APR', createdAt:'2026-04-18', createdBy:'System' },
  { id:'5', type:'debit',  amount:12000,  description:'Swimming pool chemical refill', category:'expense', reference:'PO-POOL-0408', createdAt:'2026-04-08', createdBy:'Admin' },
  { id:'6', type:'credit', amount:195000, description:'March maintenance collection', category:'maintenance', reference:'MAR-2026-BATCH', createdAt:'2026-03-28', createdBy:'System' },
  { id:'7', type:'debit',  amount:3500,   description:'Refund — cancelled booking B-102', category:'refund', reference:'REF-B102-0320', createdAt:'2026-03-20', createdBy:'Admin' },
  { id:'8', type:'debit',  amount:9800,   description:'Security staff salary', category:'expense', reference:'SAL-SEC-MAR26', createdAt:'2026-03-31', createdBy:'Admin' },
]
