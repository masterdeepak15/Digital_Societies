'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Car, Zap, Bike, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

// ── Types ─────────────────────────────────────────────────────────────────────
interface ParkingLevel {
  id:             string
  name:           string
  levelNumber:    number
  totalSlots:     number
  availableSlots: number
  floorPlanUrl?:  string
}

interface ParkingSlot {
  id:                  string
  slotNumber:          string
  type:                'car' | 'bike' | 'ev'
  status:              'Available' | 'AssignedResident' | 'VisitorPass' | 'Blocked'
  isEvCharger:         boolean
  assignedFlatNumber?: string
  vehicleNumber?:      string
}

type SlotFilter = 'all' | 'Available' | 'AssignedResident' | 'VisitorPass'

const SLOT_STATUS_COLOR: Record<string, string> = {
  Available:        'bg-green-100 border-green-300 text-green-700',
  AssignedResident: 'bg-blue-100 border-blue-300 text-blue-700',
  VisitorPass:      'bg-amber-100 border-amber-300 text-amber-700',
  Blocked:          'bg-gray-100 border-gray-300 text-gray-400',
}

const SLOT_TYPE_ICON = { car: Car, bike: Bike, ev: Zap }

export default function ParkingPage() {
  const qc = useQueryClient()
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null)
  const [filter, setFilter]     = useState<SlotFilter>('all')
  const [search, setSearch]     = useState('')
  const [assignModal, setAssignModal] = useState<ParkingSlot | null>(null)

  const { data: levels = DEMO_LEVELS } = useQuery<ParkingLevel[]>({
    queryKey: ['parking-levels'],
    queryFn:  () => api.get('/parking/levels'),
    onSuccess: (data: ParkingLevel[]) => { if (!selectedLevel && data[0]) setSelectedLevel(data[0].id) },
  } as Parameters<typeof useQuery>[0])

  const activeLevel = selectedLevel ?? (levels[0]?.id ?? null)

  const { data: slots = DEMO_SLOTS } = useQuery<ParkingSlot[]>({
    queryKey: ['parking-slots', activeLevel],
    queryFn:  () => api.get(`/parking/levels/${activeLevel}/slots`),
    enabled:  !!activeLevel,
  })

  const unassignMutation = useMutation({
    mutationFn: (slotId: string) => api.post(`/parking/slots/${slotId}/unassign`, {}),
    onSuccess:  () => { toast.success('Slot unassigned'); qc.invalidateQueries({ queryKey: ['parking-slots'] }) },
    onError:    (e: Error) => toast.error(e.message),
  })

  const filtered = slots.filter(s =>
    (filter === 'all' || s.status === filter) &&
    (search === '' || s.slotNumber.toLowerCase().includes(search.toLowerCase()) ||
     (s.assignedFlatNumber ?? '').toLowerCase().includes(search.toLowerCase()) ||
     (s.vehicleNumber ?? '').toLowerCase().includes(search.toLowerCase()))
  )

  const currentLevel = levels.find(l => l.id === activeLevel)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Parking"
        description="Slot allocation and visitor passes"
        action={
          <button className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Slot
          </button>
        }
      />

      {/* Level summary cards */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {levels.map(level => (
          <button
            key={level.id}
            onClick={() => setSelectedLevel(level.id)}
            className={cn(
              'shrink-0 bg-white border rounded-xl p-4 text-left shadow-sm transition min-w-40',
              activeLevel === level.id ? 'border-brand-500 ring-2 ring-brand-200' : 'border-gray-100 hover:border-gray-300'
            )}>
            <p className="font-bold text-gray-800">{level.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{level.totalSlots} total slots</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${(level.availableSlots / level.totalSlots) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-green-600">{level.availableSlots} free</span>
            </div>
          </button>
        ))}
      </div>

      {/* Stats for selected level */}
      {currentLevel && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total',     val: currentLevel.totalSlots,                                    color: 'text-gray-900'  },
            { label: 'Available', val: slots.filter(s => s.status === 'Available').length,         color: 'text-green-600' },
            { label: 'Occupied',  val: slots.filter(s => s.status === 'AssignedResident').length,  color: 'text-blue-600'  },
            { label: 'Visitor',   val: slots.filter(s => s.status === 'VisitorPass').length,       color: 'text-amber-600' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm text-center">
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Slot number, flat, vehicle…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['all', 'Available', 'AssignedResident', 'VisitorPass'] as SlotFilter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition',
                filter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
              {f === 'AssignedResident' ? 'Residents' : f === 'VisitorPass' ? 'Visitors' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Slot grid */}
      {filtered.length === 0
        ? <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
            <EmptyState icon={Car} title="No slots match this filter" />
          </div>
        : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.map(slot => {
              const Icon = SLOT_TYPE_ICON[slot.type] ?? Car
              return (
                <div key={slot.id}
                  className={cn('border-2 rounded-xl p-3 cursor-pointer hover:shadow-md transition',
                    SLOT_STATUS_COLOR[slot.status])}
                  onClick={() => slot.status === 'AssignedResident' && setAssignModal(slot)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm">{slot.slotNumber}</span>
                    <Icon className="w-4 h-4" />
                  </div>
                  {slot.isEvCharger && <span className="text-xs bg-green-200 text-green-800 px-1.5 py-0.5 rounded-full font-medium">⚡ EV</span>}
                  {slot.assignedFlatNumber && (
                    <p className="text-xs mt-1 font-medium truncate">{slot.assignedFlatNumber}</p>
                  )}
                  {slot.vehicleNumber && (
                    <p className="text-xs text-gray-500 truncate">{slot.vehicleNumber}</p>
                  )}
                  <p className="text-xs mt-1 opacity-70 capitalize">{slot.status.replace(/([A-Z])/g, ' $1').trim()}</p>
                </div>
              )
            })}
          </div>
        )
      }

      {/* Unassign modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">Slot {assignModal.slotNumber}</h2>
            <div className="text-sm space-y-1">
              <p><span className="text-gray-400">Flat:</span> <b>{assignModal.assignedFlatNumber}</b></p>
              <p><span className="text-gray-400">Vehicle:</span> <b>{assignModal.vehicleNumber ?? '—'}</b></p>
              <p><span className="text-gray-400">Type:</span> <b className="capitalize">{assignModal.type}</b></p>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setAssignModal(null)} className="flex-1 border border-gray-200 py-2 rounded-lg text-sm hover:bg-gray-50">Close</button>
              <button
                onClick={() => { unassignMutation.mutate(assignModal.id); setAssignModal(null) }}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-medium">
                Unassign Slot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_LEVELS: ParkingLevel[] = [
  { id: 'L1', name: 'B1 — Basement', levelNumber: -1, totalSlots: 16, availableSlots: 4 },
  { id: 'L2', name: 'B2 — Basement', levelNumber: -2, totalSlots: 12, availableSlots: 6 },
]

const DEMO_SLOTS: ParkingSlot[] = [
  { id:'s1',  slotNumber:'B1-01', type:'car',  status:'AssignedResident', isEvCharger:false, assignedFlatNumber:'A-101', vehicleNumber:'MH12AB1234' },
  { id:'s2',  slotNumber:'B1-02', type:'car',  status:'AssignedResident', isEvCharger:false, assignedFlatNumber:'A-102', vehicleNumber:'MH12CD5678' },
  { id:'s3',  slotNumber:'B1-03', type:'car',  status:'Available',         isEvCharger:false },
  { id:'s4',  slotNumber:'B1-04', type:'car',  status:'AssignedResident', isEvCharger:false, assignedFlatNumber:'A-104', vehicleNumber:'MH12EF9012' },
  { id:'s5',  slotNumber:'B1-05', type:'car',  status:'VisitorPass',       isEvCharger:false },
  { id:'s6',  slotNumber:'B1-06', type:'car',  status:'Available',         isEvCharger:false },
  { id:'s7',  slotNumber:'B1-07', type:'car',  status:'AssignedResident', isEvCharger:false, assignedFlatNumber:'B-101', vehicleNumber:'MH12GH3456' },
  { id:'s8',  slotNumber:'B1-08', type:'car',  status:'AssignedResident', isEvCharger:false, assignedFlatNumber:'B-102', vehicleNumber:'MH12IJ7890' },
  { id:'s9',  slotNumber:'B1-09', type:'car',  status:'Available',         isEvCharger:false },
  { id:'s10', slotNumber:'B1-10', type:'car',  status:'AssignedResident', isEvCharger:false, assignedFlatNumber:'B-103', vehicleNumber:'MH12KL1234' },
  { id:'s11', slotNumber:'B1-E1', type:'ev',   status:'Available',         isEvCharger:true  },
  { id:'s12', slotNumber:'B1-E2', type:'ev',   status:'AssignedResident', isEvCharger:true,  assignedFlatNumber:'A-103', vehicleNumber:'MH12EV5678' },
  { id:'s13', slotNumber:'B1-K1', type:'bike', status:'AssignedResident', isEvCharger:false, assignedFlatNumber:'A-101' },
  { id:'s14', slotNumber:'B1-K2', type:'bike', status:'Available',         isEvCharger:false },
  { id:'s15', slotNumber:'B1-K3', type:'bike', status:'AssignedResident', isEvCharger:false, assignedFlatNumber:'A-102' },
  { id:'s16', slotNumber:'B1-K4', type:'bike', status:'Available',         isEvCharger:false },
]
