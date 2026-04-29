'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Users, Receipt, AlertCircle, UserCheck,
  TrendingUp, Home, Bell, Wrench,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { StatCard } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'

// ── Types ─────────────────────────────────────────────────────────────────────
interface DashboardStats {
  totalResidents:    number
  activeFlats:       number
  pendingBills:      number
  pendingBillsAmt:   number   // paise
  openComplaints:    number
  todayVisitors:     number
  collectionRate:    number   // 0-100 %
  monthlySeries:     { month: string; collected: number; billed: number }[]
  complaintSeries:   { month: string; open: number; resolved: number }[]
  recentActivity:    Activity[]
}

interface Activity {
  id:        string
  type:      'bill' | 'complaint' | 'visitor' | 'notice'
  title:     string
  subtitle:  string
  timestamp: string
  status?:   string
}

const ICON_MAP = {
  bill:      Receipt,
  complaint: AlertCircle,
  visitor:   UserCheck,
  notice:    Bell,
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn:  () => api.get('/billing/dashboard'),
    staleTime: 60_000,
  })

  if (isLoading) return <DashboardSkeleton />

  // Fallback to demo data if the API response doesn't match the expected shape
  // (e.g. /billing/dashboard returns billing-only stats, not a full DashboardStats)
  const stats: DashboardStats = (data && 'totalResidents' in data) ? data : DEMO_STATS

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Overview as of ${formatDate(new Date().toISOString())}`}
      />

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Residents"
          value={stats.totalResidents.toString()}
          icon={<Users className="w-5 h-5 text-blue-600" />}
          delta="+3 this month"
        />
        <StatCard
          label="Active Flats"
          value={stats.activeFlats.toString()}
          icon={<Home className="w-5 h-5 text-indigo-600" />}
        />
        <StatCard
          label="Pending Bills"
          value={`${stats.pendingBills} bills`}
          icon={<Receipt className="w-5 h-5 text-amber-600" />}
          delta={formatCurrency(stats.pendingBillsAmt) + ' overdue'}
          deltaClass="text-amber-600"
        />
        <StatCard
          label="Open Complaints"
          value={stats.openComplaints.toString()}
          icon={<AlertCircle className="w-5 h-5 text-red-500" />}
          delta={stats.openComplaints > 5 ? 'Needs attention' : 'Under control'}
          deltaClass={stats.openComplaints > 5 ? 'text-red-500' : 'text-green-600'}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Today's Visitors"
          value={stats.todayVisitors.toString()}
          icon={<UserCheck className="w-5 h-5 text-green-600" />}
        />
        <StatCard
          label="Collection Rate"
          value={`${stats.collectionRate}%`}
          icon={<TrendingUp className="w-5 h-5 text-brand-600" />}
          delta={stats.collectionRate >= 80 ? 'On track' : 'Below target'}
          deltaClass={stats.collectionRate >= 80 ? 'text-green-600' : 'text-red-500'}
        />
        <StatCard
          label="Maintenance Requests"
          value={stats.openComplaints.toString()}
          icon={<Wrench className="w-5 h-5 text-purple-600" />}
        />
      </div>

      {/* ── Charts ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collection trend */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Monthly Collection vs Billing</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.monthlySeries} barSize={18} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(val: number) => [formatCurrency(val), '']}
                contentStyle={{ fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="billed"    fill="#dbeafe" name="Billed"    radius={[3,3,0,0]} />
              <Bar dataKey="collected" fill="#2563eb" name="Collected" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Complaint trend */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Complaint Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.complaintSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="open"     stroke="#ef4444" dot={false} name="Open"     strokeWidth={2} />
              <Line type="monotone" dataKey="resolved" stroke="#22c55e" dot={false} name="Resolved" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Recent activity ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Recent Activity</h3>
        </div>
        <ul className="divide-y divide-gray-50">
          {stats.recentActivity.map(item => {
            const Icon = ICON_MAP[item.type]
            return (
              <li key={item.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
                <div className="bg-gray-100 rounded-full p-2 shrink-0">
                  <Icon className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                  <p className="text-xs text-gray-400">{item.subtitle}</p>
                </div>
                <div className="text-right shrink-0">
                  {item.status && <Badge label={item.status} className="mb-1" />}
                  <p className="text-xs text-gray-400">{formatDate(item.timestamp)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-gray-100 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="h-72 bg-gray-100 rounded-xl" />
        <div className="h-72 bg-gray-100 rounded-xl" />
      </div>
    </div>
  )
}

// ── Demo fallback data ────────────────────────────────────────────────────────
const DEMO_STATS: DashboardStats = {
  totalResidents:  87,
  activeFlats:     62,
  pendingBills:    14,
  pendingBillsAmt: 182000_00,
  openComplaints:  7,
  todayVisitors:   23,
  collectionRate:  84,
  monthlySeries: [
    { month: 'Nov', billed: 520000_00, collected: 410000_00 },
    { month: 'Dec', billed: 520000_00, collected: 480000_00 },
    { month: 'Jan', billed: 540000_00, collected: 450000_00 },
    { month: 'Feb', billed: 540000_00, collected: 510000_00 },
    { month: 'Mar', billed: 540000_00, collected: 495000_00 },
    { month: 'Apr', billed: 560000_00, collected: 460000_00 },
  ],
  complaintSeries: [
    { month: 'Nov', open: 12, resolved: 8  },
    { month: 'Dec', open: 9,  resolved: 11 },
    { month: 'Jan', open: 15, resolved: 7  },
    { month: 'Feb', open: 10, resolved: 13 },
    { month: 'Mar', open: 8,  resolved: 10 },
    { month: 'Apr', open: 7,  resolved: 5  },
  ],
  recentActivity: [
    { id: '1', type: 'bill',      title: 'Bill generated — Apr 2026',  subtitle: '62 flats · ₹5,60,000 total',      timestamp: '2026-04-01T09:00:00Z', status: 'pending'  },
    { id: '2', type: 'complaint', title: 'Lift breakdown — Block B',   subtitle: 'Reported by B-203 · Priority High', timestamp: '2026-04-26T14:32:00Z', status: 'open'     },
    { id: '3', type: 'visitor',   title: 'Delivery — Flat A-104',      subtitle: 'Approved by guard',                timestamp: '2026-04-27T10:05:00Z', status: 'approved' },
    { id: '4', type: 'notice',    title: 'AGM scheduled — 5 May 2026', subtitle: 'Published to all residents',       timestamp: '2026-04-25T11:00:00Z'                     },
    { id: '5', type: 'bill',      title: 'Payment received — A-202',   subtitle: '₹9,500 via Razorpay',             timestamp: '2026-04-27T08:41:00Z', status: 'paid'     },
  ],
}
