'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, Clock, Users, XCircle, Plus, Pencil, Power, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal, Field } from '@/components/ui/Modal'
import {
  EMPTY_FACILITY_FORM, facilityFormError, facilityToForm, toFacilityPayload,
  type FacilityFormValues,
} from '@/lib/facilityForm'

// ── Types — aligned with the API ─────────────────────────────────────────────
// GET /facilities?activeOnly=false → [{ id, name, description, capacityPersons, slotDurationMinutes,
//   openTime, closeTime, isActive, advanceBookingDays, maxBookingsPerFlat }]  (adapted: capacity, slotDuration)
interface Facility {
  id:                 string
  name:               string
  description?:       string
  capacity:           number
  slotDuration?:      number
  openTime?:          string
  closeTime?:         string
  isActive:           boolean
  advanceBookingDays?: number
  maxBookingsPerFlat?: number
}

// GET /facilities/bookings?date= → { items: [{ id, facilityId, facilityName, bookingDate, startTime, endTime, status, flatId, bookedBy }] }
interface Booking {
  id:           string
  facilityName: string
  facilityId:   string
  bookedBy?:    string
  flatDisplay?: string
  startTime:    string
  endTime:      string
  status:       'Confirmed' | 'Pending' | 'Cancelled' | 'Completed'
}

interface FacilitiesResponse { facilities: Facility[] }
interface BookingsResponse   { items: Booking[] }

type Tab = 'bookings' | 'facilities'

