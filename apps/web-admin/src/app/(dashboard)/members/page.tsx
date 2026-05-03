'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { initialsOf, formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Table, Thead, Tbody, Th, Td, Tr } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'

// ── Types — aligned with API MemberDto ────────────────────────────────────────
// API GET /members → { items: MemberDto[], total, page, pageSize }
// MemberDto: { userId, name, phone, role, flatId, flatNumber, wing }
interface Member {
  userId:       string
  name:         string
  phone:        string
  role:         string
  flatId?:      string
  flatNumber?:  string
  wing?:        string
  // UI-only optional fields kept for future joins (not returned by API today).
  email?:       string
  memberType?:  string
  joinedAt?:    string
  isActive?:    boolean
  avatarUrl?:   string
}

interface MembersPage { items: Member[]; total: number; page: number; pageSize: number }

/** Compute a human-readable flat label from the API fields. */
function flatLabel(m: Member): string {
  if (!m.flatNumber) return '—'
  return m.wing ? `${m.wing}-${m.flatNumber}` : m.flatNumber
}

type RoleFilter = 'all' | 'admin' | 'resident' | 'guard' | 'accountant'

export default function MembersPage() {
  const qc = useQueryClient()
  const [search,    setSearch]    = useState('')
  const [role,      setRole]      = useState<RoleFilter>('all')
  const [showAdd,   setShowAdd]   = useState(false)

  // API: GET /members?role=&wing=&page=&pageSize= — `search` is NOT a server filter.
  const { data } = useQuery<MembersPage>({
    queryKey: ['members', role],
    queryFn:  () => api.get(role === 'all' ? '/members' : `/members?role=${role}`),
  })
  const members: Member[] = data?.items ?? DEMO_MEMBERS

  const filtered = members.filter(m =>
    (role === 'all' || m.role === role) &&
    (search === '' || m.name.toLowerCase().includes(search.toLowerCase()) ||
     m.phone.includes(search) || (m.flatNumber ?? '').toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Members"
        description="Residents, staff, and all society members"
        action={
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add Member
          </button>
        }
      />

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, phone, flat…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['all', 'resident', 'admin', 'guard', 'accountant'] as RoleFilter[]).map(r => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium capitalize transition',
                role === r ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Add Member modal */}
      {showAdd && (
        <AddMemberModal
          onClose={() => setShowAdd(false)}
          onCreated={() => { qc.invalidateQueries({ queryKey: ['members'] }); setShowAdd(false) }}
        />
      )}

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={Users} title="No members found" description="Try adjusting your search or filter." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Member</Th>
                <Th>Phone</Th>
                <Th>Flat</Th>
                <Th>Role</Th>
                <Th>Type</Th>
                <Th>Joined</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map(m => (
                <Tr key={m.userId}>
                  <Td>
                    <div className="flex items-center gap-3">
                      {m.avatarUrl ? (
                        <img src={m.avatarUrl} alt={m.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">
                          {initialsOf(m.name)}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{m.name}</p>
                        {m.email && <p className="text-xs text-gray-400">{m.email}</p>}
                      </div>
                    </div>
                  </Td>
                  <Td>{m.phone}</Td>
                  <Td>{flatLabel(m)}</Td>
                  <Td><Badge label={m.role} /></Td>
                  <Td className="capitalize text-gray-500 text-sm">{m.memberType}</Td>
                  <Td>{formatDate(m.joinedAt ?? '')}</Td>
                  <Td>
                    <span className={cn(
                      'inline-flex items-center gap-1 text-xs font-medium',
                      m.isActive ? 'text-green-600' : 'text-gray-400'
                    )}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', m.isActive ? 'bg-green-500' : 'bg-gray-300')} />
                      {m.isActive ? 'Active' : 'Inactive'}
                    </span>
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

// ── Add Member Modal ──────────────────────────────────────────────────────────
// API: POST /members/family — { flatId, name, phone, relationship }
// relationship: 'Owner' | 'Tenant' | 'Family'
interface AddMemberForm {
  name:         string
  phone:        string
  flatId:       string
  relationship: 'Owner' | 'Tenant' | 'Family'
}

function AddMemberModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<AddMemberForm>({
    name: '', phone: '', flatId: '', relationship: 'Owner',
  })
  const set = <K extends keyof AddMemberForm>(k: K, v: AddMemberForm[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const mutation = useMutation({
    mutationFn: () => api.post('/members/family', form),
    onSuccess:  () => { toast.success('Member added successfully'); onCreated() },
    onError:    (e: Error) => toast.error(e.message),
  })

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
  const isValid = form.name.trim().length >= 2 && form.phone.trim().length >= 10 && form.flatId.trim().length > 0

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="font-semibold text-lg">Add Member</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="Rajesh Sharma" className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input value={form.phone} onChange={e => set('phone', e.target.value)}
            placeholder="+919876543210" type="tel" className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Flat ID</label>
          <input value={form.flatId} onChange={e => set('flatId', e.target.value)}
            placeholder="flat-a101" className={inputClass} />
          <p className="text-xs text-gray-400 mt-0.5">Enter the flat's internal ID (e.g. flat-a101)</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Relationship</label>
          <select value={form.relationship} onChange={e => set('relationship', e.target.value as AddMemberForm['relationship'])}
            className={inputClass}>
            <option value="Owner">Owner</option>
            <option value="Tenant">Tenant</option>
            <option value="Family">Family member</option>
          </select>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 border border-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !isValid}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60"
          >
            {mutation.isPending ? 'Adding…' : 'Add Member'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Demo data — shape matches API MemberDto ───────────────────────────────────
// Optional UI fields (email, memberType, joinedAt, isActive) are shown when present.
const DEMO_MEMBERS: Member[] = [
  { userId: 'u1',  name: 'Rajesh Sharma',  phone: '+919999999999', email: 'rajesh@example.com', wing: 'A', flatNumber: '101', role: 'admin',      memberType: 'owner',  joinedAt: '2024-01-15', isActive: true  },
  { userId: 'u2',  name: 'Priya Mehta',    phone: '+919999999998', wing: 'A', flatNumber: '102', role: 'resident', memberType: 'owner',  joinedAt: '2024-02-10', isActive: true  },
  { userId: 'u3',  name: 'Suresh Iyer',    phone: '+919999999997', wing: 'A', flatNumber: '103', role: 'resident', memberType: 'tenant', joinedAt: '2024-03-01', isActive: true  },
  { userId: 'u4',  name: 'Anita Desai',    phone: '+919888888881', wing: 'A', flatNumber: '104', role: 'resident', memberType: 'owner',  joinedAt: '2024-01-20', isActive: true  },
  { userId: 'u5',  name: 'Vikram Nair',    phone: '+919888888882', wing: 'A', flatNumber: '105', role: 'resident', memberType: 'owner',  joinedAt: '2024-01-25', isActive: true  },
  { userId: 'u6',  name: 'Sanjay Gupta',   phone: '+919777777771', role: 'guard',      memberType: 'staff',  joinedAt: '2024-01-05', isActive: true  },
  { userId: 'u7',  name: 'Pooja Verma',    phone: '+919777777772', role: 'accountant', memberType: 'staff',  joinedAt: '2024-01-10', isActive: true  },
  { userId: 'u8',  name: 'Meena Patel',    phone: '+919666666661', wing: 'B', flatNumber: '101', role: 'resident', memberType: 'owner',  joinedAt: '2024-04-01', isActive: true  },
  { userId: 'u9',  name: 'Arvind Joshi',   phone: '+919666666662', wing: 'B', flatNumber: '102', role: 'resident', memberType: 'tenant', joinedAt: '2024-05-01', isActive: false },
  { userId: 'u10', name: 'Kavitha Rao',    phone: '+919666666663', wing: 'B', flatNumber: '103', role: 'resident', memberType: 'owner',  joinedAt: '2024-04-15', isActive: true  },
]
