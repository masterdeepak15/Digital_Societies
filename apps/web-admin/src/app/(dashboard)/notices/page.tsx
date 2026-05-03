'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Plus, Trash2, Pin } from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { api } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { formatDateTime } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'

// ── Types — aligned with API: { id, title, body, type, isPinned, createdAt, expiresAt? } ─
type NoticeType = 'Notice' | 'Emergency' | 'Event' | 'Circular'

interface Notice {
  id:          string
  title:       string
  body:        string
  type:        NoticeType
  isPinned:    boolean
  createdAt:   string
  expiresAt?:  string | null
  authorName?: string  // optional UI-only, populated when backend joins author
}

interface NoticesPage { items: Notice[]; total: number; page: number; pageSize: number }

// Form drives the POST body. Pinning is a separate PUT after the notice is created.
interface NoticeForm {
  title:     string
  body:      string
  type:      NoticeType
  pinAfter:  boolean
  expiresAt: string  // ISO datetime-local; optional → '' means no expiry
}

const TYPES: NoticeType[] = ['Notice', 'Emergency', 'Event', 'Circular']

export default function NoticesPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data } = useQuery<NoticesPage>({
    queryKey: ['notices'],
    queryFn:  () => api.get('/notices'),
  })
  const notices: Notice[] = data?.items ?? DEMO_NOTICES

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notices/${id}`),
    onSuccess: () => { toast.success('Notice deleted'); qc.invalidateQueries({ queryKey: ['notices'] }) },
    onError:   (e: Error) => toast.error(e.message),
  })

  // API: PUT /notices/{id}/pin (NOT patch).
  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      api.put(`/notices/${id}/pin`, { isPinned: pinned }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notices'] }),
    onError:   (e: Error) => toast.error(e.message),
  })

  const sorted = [...notices].sort((a, b) =>
    (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) ||
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notice Board"
        description="Publish announcements to all residents"
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> New Notice
          </button>
        }
      />

      {notices.length === 0 ? (
        <EmptyState icon={Bell} title="No notices yet" description="Create your first notice to inform residents." />
      ) : (
        <div className="space-y-3">
          {sorted.map(n => (
            <div
              key={n.id}
              className={cn(
                'bg-white border rounded-xl shadow-sm overflow-hidden',
                n.isPinned ? 'border-amber-200' : 'border-gray-100'
              )}
            >
              <div
                className="flex items-start gap-4 p-5 cursor-pointer"
                onClick={() => setExpandedId(expandedId === n.id ? null : n.id)}
              >
                <div className={cn(
                  'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
                  n.type === 'Emergency' ? 'bg-red-100' :
                  n.type === 'Circular'  ? 'bg-blue-100' :
                  n.type === 'Event'     ? 'bg-purple-100' : 'bg-gray-100'
                )}>
                  <Bell className={cn(
                    'w-5 h-5',
                    n.type === 'Emergency' ? 'text-red-600' :
                    n.type === 'Circular'  ? 'text-blue-600' :
                    n.type === 'Event'     ? 'text-purple-600' : 'text-gray-500'
                  )} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {n.isPinned && <Pin className="w-3.5 h-3.5 text-amber-500" />}
                    <h3 className="font-semibold text-gray-800 truncate">{n.title}</h3>
                    <Badge label={n.type} />
                  </div>
                  <p className={cn('text-sm text-gray-500', expandedId !== n.id && 'truncate max-w-xl')}>
                    {n.body}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {n.authorName ? `${n.authorName} · ` : ''}{formatDateTime(n.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => pinMutation.mutate({ id: n.id, pinned: !n.isPinned })}
                    className={cn(
                      'p-1.5 rounded-lg transition',
                      n.isPinned ? 'text-amber-500 bg-amber-50 hover:bg-amber-100' : 'text-gray-400 hover:bg-gray-100'
                    )}
                    title={n.isPinned ? 'Unpin' : 'Pin'}
                  >
                    <Pin className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { if (confirm('Delete this notice?')) deleteMutation.mutate(n.id) }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create notice modal */}
      {showCreate && (
        <CreateNoticeModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { qc.invalidateQueries({ queryKey: ['notices'] }); setShowCreate(false) }}
        />
      )}
    </div>
  )
}

// ── Create Notice Modal ───────────────────────────────────────────────────────
function CreateNoticeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<NoticeForm>({
    defaultValues: { type: 'Notice', pinAfter: false, expiresAt: '' },
  })

  // Backend contract: POST /notices { societyId, title, body, type, expiresAt? }
  // Pinning is a separate PUT after the notice id is known.
  const mutation = useMutation({
    mutationFn: async (form: NoticeForm) => {
      const societyId = getUser()?.societyId
      if (!societyId) throw new Error('Not signed in to a society')
      const payload = {
        societyId,
        title:     form.title,
        body:      form.body,
        type:      form.type,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      }
      const created = await api.post<{ noticeId: string }>('/notices', payload)
      if (form.pinAfter && created.noticeId) {
        await api.put(`/notices/${created.noticeId}/pin`, { isPinned: true })
      }
      return created
    },
    onSuccess: () => { toast.success('Notice published!'); onCreated() },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit(d => mutation.mutate(d))}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-semibold text-lg">New Notice</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            {...register('title', { required: 'Title is required' })}
            placeholder="AGM scheduled for 5 May 2026"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Message</label>
          <textarea
            {...register('body', { required: 'Message is required' })}
            rows={4}
            placeholder="Dear residents, the Annual General Meeting is scheduled…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
          {errors.body && <p className="text-xs text-red-500 mt-1">{errors.body.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              {...register('type')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 mt-6">
            <input type="checkbox" id="pinned" {...register('pinAfter')} className="w-4 h-4 accent-brand-600" />
            <label htmlFor="pinned" className="text-sm font-medium">Pin to top</label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Expires at <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
          <input type="datetime-local" {...register('expiresAt')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 border border-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60"
          >
            {mutation.isPending ? 'Publishing…' : 'Publish Notice'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_NOTICES: Notice[] = [
  { id: '1', title: 'AGM scheduled — 5 May 2026',         body: 'The Annual General Meeting is scheduled for Tuesday 5 May 2026 at 7:00 PM in the Club House. Attendance is mandatory for all flat owners.',          type: 'Event',     isPinned: true,  createdAt: '2026-04-25T11:00:00Z', authorName: 'Rajesh Sharma' },
  { id: '2', title: 'Water supply interruption — 28 Apr', body: 'Due to pipeline maintenance, water supply will be interrupted from 10 AM to 2 PM on April 28. Please store water accordingly.',                       type: 'Notice',    isPinned: false, createdAt: '2026-04-24T09:00:00Z', authorName: 'Rajesh Sharma' },
  { id: '3', title: 'April maintenance bills generated',  body: 'Maintenance bills for April 2026 have been generated. Please pay by 10 April to avoid late payment charges of ₹500 per month.',                       type: 'Circular',  isPinned: false, createdAt: '2026-04-01T09:00:00Z', authorName: 'Pooja Verma'   },
  { id: '4', title: 'New security protocol at Gate 1',    body: 'Starting 1 May, all visitors must show a photo ID at Gate 1. Pre-approved visitors via the Digital Societies app can use their OTP for faster entry.', type: 'Notice',    isPinned: false, createdAt: '2026-04-20T10:00:00Z', authorName: 'Sanjay Gupta'  },
]
