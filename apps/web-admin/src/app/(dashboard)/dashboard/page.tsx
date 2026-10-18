'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Receipt, AlertCircle, UserCheck, Bell, TrendingUp } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts'
import { api } from '@/lib/api'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { StatStrip } from '@/components/ui/StatStrip'
import { buttonClass } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusPill } from '@/components/ui/StatusPill'
import { demo, DEMO_ENABLED } from '@/lib/demo'

// ── Types ─────────────────────────────────────────────────────────────────────
// A figure is null when its endpoint failed or the role may not read it: shown as a dash, never a fake 0.
interface DashboardStats {
  totalResidents:    number | null
  activeFlats:       number | null
  pendingBills:      number | null
  pendingBillsAmt:   number | null   // paise
  openComplaints:    number | null
  todayVisitors:     number | null
  collectionRate:    number | null   // 0-100 %
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
    api.get<PagedResponse<unknown>>('/members?role=resident&page=1&pageSize=500'),  // this list endpoint sends no total: the page length is the count
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
  // Only development falls back to demo numbers; elsewhere a failed endpoint yields null.
  const orDemo = (live: number | null | undefined, fallback: number | null): number | null =>
    live ?? (DEMO_ENABLED ? fallback : null)
  const pendingBills    = orDemo(billing?.pending, DEMO_STATS.pendingBills)
  const pendingBillsAmt = billing ? Math.round(billing.pendingRupees * 100) : orDemo(null, DEMO_STATS.pendingBillsAmt)  // rupees -> paise
  const collectionRate  = billing
    ? (billing.total > 0 ? Math.round((billing.paid / billing.total) * 100) : 0)
    : orDemo(null, DEMO_STATS.collectionRate)
  const totalResidents  = orDemo(residents?.total, DEMO_STATS.totalResidents)
  // activeFlats: no dedicated endpoint — use billing.total (flats that got a bill) as proxy
  const activeFlats     = orDemo(billing?.total, DEMO_STATS.activeFlats)
  const openComplaintCount = orDemo(openComplaints?.total, DEMO_STATS.openComplaints)
  // todayVisitors: filter Entered visitors by today's date
  const today           = new Date().toDateString()
  const todayVisitorCount = enteredVisitors
    ? enteredVisitors.items.filter(v => v.entryTime && new Date(v.entryTime).toDateString() === today).length
    : orDemo(null, DEMO_STATS.todayVisitors)

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
  const recentActivity = activities.slice(0, 5).length > 0 ? activities.slice(0, 5) : demo(DEMO_STATS).recentActivity

  return {
    totalResidents,
    activeFlats,
    pendingBills,
    pendingBillsAmt,
    openComplaints:  openComplaintCount,
    todayVisitors:   todayVisitorCount,
    collectionRate,
    // Monthly billing/complaint series: no historical endpoint exists yet — use DEMO.
    monthlySeries:   demo(DEMO_STATS).monthlySeries,
    complaintSeries: demo(DEMO_STATS).complaintSeries,
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

  const s = stats ?? demo(DEMO_STATS)
  const hasTrends = s.monthlySeries.length > 0 || s.complaintSeries.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description={`As of ${formatDate(new Date().toISOString())}`}
        action={<Link href="/billing" className={buttonClass('primary')}>Generate bills</Link>}
      />

      <StatStrip
        items={[
          {
            label: 'Residents', value: s.totalResidents ?? '—',
            hint: s.totalResidents === null ? 'Not available for your role' : s.activeFlats === null ? undefined : `${s.activeFlats} flats billed`,
          },
          {
            label: 'Pending bills', value: s.pendingBills ?? '—',
            hint: s.pendingBills === null || s.pendingBillsAmt === null
              ? 'Not available for your role'
              : `${s.collectionRate ?? 0}% collected · ${formatCurrency(s.pendingBillsAmt)} pending`,
            tone: s.pendingBills !== null && s.pendingBills > 0 ? 'warn' : s.pendingBills === null ? 'neutral' : 'good',
          },
          {
            label: 'Open complaints', value: s.openComplaints ?? '—',
            hint: s.openComplaints === null ? 'Not available for your role' : s.openComplaints > 5 ? 'Needs attention' : 'Under control',
            tone: s.openComplaints === null ? 'neutral' : s.openComplaints > 5 ? 'bad' : 'good',
          },
          { label: 'Visitors today', value: s.todayVisitors ?? '—', hint: s.todayVisitors === null ? 'Not available for your role' : undefined },
        ]}
      />

      {hasTrends ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-4 text-[15px] font-bold text-ink">Collections, last months</h2>
            <div className="text-mute">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={s.monthlySeries} barSize={18} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#8893A8" strokeOpacity={0.25} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'currentColor' }} stroke="#8893A8" />
                  <YAxis tickFormatter={v => `₹${(v / 10000000).toFixed(0)}L`} tick={{ fontSize: 11, fill: 'currentColor' }} stroke="#8893A8" />
                  <Tooltip
                    formatter={(val: number) => [formatCurrency(val), '']}
                    contentStyle={{ fontSize: 12, background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))', color: 'rgb(var(--ink))' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="billed"    fill="#8893A8" fillOpacity={0.45} name="Billed"    radius={[3,3,0,0]} />
                  <Bar dataKey="collected" fill="#E58F1A" name="Collected" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-[15px] font-bold text-ink">Complaint trend</h2>
            <div className="text-mute">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={s.complaintSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#8893A8" strokeOpacity={0.25} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'currentColor' }} stroke="#8893A8" />
                  <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} allowDecimals={false} stroke="#8893A8" />
                  <Tooltip contentStyle={{ fontSize: 12, background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))', color: 'rgb(var(--ink))' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="open"     stroke="#FF6B5E" dot={false} name="Open"     strokeWidth={2} />
                  <Line type="monotone" dataKey="resolved" stroke="#4ADE80" dot={false} name="Resolved" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      ) : (
        <Card className="p-0">
          <EmptyState
            icon={TrendingUp}
            title="Trends will appear here"
            description="Monthly collection and complaint charts fill in as billing and complaint history builds up."
          />
        </Card>
      )}

      <section aria-labelledby="recent-activity" className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-5 py-4">
          <h2 id="recent-activity" className="text-[15px] font-bold text-ink">Recent activity</h2>
        </div>
        {s.recentActivity.length === 0 ? (
          <EmptyState icon={Bell} title="No activity yet" description="New complaints, visitors and notices show up here." />
        ) : (
          <ul className="divide-y divide-line">
            {s.recentActivity.map(item => {
              const Icon = ICON_MAP[item.type]
              return (
                <li key={item.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="shrink-0 rounded-full bg-surface-alt p-2">
                    <Icon className="h-4 w-4 text-mute" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                    <p className="text-xs text-mute">{item.subtitle}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {item.status && <StatusPill label={item.status} className="mb-1" />}
                    <p className="text-xs text-mute">{formatDate(item.timestamp ?? '')}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading overview">
      <div className="h-8 w-48 rounded bg-surface-alt" />
      <div className="h-28 rounded-xl bg-surface-alt" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-72 rounded-xl bg-surface-alt" />
        <div className="h-72 rounded-xl bg-surface-alt" />
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
