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
import { formatDate, formatCurrency } from '@/lib/utils'
import { StatCard } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'

// ── Types ─────────────────────────────────────────────────────────────────────
interface DashboardStats {
  totalResidents:    number
  activeFlats:       number
  pendingBills:      number
  pendingBillsAmt:   number   // rupees (from API)
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

// ── API response shapes ───────────────────────────────────────────────────────
interface BillingKpi {
  period:            string
  total:             number   // count
  paid:              number
  pending:           number
  overdue:           number
  totalAmountRupees: number
  collectedRupees:   number
  pendingRupees:     number
}
interface PagedResponse<T> { items: T[]; total: number }
interface ComplaintItem  { id: string; ticketNumber: string; title: string; status: string; createdAt: string; category?: string; priority?: string }
interface VisitorItem    { id: string; name: string; purpose: string; status: string; entryTime?: string }
interface NoticeItem     { id: string; title: string; type: string; createdAt: string; isPinned: boolean }

const ICON_MAP = {
  bill:      Receipt,
  complaint: AlertCircle,
  visitor:   UserCheck,
  notice:    Bell,
}

// Compose DashboardStats from 5 parallel API calls.
// Uses Promise.allSettled so a single failing endpoint doesn't break the whole dashboard.
async function fetchDashboard(): Promise<DashboardStats> {
  const [
    billingRes,
    openComplaintsRes,
    residentsRes,
    enteredVisitorsRes,
    recentComplaintsRes,
    recentVisitorsRes,
    recentNoticesRes,
  ] = await Promise.allSettled([
    api.get<BillingKpi>('/billing/dashboard'),
    api.get<PagedResponse<ComplaintItem>>('/complaints?status=Open&page=1&pageSize=1'),
    api.get<PagedResponse<unknown>>('/members?role=resident&page=1&pageSize=1'),
    api.get<PagedResponse<VisitorItem>>('/visitors?status=Entered&page=1&pageSize=50'),
    api.get<PagedResponse<ComplaintItem>>('/complaints?page=1&pageSize=4'),
    api.get<PagedResponse<VisitorItem>>('/visitors?page=1&pageSize=4'),
    api.get<PagedResponse<NoticeItem>>('/notices?page=1&pageSize=4'),
  ])

  const billing        = billingRes.status       === 'fulfilled' ? billingRes.value       : null
  const openComplaints = openComplaintsRes.status === 'fulfilled' ? openComplaintsRes.value : null
  const residents      = residentsRes.status      === 'fulfilled' ? residentsRes.value      : null
  const enteredVisitors= enteredVisitorsRes.status=== 'fulfilled' ? enteredVisitorsRes.value: null
  const recentComplaints= recentComplaintsRes.status==='fulfilled' ? recentComplaintsRes.value: null
  const recentVisitors = recentVisitorsRes.status === 'fulfilled' ? recentVisitorsRes.value : null
  const recentNotices  = recentNoticesRes.status  === 'fulfilled' ? recentNoticesRes.value  : null

  // ── Stat card values ──
  const pendingBills    = billing?.pending ?? DEMO_STATS.pendingBills
  const pendingBillsAmt = billing?.pendingRupees ?? DEMO_STATS.pendingBillsAmt
  const collectionRate  = billing && billing.total > 0
    ? Math.round((billing.paid / billing.total) * 100)
    : DEMO_STATS.collectionRate
  const totalResidents  = residents?.total ?? DEMO_STATS.totalResidents
  // activeFlats: no dedicated endpoint — use billing.total (flats that got a bill) as proxy
  const activeFlats     = billing?.total ?? DEMO_STATS.activeFlats
  const openComplaintCount = openComplaints?.total ?? DEMO_STATS.openComplaints
  // todayVisitors: filter Entered visitors by today's date
  const today           = new Date().toDateString()
  const todayVisitorCount = enteredVisitors
    ? enteredVisitors.items.filter(v => v.entryTime && new Date(v.entryTime).toDateString() === today).length
    : DEMO_STATS.todayVisitors

  // ── Recent activity (merge complaints + visitors + notices, sort by timestamp) ──
  const activities: Activity[] = []
  recentComplaints?.items.forEach(c => activities.push({
    id: c.id, type: 'complaint',
    title:    c.title,
    subtitle: `${c.ticketNumber} · ${c.category ?? ''} · ${c.priority ?? ''}`.replace(/ · $/, ''),
    timestamp: c.createdAt,
    status:   c.status,
  }))
  recentVisitors?.items.forEach(v => activities.push({
    id: v.id, type: 'visitor',
    title:     `${v.purpose} — ${v.name}`,
    subtitle:  v.status,
    timestamp: v.entryTime ?? '',
    status:    v.status,
  }))
  recentNotices?.items.forEach(n => activities.push({
    id: n.id, type: 'notice',
    title:     n.title,
    subtitle:  `${n.type}${n.isPinned ? ' · pinned' : ''}`,
    timestamp: n.createdAt,
  }))
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  const recentActivity = activities.slice(0, 5).length > 0 ? activities.slice(0, 5) : DEMO_STATS.recentActivity

  return {
    totalResidents,
    activeFlats,
    pendingBills,
    pendingBillsAmt,
    openComplaints:  openComplaintCount,
    todayVisitors:   todayVisitorCount,
    collectionRate,
    // Monthly billing/complaint series: no historical endpoint exists yet — use DEMO.
    monthlySeries:   DEMO_STATS.monthlySeries,
    complaintSeries: DEMO_STATS.complaintSeries,
    recentActivity,
  }
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn:  fetchDashboard,
    staleTime: 60_000,
  })

  if (isLoading) return <DashboardSkeleton />

  const s = stats ?? DEMO_STATS

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
          value={s.totalResidents.toString()}
          icon={<Users className="w-5 h-5 text-blue-600" />}
          delta="+3 this month"
        />
        <StatCard
          label="Active Flats"
          value={s.activeFlats.toString()}
          icon={<Home className="w-5 h-5 text-indigo-600" />}
        />
        <StatCard
          label="Pending Bills"
          value={`${s.pendingBills} bills`}
          icon={<Receipt className="w-5 h-5 text-amber-600" />}
          delta={formatCurrency(s.pendingBillsAmt) + ' overdue'}
          deltaClass="text-amber-600"
        />
        <StatCard
          label="Open Complaints"
          value={s.openComplaints.toString()}
          icon={<AlertCircle className="w-5 h-5 text-red-500" />}
          delta={s.openComplaints > 5 ? 'Needs attention' : 'Under control'}
          deltaClass={s.openComplaints > 5 ? 'text-red-500' : 'text-green-600'}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Today's Visitors"
          value={s.todayVisitors.toString()}
          icon={<UserCheck className="w-5 h-5 text-green-600" />}
        />
        <StatCard
          label="Collection Rate"
          value={`${s.collectionRate}%`}
          icon={<TrendingUp className="w-5 h-5 text-brand-600" />}
          delta={s.collectionRate >= 80 ? 'On track' : 'Below target'}
          deltaClass={s.collectionRate >= 80 ? 'text-green-600' : 'text-red-500'}
        />
        <StatCard
          label="Maintenance Requests"
          value={s.openComplaints.toString()}
          icon={<Wrench className="w-5 h-5 text-purple-600" />}
        />
      </div>

      {/* ── Charts ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collection trend */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Monthly Collection vs Billing</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={s.monthlySeries} barSize={18} barGap={4}>
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
            <LineChart data={s.complaintSeries}>
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
          {s.recentActivity.map(item => {
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
                  <p className="text-xs text-gray-400">{formatDate(item.timestamp ?? '')}</p>
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
