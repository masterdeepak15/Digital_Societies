'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Users, UserMinus, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { initialsOf, formatDate, cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal, Field } from '@/components/ui/Modal'
import { Table, Thead, Tbody, Th, Td, Tr } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  EMPTY_MEMBER_FORM, MEMBER_ROLES, RELATIONSHIPS, flatText, memberFormError, roleLabel, sortedFlats, toMemberPayload,
  type MemberFormValues,
} from '@/lib/memberForm'

// GET /members → [{ userId, name, email, phone?, role, memberType, flatNumber, wing, joinedAt }]
interface Member {
  userId:      string
  name:        string
  email?:      string
  phone?:      string | null
  role:        string
  flatNumber?: string
  wing?:       string
  memberType?: string
  joinedAt?:   string
  avatarUrl?:  string
}

interface MembersPage { items: Member[] }

type RoleFilter = 'all' | (typeof MEMBER_ROLES)[number]['value']

const selectClass =
  'min-h-[40px] w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-saffron'

export default function MembersPage() {
  const qc = useQueryClient()
  const me = getUser()
  const [search,  setSearch]  = useState('')
  const [role,    setRole]    = useState<RoleFilter>('all')
  const [showAdd, setShowAdd] = useState(false)
  // Set when the admin gives an existing person another role: their details are filled in already.
  const [prefill, setPrefill] = useState<Partial<MemberFormValues> | null>(null)

  const { data, isLoading } = useQuery<MembersPage>({
    queryKey: ['members', role],
    queryFn:  () => api.get(role === 'all' ? '/members?pageSize=200' : `/members?role=${role}&pageSize=200`),
  })
  const members: Member[] = data?.items ?? []

  const remove = useMutation({
    mutationFn: (userId: string) => api.delete(`/members/${userId}`),
    onSuccess: () => { toast.success('Removed from the society'); qc.invalidateQueries({ queryKey: ['members'] }) },
    onError:   (e: Error) => toast.error(e.message),
  })

  const q = search.toLowerCase()
  const filtered = members.filter(m =>
    search === '' ||
    m.name.toLowerCase().includes(q) ||
    (m.email ?? '').toLowerCase().includes(q) ||
    (m.phone ?? '').includes(search) ||
    flatText(m.wing, m.flatNumber).toLowerCase().includes(q))

  return (
    <div className="space-y-5">
      <PageHeader
        title="Members"
        description="Residents, guards, staff and the management"
        action={<Button onClick={() => { setPrefill(null); setShowAdd(true) }}><Plus className="h-4 w-4" /> Add person</Button>}
      />

      <div className="flex flex-wrap gap-3 rounded-xl border border-line bg-surface p-4">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-mute" aria-hidden="true" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, phone, flat" className="pl-9" aria-label="Search members" />
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg bg-surface-alt p-1">
          {[{ value: 'all', label: 'All' }, ...MEMBER_ROLES].map(r => (
            <button key={r.value} onClick={() => setRole(r.value as RoleFilter)}
              className={cn('rounded-md px-3 py-1.5 text-sm font-medium transition',
                role === r.value ? 'bg-surface text-ink shadow-sm' : 'text-mute hover:text-ink')}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {showAdd && (
        <AddPersonModal
          initial={prefill}
          onClose={() => setShowAdd(false)}
          onCreated={() => { qc.invalidateQueries({ queryKey: ['members'] }); setShowAdd(false) }}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {filtered.length === 0 && !isLoading ? (
          <EmptyState icon={Users} title="No one here yet" description="Add residents, guards and staff with the Add person button." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Person</Th>
                <Th>Phone</Th>
                <Th>Flat</Th>
                <Th>Role</Th>
                <Th>Type</Th>
                <Th>Joined</Th>
                <Th><span className="sr-only">Actions</span></Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map(m => (
                <Tr key={`${m.userId}-${m.role}-${m.flatNumber ?? ''}`}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                        {initialsOf(m.name)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink">{m.name}</p>
                        {m.email && <p className="text-xs text-mute">{m.email}</p>}
                      </div>
                    </div>
                  </Td>
                  <Td>{m.phone ?? '—'}</Td>
                  <Td>{flatText(m.wing, m.flatNumber)}</Td>
                  <Td><Badge label={roleLabel(m.role)} /></Td>
                  <Td className="text-sm capitalize text-mute">{m.memberType ?? '—'}</Td>
                  <Td>{formatDate(m.joinedAt ?? '')}</Td>
                  <Td>
                    <Button variant="ghost" className="min-h-[32px] px-2 text-xs"
                      aria-label={`Give ${m.name} another role`} title="Give another role"
                      onClick={() => { setPrefill({ name: m.name, email: m.email ?? '', phone: m.phone ?? '', role: 'guard' }); setShowAdd(true) }}>
                      <UserPlus className="h-4 w-4" />
                    </Button>
                    {m.userId !== me?.userId && (
                      <Button variant="ghost" className="min-h-[32px] px-2 text-xs text-bad"
                        aria-label={`Remove ${m.name}`}
                        onClick={() => { if (confirm(`Remove ${m.name} from the society? They lose access to the app.`)) remove.mutate(m.userId) }}>
                        <UserMinus className="h-4 w-4" />
                      </Button>
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

function AddPersonModal({ initial, onClose, onCreated }: { initial: Partial<MemberFormValues> | null; onClose: () => void; onCreated: () => void }) {
  const [v, setV] = useState<MemberFormValues>({ ...EMPTY_MEMBER_FORM, ...initial })
  const [showError, setShowError] = useState(false)
  const error = memberFormError(v)
  const set = (k: keyof MemberFormValues) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value })
  const needsFlat = MEMBER_ROLES.find(r => r.value === v.role)?.needsFlat ?? false

  const { data: labels } = useQuery<Record<string, string>>({
    queryKey: ['flat-labels'],
    queryFn:  () => api.get('/billing/flat-labels'),
  })
  const flats = sortedFlats(labels ?? {})

  const save = useMutation({
    mutationFn: () => api.post('/members', toMemberPayload(v)),
    onSuccess: () => { toast.success(`${roleLabel(v.role)} added. They can sign in with their email.`); onCreated() },
    onError:   (e: Error) => toast.error(e.message),
  })

  return (
    <Modal title={initial ? `Give ${initial.name} another role` : 'Add person'} onClose={onClose}>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (error) setShowError(true); else save.mutate() }}>
        <Field label="Role">
          <select className={selectClass} value={v.role} onChange={set('role')}>
            {MEMBER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </Field>
        <Field label="Full name"><Input value={v.name} onChange={set('name')} placeholder="Ramu Singh" maxLength={200} autoFocus /></Field>
        <Field label="Email" hint="They sign in with a code sent to this address.">
          <Input type="email" autoCapitalize="none" value={v.email} onChange={set('email')} placeholder="name@example.com" />
        </Field>
        <Field label="Phone (optional)"><Input type="tel" value={v.phone} onChange={set('phone')} placeholder="9975001173" /></Field>
        {needsFlat && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Flat">
              <select className={selectClass} value={v.flatId} onChange={set('flatId')}>
                <option value="">Choose a flat</option>
                {flats.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </Field>
            <Field label="Relationship">
              <select className={selectClass} value={v.relationship} onChange={set('relationship')}>
                {RELATIONSHIPS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
          </div>
        )}
        {showError && error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={save.isPending}>Add {roleLabel(v.role).toLowerCase()}</Button>
        </div>
      </form>
    </Modal>
  )
}
