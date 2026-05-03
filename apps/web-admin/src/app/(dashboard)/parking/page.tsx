'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Car, Zap, Bike, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

// ── Types — aligned with API ParkingLevelDto / ParkingSlotDto ────────────────
// GET /parking/levels → { levels: ParkingLevelDto[] }
// ParkingLevelDto: { id, name, totalSlots, occupiedSlots }
interface ParkingLevel {
  id:            string
  name:          string
  totalSlots:    number
  occupiedSlots: number
  // UI-derived:
  availableSlots?: number
}

// GET /parking/levels/{id}/slots → { slots: ApiSlot[] }
// ApiSlot: { id, number, status: "Available"|"Assigned", assignedFlatId?, assignedVehicle? }
interface ApiSlot {
  id:               string
  number:           string
  status:           'Available' | 'Assigned'
  assignedFlatId?:  string
  assignedVehicle?: string
}

// UI slot — adds display-only fields
interface ParkingSlot {
  id:                  string
  slotNumber:          string
  type:                'car' | 'bike' | 'ev'
  status:              'Available' | 'AssignedResident' | 'VisitorPass' | 'Blocked'
  isEvCharger:         boolean
  assignedFlatNumber?: string
  vehicleNumber?:      string
}

/** Map the lean API slot to the richer UI slot. */
function toUiSlot(s: ApiSlot): ParkingSlot {
  return {
    id:                 s.id,
    slotNumber:         s.number,
    type:               'car',            // API doesn't return type yet
    status:             s.status === 'Assigned' ? 'AssignedResident' : 'Available',
    isEvCharger:        false,            // API doesn't return this yet
    assignedFlatNumber: s.assignedFlatId, // flatId used as display until flatNumber is joined
    vehicleNumber:      s.assignedVehicle,
  }
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
  const [filter,       setFilter]        = useState<SlotFilter>('all')
  const [search,       setSearch]        = useState('')
  const [assignModal,  setAssignModal]   = useState<ParkingSlot | null>(null)  // for unassign (occupied slot)
  const [allocateSlot, setAllocateSlot]  = useState<ParkingSlot | null>(null)  // for assign (available slot)
  const [visitorSlot,  setVisitorSlot]   = useState<ParkingSlot | null>(null)  // for visitor pass
  const [showAddSlot,  setShowAddSlot]   = useState(false)

  // API: GET /parking/levels → { levels: ParkingLevelDto[] }
  const { data: levels = DEMO_LEVELS } = useQuery<ParkingLevel[]>({
    queryKey: ['parking-levels'],
    queryFn:  async () => {
      const res = await api.get<{ levels: ParkingLevel[] }>('/parking/levels')
      // Derive availableSlots from occupiedSlots
      return (res.levels ?? []).map(l => ({
        ...l,
        availableSlots: Math.max(0, l.totalSlots - (l.occupiedSlots ?? 0)),
      }))
    },
  })

  // Auto-select first level when data loads (replaces removed onSuccess)
  useEffect(() => {
    if (!selectedLevel && levels[0]) setSelectedLevel(levels[0].id)
  }, [levels, selectedLevel])

  const activeLevel = selectedLevel ?? (levels[0]?.id ?? null)

  // API: GET /parking/levels/{id}/slots → { slots: ApiSlot[] }
  const { data: slots = DEMO_SLOTS } = useQuery<ParkingSlot[]>({
    queryKey: ['parking-slots', activeLevel],
    queryFn:  async () => {
      const res = await api.get<{ slots: ApiSlot[] }>(`/parking/levels/${activeLevel}/slots`)
      return (res.slots ?? []).map(toUiSlot)
    },
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
          <button
            onClick={() => setShowAddSlot(true)}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
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
                  style={{ width: `${((level.availableSlots ?? 0) / level.totalSlots) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-green-600">{level.availableSlots ?? 0} free</span>
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
                  onClick={() => {
                    if (slot.status === 'AssignedResident') setAssignModal(slot)
                    else if (slot.status === 'Available')    setAllocateSlot(slot)
                    else if (slot.status === 'VisitorPass')  setVisitorSlot(slot)
                  }}>
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

      {/* Unassign modal — occupied slot */}
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

      {/* Assign modal — available slot */}
      {allocateSlot && (
        <AssignSlotModal
          slot={allocateSlot}
          onClose={() => setAllocateSlot(null)}
          onAssigned={() => { qc.invalidateQueries({ queryKey: ['parking-slots'] }); setAllocateSlot(null) }}
        />
      )}

      {/* Visitor pass modal */}
      {visitorSlot && (
        <VisitorPassModal
          slot={visitorSlot}
          onClose={() => setVisitorSlot(null)}
          onCreated={() => { qc.invalidateQueries({ queryKey: ['parking-slots'] }); setVisitorSlot(null) }}
        />
      )}

      {/* Add Slot modal */}
      {showAddSlot && (
        <AddSlotModal
          levelId={activeLevel ?? ''}
          onClose={() => setShowAddSlot(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['parking-levels'] })
            qc.invalidateQueries({ queryKey: ['parking-slots'] })
            setShowAddSlot(false)
          }}
        />
      )}
    </div>
  )
}

// ── Assign Slot Modal (POST /parking/slots/{id}/assign) ───────────────────────
function AssignSlotModal({
  slot, onClose, onAssigned,
}: { slot: ParkingSlot; onClose: () => void; onAssigned: () => void }) {
  const [flatId,        setFlatId]        = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post(`/parking/slots/${slot.id}/assign`, {
      flatId,
      vehicleNumber: vehicleNumber.trim() || undefined,
    }),
    onSuccess: () => { toast.success(`Slot ${slot.slotNumber} assigned`); onAssigned() },
    onError:   (e: Error) => toast.error(e.message),
  })

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
        <h2 className="font-semibold text-lg">Assign Slot {slot.slotNumber}</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Flat ID <span className="text-red-500">*</span></label>
          <input value={flatId} onChange={e => setFlatId(e.target.value)}
            placeholder="flat-a101" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Vehicle Number <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
          <input value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)}
            placeholder="MH12AB1234" className={inputClass} />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !flatId.trim()}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60"
          >
            {mutation.isPending ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Visitor Pass Modal (POST /parking/slots/{id}/visitor-pass) ────────────────
function VisitorPassModal({
  slot, onClose, onCreated,
}: { slot: ParkingSlot; onClose: () => void; onCreated: () => void }) {
  const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 16)
  const [visitorName,   setVisitorName]   = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [expiresAt,     setExpiresAt]     = useState(tomorrow)

  const mutation = useMutation({
    mutationFn: () => api.post(`/parking/slots/${slot.id}/visitor-pass`, {
      visitorName:   visitorName.trim(),
      vehicleNumber: vehicleNumber.trim() || undefined,
      expiresAt:     new Date(expiresAt).toISOString(),
    }),
    onSuccess: () => { toast.success(`Visitor pass created for slot ${slot.slotNumber}`); onCreated() },
    onError:   (e: Error) => toast.error(e.message),
  })

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
        <h2 className="font-semibold text-lg">Visitor Pass — Slot {slot.slotNumber}</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Visitor Name <span className="text-red-500">*</span></label>
          <input value={visitorName} onChange={e => setVisitorName(e.target.value)}
            placeholder="Amit Kumar" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Vehicle Number <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
          <input value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)}
            placeholder="MH12XY9999" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Valid Until</label>
          <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className={inputClass} />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !visitorName.trim()}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60"
          >
            {mutation.isPending ? 'Creating…' : 'Create Pass'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Slot Modal (POST /parking/slots) ──────────────────────────────────────
function AddSlotModal({
  levelId, onClose, onCreated,
}: { levelId: string; onClose: () => void; onCreated: () => void }) {
  const [slotNumber, setSlotNumber] = useState('')
  const [type,       setType]       = useState<'car' | 'bike' | 'ev'>('car')

  const mutation = useMutation({
    mutationFn: () => api.post('/parking/slots', { levelId, number: slotNumber.trim(), type }),
    onSuccess:  () => { toast.success('Slot added'); onCreated() },
    onError:    (e: Error) => toast.error(e.message),
  })

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
        <h2 className="font-semibold text-lg">Add Parking Slot</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Slot Number <span className="text-red-500">*</span></label>
          <input value={slotNumber} onChange={e => setSlotNumber(e.target.value)}
            placeholder="B1-17" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select value={type} onChange={e => setType(e.target.value as 'car' | 'bike' | 'ev')} className={inputClass}>
            <option value="car">Car</option>
            <option value="bike">Bike / Two-wheeler</option>
            <option value="ev">EV (with charger)</option>
          </select>
        </div>
        <p className="text-xs text-gray-400">Slot will be added to the currently selected level.</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !slotNumber.trim()}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60"
          >
            {mutation.isPending ? 'Adding…' : 'Add Slot'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Demo data — shape matches API ParkingLevelDto ─────────────────────────────
const DEMO_LEVELS: ParkingLevel[] = [
  { id: 'L1', name: 'B1 — Basement', totalSlots: 16, occupiedSlots: 12, availableSlots: 4 },
  { id: 'L2', name: 'B2 — Basement', totalSlots: 12, occupiedSlots: 6,  availableSlots: 6 },
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
