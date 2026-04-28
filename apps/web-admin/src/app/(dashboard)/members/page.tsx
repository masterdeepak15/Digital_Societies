'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { initialsOf, formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Table, Thead, Tbody, Th, Td, Tr } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Member {
  id:          string
  name:        string
  phone:       string
  email?:      string
  flatDisplay: string
  role:        string
  memberType:  string
  joinedAt:    string
  isActive:    boolean
  avatarUrl?:  string
}

type RoleFilter = 'all' | 'admin' | 'resident' | 'guard' | 'accountant'

export default function MembersPage() {
  const [search, setSearch] = useState('')
  const [role,   setRole]   = useState<RoleFilter>('all')

  const { data: members = DEMO_MEMBERS } = useQuery<Member[]>({
    queryKey: ['members', role, search],
    queryFn:  () => api.get(`/members?role=${role}&search=${encodeURIComponent(search)}`),
  })

  const filtered = members.filter(m =>
    (role === 'all' || m.role === role) &&
    (search === '' || m.name.toLowerCase().includes(search.toLowerCase()) ||
     m.phone.includes(search) || m.flatDisplay.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Members"
        description="Residents, staff, and all society members"
        action={
          <button className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
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
                <Tr key={m.id}>
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
                  <Td>{m.flatDisplay || '—'}</Td>
                  <Td><Badge label={m.role} /></Td>
                  <Td className="capitalize text-gray-500 text-sm">{m.memberType}</Td>
                  <Td>{formatDate(m.joinedAt)}</Td>
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

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_MEMBERS: Member[] = [
  { id: '1', name: 'Rajesh Sharma',   phone: '+919999999999', email: 'rajesh@example.com', flatDisplay: 'A-101', role: 'admin',     memberType: 'owner',   joinedAt: '2024-01-15', isActive: true  },
  { id: '2', name: 'Priya Mehta',     phone: '+919999999998', flatDisplay: 'A-102', role: 'resident',  memberType: 'owner',   joinedAt: '2024-02-10', isActive: true  },
  { id: '3', name: 'Suresh Iyer',     phone: '+919999999997', flatDisplay: 'A-103', role: 'resident',  memberType: 'tenant',  joinedAt: '2024-03-01', isActive: true  },
  { id: '4', name: 'Anita Desai',     phone: '+919888888881', flatDisplay: 'A-104', role: 'resident',  memberType: 'owner',   joinedAt: '2024-01-20', isActive: true  },
  { id: '5', name: 'Vikram Nair',     phone: '+919888888882', flatDisplay: 'A-105', role: 'resident',  memberType: 'owner',   joinedAt: '2024-01-25', isActive: true  },
  { id: '6', name: 'Sanjay Gupta',    phone: '+919777777771', flatDisplay: '',      role: 'guard',     memberType: 'staff',   joinedAt: '2024-01-05', isActive: true  },
  { id: '7', name: 'Pooja Verma',     phone: '+919777777772', flatDisplay: '',      role: 'accountant', memberType: 'staff',  joinedAt: '2024-01-10', isActive: true  },
  { id: '8', name: 'Meena Patel',     phone: '+919666666661', flatDisplay: 'B-101', role: 'resident',  memberType: 'owner',   joinedAt: '2024-04-01', isActive: true  },
  { id: '9', name: 'Arvind Joshi',    phone: '+919666666662', flatDisplay: 'B-102', role: 'resident',  memberType: 'tenant',  joinedAt: '2024-05-01', isActive: false },
  { id:'10', name: 'Kavitha Rao',     phone: '+919666666663', flatDisplay: 'B-103', role: 'resident',  memberType: 'owner',   joinedAt: '2024-04-15', isActive: true  },
]
