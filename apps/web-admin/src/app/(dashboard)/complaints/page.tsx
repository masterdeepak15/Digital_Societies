'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, AlertCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Table, Thead, Tbody, Th, Td, Tr } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Complaint {
  id:          string
  title:       string
  description: string
  category:    string
  priority:    'low' | 'medium' | 'high' | 'urgent'
  status:      'open' | 'in_progress' | 'resolved' | 'closed'
  flatDisplay: string
  reporterName: string
  createdAt:   string
  updatedAt:   string
  assignedTo?: string
  imageUrl?:   string
}

type StatusFilter = 'all' | 'open' | 'in_progress' | 'resolved'

const PRIORITY_COLOR: Record<string, string> = {
  low:    'text-gray-500 bg-gray-100',
  medium: 'text-blue-700 bg-blue-100',
  high:   'text-orange-700 bg-orange-100',
  urgent: 'text-red-700 bg-red-100',
}

export default function ComplaintsPage() {
  const qc = useQueryClient()
  const [search,   setSearch]   = useState('')
  const [status,   setStatus]   = useState<StatusFilter>('all')
  const [selected, setSelected] = useState<Complaint | null>(null)

  const { data: complaints = DEMO_COMPLAINTS, isLoading } = useQuery<Complaint[]>({
    queryKey: ['complaints', status, search],
    queryFn:  () => api.get(`/complaints?status=${status}&search=${encodeURIComponent(search)}`),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/complaints/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Complaint updated')
      qc.invalidateQueries({ queryKey: ['complaints'] })
      setSelected(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const filtered = complaints.filter(c =>
    (status === 'all' || c.status === status) &&
    (search === '' || c.title.toLowerCase().includes(search.toLowerCase()) ||
     c.flatDisplay.toLowerCase().includes(search.toLowerCase()) ||
     c.reporterName.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Complaints"
        description="Track and resolve resident issues"
      />

      {/* Status summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Open',        count: complaints.filter(c => c.status === 'open').length,        color: 'text-red-600',    bg: 'bg-red-50'   },
          { label: 'In Progress', count: complaints.filter(c => c.status === 'in_progress').length, color: 'text-amber-600',  bg: 'bg-amber-50' },
          { label: 'Resolved',    count: complaints.filter(c => c.status === 'resolved').length,    color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Closed',      count: complaints.filter(c => c.status === 'closed').length,      color: 'text-gray-500',   bg: 'bg-gray-50'  },
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
            placeholder="Search complaint, flat…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['all', 'open', 'in_progress', 'resolved'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium capitalize transition',
                status === s ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={AlertCircle} title="No complaints found" />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Issue</Th>
                <Th>Flat</Th>
                <Th>Category</Th>
                <Th>Priority</Th>
                <Th>Status</Th>
                <Th>Reported</Th>
                <Th>Action</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map(c => (
                <Tr key={c.id} onClick={() => setSelected(c)}>
                  <Td>
                    <p className="font-medium text-gray-800 text-sm">{c.title}</p>
                    <p className="text-xs text-gray-400 truncate max-w-xs">{c.description}</p>
                  </Td>
                  <Td>
                    <p className="font-medium">{c.flatDisplay}</p>
                    <p className="text-xs text-gray-400">{c.reporterName}</p>
                  </Td>
                  <Td className="capitalize">{c.category}</Td>
                  <Td>
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize', PRIORITY_COLOR[c.priority])}>
                      {c.priority}
                    </span>
                  </Td>
                  <Td><Badge label={c.status} /></Td>
                  <Td>{formatDateTime(c.createdAt)}</Td>
                  <Td>
                    {c.status !== 'resolved' && c.status !== 'closed' && (
                      <button
                        onClick={e => { e.stopPropagation(); updateMutation.mutate({ id: c.id, status: c.status === 'open' ? 'in_progress' : 'resolved' }) }}
                        className="text-xs text-brand-600 hover:underline font-medium"
                      >
                        {c.status === 'open' ? 'Start work' : 'Resolve'}
                      </button>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <ComplaintDrawer
          complaint={selected}
          onClose={() => setSelected(null)}
          onUpdateStatus={s => updateMutation.mutate({ id: selected.id, status: s })}
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  )
}

// ── Complaint detail drawer ───────────────────────────────────────────────────
function ComplaintDrawer({
  complaint, onClose, onUpdateStatus, isPending,
}: {
  complaint: Complaint
  onClose: () => void
  onUpdateStatus: (s: string) => void
  isPending: boolean
}) {
  const nextStatus: Record<string, string | undefined> = {
    open:        'in_progress',
    in_progress: 'resolved',
    resolved:    'closed',
  }
  const next = nextStatus[complaint.status]

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="font-semibold text-lg">{complaint.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-gray-400 text-xs">Flat</p><p className="font-medium">{complaint.flatDisplay}</p></div>
          <div><p className="text-gray-400 text-xs">Reporter</p><p className="font-medium">{complaint.reporterName}</p></div>
          <div><p className="text-gray-400 text-xs">Category</p><p className="capitalize">{complaint.category}</p></div>
          <div><p className="text-gray-400 text-xs">Priority</p>
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize', PRIORITY_COLOR[complaint.priority])}>
              {complaint.priority}
            </span>
          </div>
          <div><p className="text-gray-400 text-xs">Status</p><Badge label={complaint.status} /></div>
          <div><p className="text-gray-400 text-xs">Reported</p><p>{formatDateTime(complaint.createdAt)}</p></div>
        </div>

        <div>
          <p className="text-gray-400 text-xs mb-1">Description</p>
          <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{complaint.description}</p>
        </div>

        {complaint.imageUrl && (
          <img src={complaint.imageUrl} alt="Complaint" className="rounded-lg w-full object-cover max-h-48" />
        )}

        {next && (
          <button
            onClick={() => onUpdateStatus(next)}
            disabled={isPending}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-lg font-medium text-sm capitalize disabled:opacity-60"
          >
            {isPending ? 'Updating…' : `Mark as ${next.replace('_', ' ')}`}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_COMPLAINTS: Complaint[] = [
  { id: '1', title: 'Lift breakdown — Block B',     description: 'The lift in Block B has been non-functional since yesterday morning.', category: 'lift',     priority: 'high',   status: 'open',        flatDisplay: 'B-203', reporterName: 'Arvind Joshi',  createdAt: '2026-04-26T14:32:00Z', updatedAt: '2026-04-26T14:32:00Z' },
  { id: '2', title: 'Water leakage — 3rd floor',    description: 'Water dripping from the ceiling near the staircase on the 3rd floor.', category: 'plumbing', priority: 'urgent', status: 'in_progress', flatDisplay: 'A-301', reporterName: 'Priya Mehta',   createdAt: '2026-04-25T09:15:00Z', updatedAt: '2026-04-26T10:00:00Z', assignedTo: 'Maintenance Team' },
  { id: '3', title: 'Parking spot occupied',        description: 'Someone has been parking in my allocated spot B2-14 for 3 days.', category: 'parking',  priority: 'medium', status: 'open',        flatDisplay: 'B-101', reporterName: 'Meena Patel',   createdAt: '2026-04-24T18:00:00Z', updatedAt: '2026-04-24T18:00:00Z' },
  { id: '4', title: 'Gym equipment broken',         description: 'The treadmill in the gym is making loud noise and stops randomly.', category: 'facility', priority: 'medium', status: 'resolved',    flatDisplay: 'A-201', reporterName: 'Vikram Nair',   createdAt: '2026-04-20T11:30:00Z', updatedAt: '2026-04-23T16:00:00Z' },
  { id: '5', title: 'Street light not working',     description: 'The street light near gate 2 has been off for 5 days.', category: 'electrical', priority: 'low', status: 'closed', flatDisplay: 'B-102', reporterName: 'Suresh Iyer', createdAt: '2026-04-15T20:00:00Z', updatedAt: '2026-04-18T10:00:00Z' },
]
