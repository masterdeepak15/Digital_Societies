'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Wallet, ArrowUpRight, ArrowDownLeft, Search, TrendingUp } from 'lucide-react'
import { api } from '@/lib/api'
import { formatDate, cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// ── Types — aligned with API WalletDto ────────────────────────────────────────
// NOTE: The backend /wallet/* endpoints are a per-user pre-paid wallet used for
// marketplace bookings. This admin view shows the current admin's wallet balance
// and transaction history.  Society-level corpus fund accounting lives in
// /accounting/entries (see Accounting page).
//
// GET /wallet/balance → { balance, currency, lastUpdated }
interface WalletBalance {
  balance:     number
  currency:    string
  lastUpdated: string
}

// GET /wallet/transactions → { items: WalletTransactionDto[], total, page, pageSize }
// WalletTransactionDto: { id, type: "Credit"|"Debit", amount, description, refTransactionId, timestamp }
interface WalletTransaction {
  id:                string
  type:              'Credit' | 'Debit'
  amount:            number
  description:       string
  refTransactionId?: string
  timestamp:         string
}

interface WalletTxPage { items: WalletTransaction[]; total: number; page: number; pageSize: number }

// UI-only category mapping derived from description keywords (API doesn't categorise)
type CategoryFilter = 'all' | 'topup' | 'booking' | 'refund'

const CATEGORY_COLOR: Record<string, string> = {
  topup:   'bg-blue-100 text-blue-700',
  booking: 'bg-orange-100 text-orange-700',
  refund:  'bg-purple-100 text-purple-700',
  other:   'bg-gray-100 text-gray-700',
}

function guessCategory(t: WalletTransaction): string {
  const d = t.description.toLowerCase()
  if (d.includes('top-up') || d.includes('topup') || d.includes('razorpay')) return 'topup'
  if (d.includes('booking') || d.includes('plumber') || d.includes('service')) return 'booking'
  if (d.includes('refund') || d.includes('cancel')) return 'refund'
  return 'other'
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

  // API: GET /wallet/balance → { balance, currency, lastUpdated }
  const { data: walletRaw } = useQuery<WalletBalance>({
    queryKey: ['wallet-balance'],
    queryFn:  () => api.get<WalletBalance>('/wallet/balance'),
  })
  const wallet = walletRaw ?? DEMO_WALLET

  // API: GET /wallet/transactions → { items: WalletTransactionDto[], total }
  const { data: txPage } = useQuery<WalletTxPage>({
    queryKey: ['wallet-transactions'],
    queryFn:  () => api.get<WalletTxPage>('/wallet/transactions?page=1&pageSize=50'),
  })
  const transactions: WalletTransaction[] = txPage?.items ?? DEMO_TRANSACTIONS

  const filtered = transactions.filter(t => {
    const category = guessCategory(t)
    const matchesCategory = categoryFilter === 'all' || category === categoryFilter
    const matchesSearch   = search === '' ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      (t.refTransactionId ?? '').toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Wallet"
        description="Pre-paid wallet for marketplace bookings"
      />

      {/* Info banner — clarify this is per-user, not society corpus */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
        <b>Note:</b> This is your personal pre-paid wallet topped up via Razorpay and used for marketplace service bookings. Society-level corpus fund accounting is on the <a href="/accounting" className="underline">Accounting</a> page.
      </div>

      {/* Balance card */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-brand-200 text-sm font-medium">Wallet Balance</p>
            <p className="text-4xl font-bold mt-1">
              ₹{wallet.balance.toLocaleString('en-IN')}
            </p>
            <p className="text-brand-200 text-xs mt-2">
              Last updated {formatDate(wallet.lastUpdated ?? wallet.lastUpdatedAt ?? '')}
            </p>
          </div>
          <div className="bg-white/20 rounded-xl p-3">
            <Wallet className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/20">
          <div>
            <p className="text-brand-200 text-xs">Total Credits</p>
            <p className="text-xl font-bold text-green-300 mt-0.5">
              ₹{transactions.filter(t => t.type === 'Credit').reduce((s, t) => s + t.amount, 0).toLocaleString('en-IN')}
            </p>
          </div>
          <div>
            <p className="text-brand-200 text-xs">Total Debits</p>
            <p className="text-xl font-bold text-red-300 mt-0.5">
              ₹{transactions.filter(t => t.type === 'Debit').reduce((s, t) => s + t.amount, 0).toLocaleString('en-IN')}
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
          {(['all', 'topup', 'booking', 'refund'] as CategoryFilter[]).map(c => (
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
            {filtered.map(t => {
              const isCredit = t.type === 'Credit'
              const cat = guessCategory(t)
              return (
                <div key={t.id} className="flex items-center gap-4 p-4">
                  <div className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                    isCredit ? 'bg-green-100' : 'bg-red-100'
                  )}>
                    {isCredit
                      ? <ArrowDownLeft className="w-4 h-4 text-green-600" />
                      : <ArrowUpRight  className="w-4 h-4 text-red-500"   />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-800 truncate">{t.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', CATEGORY_COLOR[cat] ?? CATEGORY_COLOR.other)}>
                        {cat}
                      </span>
                      {t.refTransactionId && (
                        <span className="text-xs text-gray-400">{t.refTransactionId}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-semibold text-sm ${isCredit ? 'text-green-600' : 'text-red-500'}`}>
                      {isCredit ? '+' : '−'}₹{t.amount.toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(t.timestamp ?? t.createdAt)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )
      }
    </div>
  )
}

// ── Demo data — shape matches API WalletBalance + WalletTransactionDto ────────
const DEMO_WALLET: WalletBalance & { lastUpdatedAt?: string } = {
  balance:     2500,
  currency:    'INR',
  lastUpdated: '2026-04-28T10:00:00+05:30',
}

const DEMO_TRANSACTIONS: WalletTransaction[] = [
  { id:'1', type:'Credit', amount:2000, description:'Top-up via Razorpay',                     timestamp:'2026-04-25T09:30:00+05:30' },
  { id:'2', type:'Debit',  amount:250,  description:'Plumber booking — Quick Fix',              refTransactionId:'mb-001', timestamp:'2026-04-26T10:00:00+05:30' },
  { id:'3', type:'Credit', amount:1000, description:'Top-up via Razorpay',                     timestamp:'2026-04-20T08:00:00+05:30' },
  { id:'4', type:'Debit',  amount:150,  description:'Cleaning service booking',                 refTransactionId:'mb-002', timestamp:'2026-04-18T11:30:00+05:30' },
  { id:'5', type:'Credit', amount:250,  description:'Refund — cancelled booking',               refTransactionId:'mb-003', timestamp:'2026-04-15T14:00:00+05:30' },
  { id:'6', type:'Debit',  amount:350,  description:'Electrician booking — PowerFix Services',  refTransactionId:'mb-004', timestamp:'2026-04-10T09:00:00+05:30' },
]
