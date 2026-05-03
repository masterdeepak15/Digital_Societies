'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, Clock, Users, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDate, cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

// ── Types — aligned with API ─────────────────────────────────────────────────
// API GET /facilities → { facilities: [{ id, name, type, capacity, availableSlots, rate }] }
interface Facility {
  id:              string
  name:            string
  type?:           string
  capacity:        number
  availableSlots?: number
  rate?:           number
  // UI-only fields kept for the demo card; populated from a future endpoint.
  description?:    string
  openTime?:       string
  closeTime?:      string
  slotDuration?:   number
  bookingsToday?:  number
}

// API GET /facilities/bookings?date= → { items: [{ id, facilityId, facilityName, bookingDate, startTime, endTime, status, flatId, bookedBy }] }
interface Booking {
  id:           string
  facilityName: string
  facilityId:   string
  bookedBy?:    string
  residentName?:string  // alias used by demo data
  flatId?:      string
  flatDisplay?: string
  bookingDate?: string
  date?:        string  // legacy
  startTime:    string
  endTime:      string
  status:       'Confirmed' | 'Pending' | 'Cancelled' | 'Completed'
  guestCount?:  number
}

interface FacilitiesResponse { facilities: Facility[] }
interface BookingsResponse   { items: Booking[]; total?: number }

type Tab = 'bookings' | 'facilities'

const FACILITY_ICONS: Record<string, string> = {
  'Clubhouse':   '🏛️',
  'Gym':         '💪',
  'Swimming Pool': '🏊',
  'Tennis Court': '🎾',
  'Badminton Court': '🏸',
  'Party Hall':  '🎉',
  'Kids Play Area': '🎠',
  'Terrace Garden': '🌿',
}

