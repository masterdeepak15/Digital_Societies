'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, UserCheck, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Table, Thead, Tbody, Th, Td, Tr } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'

// ── Types — kept compatible with API DTO; UI-only fields are optional ─────────
// API returns { id, name, phone, purpose, status, entryTime, exitTime, vehicleNumber }.
// The extra fields below are UI-side niceties populated from joined data or DEMO.
interface Visitor {
  id:               string
  name:             string
  phone:            string
  purposeOfVisit:   string
  vehicleNumber?:   string
  hostFlatDisplay?: string
  hostName?:        string
  status:           'Pending' | 'Approved' | 'Rejected' | 'Entered' | 'Exited'
  entryTime?:       string
  exitTime?:        string
  expectedAt?:      string
  photoUrl?:        string
  otp?:             string
}

interface VisitorsPage { items: Visitor[]; total: number; page: number; pageSize: number }

type VisitorFilter = 'all' | 'Pending' | 'Approved' | 'Entered' | 'Exited'

export default function VisitorsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<VisitorFilter>('all')

  const { data } = useQuery<VisitorsPage>({
    queryKey: ['visitors', filter],
    // Omit ?status when filter='all' so the backend returns everything.
    queryFn:  () => api.get(filter === 'all' ? '/visitors' : `/visitors?status=${filter}`),
    refetchInterval: 30_000,   // auto-refresh every 30 s for live gate view
  })

  // The API returns a paginated envelope. Map server fields ➜ UI fields where naming differs.
  const visitors: Visitor[] = (data?.items ?? DEMO_VISITORS).map(v => ({
    ...v,
    purposeOfVisit: (v as unknown as { purpose?: string }).purpose ?? v.purposeOfVisit,
  }))

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/visitors/${id}/approve`, {}),
    onSuccess: () => { toast.success('Visitor approved'); qc.invalidateQueries({ queryKey: ['visitors'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  // Backend route is /reject, optional body { reason? }.
  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/visitors/${id}/reject`, {}),
    onSuccess: () => { toast.success('Visitor rejected'); qc.invalidateQueries({ queryKey: ['visitors'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const filtered = visitors.filter(v =>
    (filter === 'all' || v.status === filter) &&
    (search === '' ||
     v.name.toLowerCase().includes(search.toLowerCase()) ||
     v.phone.includes(search) ||
     (v.hostFlatDisplay ?? '').toLowerCase().includes(search.toLowerCase()))
  )

  const pending = visitors.filter(v => v.status === 'Pending').length

  return (
    <div className="space-y-5">
      <PageHeader
        title="Visitors"
        description="Gate access management and visitor log"
        action={
          pending > 0 && (
            <span className="bg-amber-100 text-amber-800 text-sm font-medium px-3 py-1 rounded-full">
              {pending} awaiting approval
            </span>
          )
        }
      />

      {/* Live status band */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Pending',    count: visitors.filter(v => v.status === 'Pending').length,  color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Approved',   count: visitors.filter(v => v.status === 'Approved').length, color: 'text-blue-600',  bg: 'bg-blue-50'  },
          { label: 'Inside',     count: visitors.filter(v => v.status === 'Entered').length,  color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Checked Out',count: visitors.filter(v => v.status === 'Exited').length,   color: 'text-gray-500',  bg: 'bg-gray-50'  },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-gray-100`}>
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search visitor, flat…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['all', 'Pending', 'Approved', 'Entered'] as VisitorFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition capitalize',
                filter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {f === 'all' ? 'all' : f === 'Entered' ? 'inside' : f.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={UserCheck} title="No visitors found" />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Visitor</Th>
                <Th>Purpose</Th>
                <Th>Host</Th>
                <Th>Expected</Th>
                <Th>Entry / Exit</Th>
                <Th>Status</Th>
                <Th>Action</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map(v => (
                <Tr key={v.id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      {v.photoUrl ? (
                        <img src={v.photoUrl} alt={v.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                          {v.name[0]}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-sm text-gray-800">{v.name}</p>
                        <p className="text-xs text-gray-400">{v.phone}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="capitalize">{v.purposeOfVisit}</Td>
                  <Td>
                    <p className="font-medium">{v.hostFlatDisplay}</p>
                    <p className="text-xs text-gray-400">{v.hostName}</p>
                  </Td>
                  <Td>{formatDateTime(v.expectedAt)}</Td>
                  <Td className="text-xs">
                    {v.entryTime ? <p className="text-green-600">{formatDateTime(v.entryTime)}</p> : <p className="text-gray-300">—</p>}
                    {v.exitTime  ? <p className="text-gray-400">{formatDateTime(v.exitTime)}</p>  : null}
                  </Td>
                  <Td><Badge label={v.status} /></Td>
                  <Td>
                    {v.status === 'Pending' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => approveMutation.mutate(v.id)}
                          className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600"
                          title="Approve"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate(v.id)}
                          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500"
                          title="Reject"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {v.otp && v.status === 'Approved' && (
                      <span className="font-mono text-sm font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                        {v.otp}
                      </span>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>
    </div>
  )
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_VISITORS: Visitor[] = [
  { id: '1', name: 'Ravi Kumar',       phone: '+919500000001', purposeOfVisit: 'delivery',    hostFlatDisplay: 'A-104', hostName: 'Anita Desai',   status: 'Pending',  expectedAt: '2026-04-27T11:00:00Z', otp: '482931' },
  { id: '2', name: 'Sunita Jain',      phone: '+919500000002', purposeOfVisit: 'guest',       hostFlatDisplay: 'A-201', hostName: 'Rajesh Sharma', status: 'Approved', expectedAt: '2026-04-27T14:00:00Z', otp: '173654' },
  { id: '3', name: 'Plumber — Ramesh', phone: '+919500000003', purposeOfVisit: 'maintenance', hostFlatDisplay: 'B-203', hostName: 'Arvind Joshi',  status: 'Entered',  expectedAt: '2026-04-27T09:00:00Z', entryTime: '2026-04-27T09:15:00Z' },
  { id: '4', name: 'Electrician Co.',  phone: '+919500000004', purposeOfVisit: 'maintenance', hostFlatDisplay: 'A-301', hostName: 'Priya Mehta',   status: 'Exited',   expectedAt: '2026-04-26T10:00:00Z', entryTime: '2026-04-26T10:05:00Z', exitTime: '2026-04-26T12:30:00Z' },
  { id: '5', name: 'Deepa Menon',      phone: '+919500000005', purposeOfVisit: 'guest',       hostFlatDisplay: 'B-101', hostName: 'Meena Patel',   status: 'Rejected', expectedAt: '2026-04-26T16:00:00Z' },
]