export default function FacilitiesPage() {
  const qc = useQueryClient()
  const [tab,        setTab]        = useState<Tab>('bookings')
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10))
  const [editing,    setEditing]    = useState<Facility | 'new' | null>(null)

  const { data: facilitiesData, isLoading } = useQuery<FacilitiesResponse>({
    queryKey: ['facilities'],
    queryFn:  () => api.get('/facilities?activeOnly=false'),
  })
  const facilities: Facility[] = facilitiesData?.facilities ?? []

  const { data: bookingsData } = useQuery<BookingsResponse>({
    queryKey: ['facility-bookings', dateFilter],
    queryFn:  () => api.get(`/facilities/bookings?date=${dateFilter}`),
    enabled:  tab === 'bookings',
  })
  const bookings: Booking[] = bookingsData?.items ?? []

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/facilities/bookings/${id}`),
    onSuccess: () => { toast.success('Booking cancelled'); qc.invalidateQueries({ queryKey: ['facility-bookings'] }) },
    onError:   (e: Error) => toast.error(e.message),
  })

  const activeMutation = useMutation({
    mutationFn: (v: { id: string; isActive: boolean }) => api.put(`/facilities/${v.id}/active`, { isActive: v.isActive }),
    onSuccess: (_d, v) => { toast.success(v.isActive ? 'Facility switched on' : 'Facility switched off'); qc.invalidateQueries({ queryKey: ['facilities'] }) },
    onError:   (e: Error) => toast.error(e.message),
  })

  const liveBookings = bookings.filter(b => b.status !== 'Cancelled')
  const switchedOff  = facilities.filter(f => !f.isActive).length

  return (
    <div className="space-y-5">
      <PageHeader
        title="Facilities"
        description="Amenities residents can book, and who has booked them"
        action={
          <div className="flex gap-2">
            {tab === 'bookings' && (
              <input
                type="date"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                aria-label="Bookings for date"
                className="min-h-[40px] rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-saffron"
              />
            )}
            <Button onClick={() => { setTab('facilities'); setEditing('new') }}><Plus className="h-4 w-4" /> Add facility</Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Facilities" value={facilities.length - switchedOff} />
        <Stat label="Bookings on this date" value={liveBookings.length} tone="brand" />
        <Stat label="Switched off" value={switchedOff} />
      </div>

      <div className="flex w-fit gap-1 rounded-xl bg-surface-alt p-1">
        {(['bookings', 'facilities'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('rounded-lg px-4 py-2 text-sm font-medium capitalize transition',
              tab === t ? 'bg-surface text-ink shadow-sm' : 'text-mute hover:text-ink')}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'bookings' && (
        <div className="space-y-3">
          {bookings.length === 0
            ? <div className="rounded-xl border border-line bg-surface"><EmptyState icon={CalendarCheck} title="No bookings for this date" description="Bookings made by residents show up here." /></div>
            : bookings.map(b => (
                <div key={b.id} className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4">
                  <Building2 className="h-6 w-6 shrink-0 text-mute" aria-hidden="true" />
                  <div className="flex-1">
                    <div className="mb-0.5 flex items-center gap-2">
                      <p className="font-semibold text-ink">{b.facilityName}</p>
                      <Badge label={b.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-mute">
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{b.startTime} – {b.endTime}</span>
                      <span>{b.flatDisplay ?? '—'}</span>
                    </div>
                  </div>
                  {b.status === 'Confirmed' && (
                    <Button variant="danger" className="min-h-[32px] px-3 text-xs"
                      onClick={() => { if (confirm('Cancel this booking?')) cancelMutation.mutate(b.id) }}>
                      <XCircle className="h-3.5 w-3.5" /> Cancel
                    </Button>
                  )}
                </div>
              ))}
        </div>
      )}

      {tab === 'facilities' && (
        facilities.length === 0 && !isLoading
          ? <div className="rounded-xl border border-line bg-surface">
              <EmptyState icon={Building2} title="No facilities yet" description="Add the clubhouse, gym, pool or any hall residents can book." />
            </div>
          : <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {facilities.map(f => (
                <div key={f.id} className={cn('rounded-xl border border-line bg-surface p-5', !f.isActive && 'opacity-70')}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{f.name}</p>
                      <p className="text-xs text-mute">
                        {f.openTime && f.closeTime ? `${f.openTime} – ${f.closeTime}` : ''}
                        {f.slotDuration ? ` · ${f.slotDuration} min slots` : ''}
                      </p>
                    </div>
                    <Badge label={f.isActive ? 'Active' : 'Switched off'} />
                  </div>
                  {f.description && <p className="mb-3 text-sm text-mute">{f.description}</p>}
                  <div className="mb-4 flex flex-wrap gap-4 text-sm text-mute">
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Up to {f.capacity} people</span>
                    {f.advanceBookingDays != null && <span>Book up to {f.advanceBookingDays} days ahead</span>}
                    {f.maxBookingsPerFlat != null && <span>{f.maxBookingsPerFlat} per flat</span>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="min-h-[32px] px-3 text-xs" onClick={() => setEditing(f)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button variant={f.isActive ? 'danger' : 'secondary'} className="min-h-[32px] px-3 text-xs"
                      loading={activeMutation.isPending && activeMutation.variables?.id === f.id}
                      onClick={() => activeMutation.mutate({ id: f.id, isActive: !f.isActive })}>
                      <Power className="h-3.5 w-3.5" /> {f.isActive ? 'Switch off' : 'Switch on'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
      )}

      {editing && (
        <FacilityModal
          facility={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['facilities'] }) }}
        />
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'brand' }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs text-mute">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold', tone === 'brand' ? 'text-brand-600' : 'text-ink')}>{value}</p>
    </div>
  )
}

function FacilityModal({ facility, onClose, onSaved }: { facility: Facility | null; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState<FacilityFormValues>(facility ? facilityToForm(facility) : EMPTY_FACILITY_FORM)
  const [showError, setShowError] = useState(false)
  const error = facilityFormError(v)
  const set = (k: keyof FacilityFormValues) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value })

  const save = useMutation({
    mutationFn: () => facility
      ? api.put(`/facilities/${facility.id}`, toFacilityPayload(v))
      : api.post('/facilities', toFacilityPayload(v)),
    onSuccess: () => { toast.success(facility ? 'Facility updated' : 'Facility added'); onSaved() },
    onError:   (e: Error) => toast.error(e.message),
  })

  return (
    <Modal title={facility ? 'Edit facility' : 'Add facility'} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={e => { e.preventDefault(); if (error) setShowError(true); else save.mutate() }}
      >
        <Field label="Name"><Input value={v.name} onChange={set('name')} placeholder="Clubhouse" maxLength={100} autoFocus /></Field>
        <Field label="Description (optional)"><Input value={v.description} onChange={set('description')} placeholder="Party hall with kitchen" maxLength={500} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Capacity (people)"><Input inputMode="numeric" value={v.capacity} onChange={set('capacity')} /></Field>
          <Field label="Slot length (minutes)" hint="For example 30, 60 or 90"><Input inputMode="numeric" value={v.slotMinutes} onChange={set('slotMinutes')} /></Field>
          <Field label="Opens"><Input type="time" value={v.openTime} onChange={set('openTime')} /></Field>
          <Field label="Closes"><Input type="time" value={v.closeTime} onChange={set('closeTime')} /></Field>
          <Field label="Book up to (days ahead)"><Input inputMode="numeric" value={v.advanceDays} onChange={set('advanceDays')} /></Field>
          <Field label="Bookings per flat"><Input inputMode="numeric" value={v.maxPerFlat} onChange={set('maxPerFlat')} /></Field>
        </div>
        {showError && error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={save.isPending}>{facility ? 'Save changes' : 'Add facility'}</Button>
        </div>
      </form>
    </Modal>
  )
}