export default function FacilitiesPage() {
  const qc = useQueryClient()
  const [tab,      setTab]      = useState<Tab>('bookings')
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10))

  const { data: facilitiesData } = useQuery<FacilitiesResponse>({
    queryKey: ['facilities'],
    queryFn:  () => api.get('/facilities'),
  })
  const facilities: Facility[] = facilitiesData?.facilities ?? DEMO_FACILITIES

  const { data: bookingsData } = useQuery<BookingsResponse>({
    queryKey: ['facility-bookings', dateFilter],
    queryFn:  () => api.get(`/facilities/bookings?date=${dateFilter}`),
    enabled:  tab === 'bookings',
  })
  const bookings: Booking[] = bookingsData?.items ?? DEMO_BOOKINGS

  const cancelMutation = useMutation({
    // Admin cancel: DELETE /facilities/bookings/{id}
    mutationFn: (id: string) => api.delete(`/facilities/bookings/${id}`),
    onSuccess: () => { toast.success('Booking cancelled'); qc.invalidateQueries({ queryKey: ['facility-bookings'] }) },
    onError:   (e: Error) => toast.error(e.message),
  })

  // NOTE: Backend has no PATCH /facilities/{id} endpoint to toggle active state.
  // The UI now shows active state read-only with the badge; toggle returns when API ships.

  const todayBookings = bookings.filter(b => b.status !== 'Cancelled')

  return (
    <div className="space-y-5">
      <PageHeader
        title="Facilities"
        description="Amenity bookings and facility management"
        action={
          <div className="flex gap-2">
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        }
      />

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total Facilities</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{facilities.length}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Bookings Today</p>
          <p className="text-2xl font-bold text-brand-600 mt-1">{todayBookings.length}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Peak Hour</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">6–8 PM</p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['bookings', 'facilities'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium capitalize transition',
              tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Bookings tab ─────────────────────────────────────────────────────── */}
      {tab === 'bookings' && (
        <div className="space-y-3">
          {bookings.length === 0
            ? <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
                <EmptyState icon={CalendarCheck} title="No bookings for this date" />
              </div>
            : bookings.map(b => (
                <div key={b.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 flex items-center gap-4">
                  <div className="text-3xl">{FACILITY_ICONS[b.facilityName] ?? '🏢'}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-gray-800">{b.facilityName}</p>
                      <Badge label={b.status} />
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{b.startTime} – {b.endTime}</span>
                      {typeof b.guestCount === 'number' && (
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{b.guestCount} guests</span>
                      )}
                      <span>{b.bookedBy ?? b.residentName ?? '—'}{b.flatDisplay ? ` · ${b.flatDisplay}` : ''}</span>
                    </div>
                  </div>
                  {b.status === 'Confirmed' && (
                    <button onClick={() => { if (confirm('Cancel this booking?')) cancelMutation.mutate(b.id) }}
                      className="flex items-center gap-1 text-xs text-red-600 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg">
                      <XCircle className="w-3.5 h-3.5" /> Cancel
                    </button>
                  )}
                </div>
              ))
          }
        </div>
      )}

      {/* ── Facilities management tab ─────────────────────────────────────────── */}
      {tab === 'facilities' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {facilities.map(f => (
            <div key={f.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{FACILITY_ICONS[f.name] ?? '🏢'}</span>
                  <div>
                    <p className="font-semibold text-gray-800">{f.name}</p>
                    <p className="text-xs text-gray-400">
                      {f.openTime && f.closeTime ? `${f.openTime} – ${f.closeTime}` : (f.type ?? '—')}
                      {f.slotDuration ? ` · ${f.slotDuration} min slots` : ''}
                    </p>
                  </div>
                </div>
                {/* Active toggle removed — backend has no PATCH /facilities/{id} endpoint yet. */}
                <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-lg">
                  <CheckCircle className="w-3.5 h-3.5" /> Active
                </span>
              </div>
              {f.description && <p className="text-sm text-gray-500 mb-3">{f.description}</p>}
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1 text-gray-500"><Users className="w-3.5 h-3.5" /> Capacity {f.capacity}</span>
                {typeof f.availableSlots === 'number' && (
                  <span className="text-brand-600 font-medium">{f.availableSlots} slots available</span>
                )}
                {typeof f.rate === 'number' && (
                  <span className="text-gray-500">₹{f.rate}/booking</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_FACILITIES: Facility[] = [
  { id:'1', name:'Clubhouse',       type:'Indoor', capacity:50, availableSlots:6, rate:500, description:'Air-conditioned hall for meetings and events. Projector available.', openTime:'09:00', closeTime:'22:00', slotDuration:60 },
  { id:'2', name:'Gym',             type:'Indoor', capacity:15, availableSlots:3, rate:0,   description:'Fully equipped gym with cardio and weight training equipment.',     openTime:'05:30', closeTime:'22:00', slotDuration:60 },
  { id:'3', name:'Swimming Pool',   type:'Outdoor',capacity:20, availableSlots:8, rate:100, description:'25m outdoor pool, heated Oct–Feb. Lifeguard on duty 7AM–8PM.',     openTime:'06:00', closeTime:'20:00', slotDuration:60 },
  { id:'4', name:'Badminton Court', type:'Indoor', capacity:8,  availableSlots:5, rate:200, description:'2 indoor courts with synthetic flooring. Rackets available on request.', openTime:'06:00', closeTime:'22:00', slotDuration:60 },
  { id:'5', name:'Party Hall',      type:'Indoor', capacity:30, availableSlots:1, rate:1500,description:'500 sq ft hall for private celebrations. Kitchenette included.', openTime:'10:00', closeTime:'23:00', slotDuration:120 },
  { id:'6', name:'Terrace Garden',  type:'Outdoor',capacity:25, availableSlots:6, rate:300, description:'Rooftop garden space. No loud music permitted after 10 PM.',     openTime:'07:00', closeTime:'22:00', slotDuration:60 },
]

const DEMO_BOOKINGS: Booking[] = [
  { id:'1', facilityId:'2', facilityName:'Gym',             bookedBy:'Rajesh Sharma', flatDisplay:'A-101', bookingDate:'2026-04-28', startTime:'06:00', endTime:'07:00', status:'Confirmed', guestCount:1 },
  { id:'2', facilityId:'3', facilityName:'Swimming Pool',   bookedBy:'Priya Mehta',   flatDisplay:'A-102', bookingDate:'2026-04-28', startTime:'07:00', endTime:'08:00', status:'Confirmed', guestCount:2 },
  { id:'3', facilityId:'1', facilityName:'Clubhouse',       bookedBy:'Anita Desai',   flatDisplay:'A-104', bookingDate:'2026-04-28', startTime:'18:00', endTime:'20:00', status:'Confirmed', guestCount:15 },
  { id:'4', facilityId:'4', facilityName:'Badminton Court', bookedBy:'Vikram Nair',   flatDisplay:'A-105', bookingDate:'2026-04-28', startTime:'19:00', endTime:'20:00', status:'Pending',   guestCount:4 },
  { id:'5', facilityId:'5', facilityName:'Party Hall',      bookedBy:'Meena Patel',   flatDisplay:'B-101', bookingDate:'2026-04-28', startTime:'20:00', endTime:'23:00', status:'Confirmed', guestCount:25 },
]
