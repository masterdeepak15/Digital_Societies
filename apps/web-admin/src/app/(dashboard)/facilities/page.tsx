'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, Plus, Clock, Users, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDate, formatDateTime, cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Facility {
  id:           string
  name:         string
  description:  string
  capacity:     number
  openTime:     string   // "06:00"
  closeTime:    string   // "22:00"
  slotDuration: number   // minutes
  isActive:     boolean
  bookingsToday: number
}

interface Booking {
  id:           string
  facilityName: string
  facilityId:   string
  residentName: string
  flatDisplay:  string
  date:         string
  startTime:    string
  endTime:      string
  status:       'confirmed' | 'pending' | 'cancelled'
  guestCount:   number
}

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

  const { data: facilities = DEMO_FACILITIES } = useQuery<Facility[]>({
    queryKey: ['facilities'],
    queryFn:  () => api.get('/facilities'),
  })

  const { data: bookings = DEMO_BOOKINGS } = useQuery<Booking[]>({
    queryKey: ['facility-bookings', dateFilter],
    queryFn:  () => api.get(`/facilities/bookings?date=${dateFilter}`),
    enabled:  tab === 'bookings',
  })

  const cancelMutation = useMutation({
    // Admin cancel: DELETE /facilities/bookings/{id}
    mutationFn: (id: string) => api.delete(`/facilities/bookings/${id}`),
    onSuccess: () => { toast.success('Booking cancelled'); qc.invalidateQueries({ queryKey: ['facility-bookings'] }) },
    onError:   (e: Error) => toast.error(e.message),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/facilities/${id}`, { isActive: active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['facilities'] }),
    onError:   (e: Error) => toast.error(e.message),
  })

  const todayBookings = bookings.filter(b => b.status !== 'cancelled')

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
          <p className="text-xs text-gray-500">Active Facilities</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{facilities.filter(f => f.isActive).length}</p>
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
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{b.guestCount} guests</span>
                      <span>{b.residentName} · {b.flatDisplay}</span>
                    </div>
                  </div>
                  {b.status === 'confirmed' && (
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
            <div key={f.id} className={cn('bg-white border rounded-xl shadow-sm p-5',
              f.isActive ? 'border-gray-100' : 'border-gray-200 opacity-60')}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{FACILITY_ICONS[f.name] ?? '🏢'}</span>
                  <div>
                    <p className="font-semibold text-gray-800">{f.name}</p>
                    <p className="text-xs text-gray-400">{f.openTime} – {f.closeTime} · {f.slotDuration} min slots</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleMutation.mutate({ id: f.id, active: !f.isActive })}
                  className={cn('flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border transition',
                    f.isActive
                      ? 'text-green-700 border-green-200 hover:bg-green-50'
                      : 'text-gray-500 border-gray-200 hover:bg-gray-50')}>
                  {f.isActive ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  {f.isActive ? 'Active' : 'Inactive'}
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-3">{f.description}</p>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1 text-gray-500"><Users className="w-3.5 h-3.5" /> Capacity {f.capacity}</span>
                <span className="text-brand-600 font-medium">{f.bookingsToday} bookings today</span>
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
  { id:'1', name:'Clubhouse',      description:'Air-conditioned hall for meetings and events. Projector available.',          capacity:50,  openTime:'09:00', closeTime:'22:00', slotDuration:60, isActive:true, bookingsToday:2 },
  { id:'2', name:'Gym',            description:'Fully equipped gym with cardio and weight training equipment.',               capacity:15,  openTime:'05:30', closeTime:'22:00', slotDuration:60, isActive:true, bookingsToday:8 },
  { id:'3', name:'Swimming Pool',  description:'25m outdoor pool, heated Oct–Feb. Lifeguard on duty 7AM–8PM.',              capacity:20,  openTime:'06:00', closeTime:'20:00', slotDuration:60, isActive:true, bookingsToday:5 },
  { id:'4', name:'Badminton Court',description:'2 indoor courts with synthetic flooring. Rackets available on request.',    capacity:8,   openTime:'06:00', closeTime:'22:00', slotDuration:60, isActive:true, bookingsToday:3 },
  { id:'5', name:'Party Hall',     description:'500 sq ft hall for private celebrations. Kitchenette included.',            capacity:30,  openTime:'10:00', closeTime:'23:00', slotDuration:120,isActive:true, bookingsToday:1 },
  { id:'6', name:'Terrace Garden', description:'Rooftop garden space. No loud music permitted after 10 PM.',                capacity:25,  openTime:'07:00', closeTime:'22:00', slotDuration:60, isActive:false,bookingsToday:0 },
]

const DEMO_BOOKINGS: Booking[] = [
  { id:'1', facilityId:'2', facilityName:'Gym',            residentName:'Rajesh Sharma', flatDisplay:'A-101', date:'2026-04-28', startTime:'06:00', endTime:'07:00', status:'confirmed', guestCount:1 },
  { id:'2', facilityId:'3', facilityName:'Swimming Pool',  residentName:'Priya Mehta',   flatDisplay:'A-102', date:'2026-04-28', startTime:'07:00', endTime:'08:00', status:'confirmed', guestCount:2 },
  { id:'3', facilityId:'1', facilityName:'Clubhouse',      residentName:'Anita Desai',   flatDisplay:'A-104', date:'2026-04-28', startTime:'18:00', endTime:'20:00', status:'confirmed', guestCount:15 },
  { id:'4', facilityId:'4', facilityName:'Badminton Court',residentName:'Vikram Nair',   flatDisplay:'A-105', date:'2026-04-28', startTime:'19:00', endTime:'20:00', status:'pending',   guestCount:4 },
  { id:'5', facilityId:'5', facilityName:'Party Hall',     residentName:'Meena Patel',   flatDisplay:'B-101', date:'2026-04-28', startTime:'20:00', endTime:'23:00', status:'confirmed', guestCount:25 },
]
