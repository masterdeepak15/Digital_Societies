'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Users, Pencil, UserPlus, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { initialsOf, formatDate, cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal, Field } from '@/components/ui/Modal'
import { Table, Thead, Tbody, Th, Td, Tr } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  EMPTY_MEMBER_FORM, MEMBER_ROLES, RELATIONSHIPS, groupMembers, memberFormError, nothingToSave, roleLabel, roleSummary,
  sortedFlats, toMemberPayload, type MemberFormValues, type MemberRow, type Person, type PersonRole,
} from '@/lib/memberForm'

interface MembersPage { items: MemberRow[] }

type RoleFilter = 'all' | (typeof MEMBER_ROLES)[number]['value']

const selectClass =
  'min-h-[40px] w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-saffron'

function useFlats() {
  const { data } = useQuery<Record<string, string>>({ queryKey: ['flat-labels'], queryFn: () => api.get('/billing/flat-labels') })
  return sortedFlats(data ?? {})
}

export default function MembersPage() {
  const qc = useQueryClient()
  const [search,  setSearch]  = useState('')
  const [role,    setRole]    = useState<RoleFilter>('all')
  const [adding,  setAdding]  = useState<Partial<MemberFormValues> | 'new' | null>(null)
  const [editing, setEditing] = useState<string | null>(null)   // userId being managed

  // Everyone is fetched in one go: a person's roles are shown together, so they cannot be split across filtered pages.
  const { data, isLoading } = useQuery<MembersPage>({
    queryKey: ['members'],
    queryFn:  () => api.get('/members?pageSize=500'),
  })
  const people = groupMembers(data?.items ?? [])

  const q = search.toLowerCase()
  const filtered = people.filter(p =>
    (role === 'all' || p.roles.some(r => r.role === role)) &&
    (search === '' ||
      p.name.toLowerCase().includes(q) ||
      (p.email ?? '').toLowerCase().includes(q) ||
      (p.phone ?? '').includes(search) ||
      p.roles.some(r => r.flatText.toLowerCase().includes(q))))

  const refresh = () => qc.invalidateQueries({ queryKey: ['members'] })
  const managed = people.find(p => p.userId === editing) ?? null

  return (
    <div className="space-y-5">
      <PageHeader
        title="Members"
        description="Residents, guards, staff and the management"
        action={<Button onClick={() => setAdding('new')}><Plus className="h-4 w-4" /> Add person</Button>}
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

      {adding && (
        <AddPersonModal
          initial={adding === 'new' ? null : adding}
          onClose={() => setAdding(null)}
          onCreated={() => { refresh(); setAdding(null) }}
        />
      )}
      {managed && <ManagePersonModal person={managed} onClose={() => setEditing(null)} onChanged={refresh} />}

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {filtered.length === 0 && !isLoading ? (
          <EmptyState icon={Users} title="No one here yet" description="Add residents, guards and staff with the Add person button." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Person</Th>
                <Th>Phone</Th>
                <Th>Roles</Th>
                <Th>Joined</Th>
                <Th><span className="sr-only">Actions</span></Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map(p => (
                <Tr key={p.userId}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                        {initialsOf(p.name)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink">{p.name}</p>
                        {p.email && <p className="text-xs text-mute">{p.email}</p>}
                      </div>
                    </div>
                  </Td>
                  <Td>{p.phone ?? '—'}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      {p.roles.map(r => <Badge key={r.membershipId} label={roleSummary(r)} />)}
                    </div>
                  </Td>
                  <Td>{formatDate(p.joinedAt ?? '')}</Td>
                  <Td>
                    <div className="flex gap-1">
                      <Button variant="ghost" className="min-h-[32px] px-2 text-xs" aria-label={`Edit ${p.name}`} title="Edit or remove"
                        onClick={() => setEditing(p.userId)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" className="min-h-[32px] px-2 text-xs" aria-label={`Give ${p.name} another role`} title="Give another role"
                        onClick={() => setAdding({ name: p.name, email: p.email ?? '', phone: p.phone ?? '', role: 'guard' })}>
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </div>
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

// ── Edit a person and each of their roles ────────────────────────────────────
function ManagePersonModal({ person, onClose, onChanged }: { person: Person; onClose: () => void; onChanged: () => void }) {
  const [name, setName]   = useState(person.name)
  const [phone, setPhone] = useState((person.phone ?? '').replace(/^\+91/, ''))
  const [changing, setChanging] = useState<string | null>(null)   // membershipId being edited
  const first = person.roles[0]

  const saveDetails = useMutation({
    mutationFn: () => api.put(`/members/${first.membershipId}`, { name: name.trim(), phone: phone.replace(/[\s-]/g, '') || null }),
    onSuccess: () => { toast.success('Details saved'); onChanged() },
    onError:   (e: Error) => toast.error(e.message),
  })
  const detailsError = name.trim().length < 2 ? 'Enter the person’s full name.'
    : phone.trim() && !/^\+?[0-9]{10,13}$/.test(phone.replace(/[\s-]/g, '')) ? 'Enter a valid phone number, or leave it empty.' : null

  const remove = useMutation({
    mutationFn: (membershipId: string) => api.delete(`/members/${membershipId}`),
    onSuccess: () => { toast.success('Role removed'); onChanged() },
    onError:   (e: Error) => toast.error(e.message),
  })

  return (
    <Modal title={`Edit ${person.name}`} onClose={onClose}>
      <div className="space-y-4">
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (!detailsError) saveDetails.mutate() }}>
          <Field label="Full name"><Input value={name} onChange={e => setName(e.target.value)} maxLength={200} /></Field>
          <Field label="Phone (optional)" hint={person.email ? `Signs in with ${person.email}` : undefined}>
            <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
          </Field>
          {detailsError && <p role="alert" className="text-sm text-bad">{detailsError}</p>}
          <Button type="submit" loading={saveDetails.isPending} disabled={!!detailsError || nothingToSave({ name, phone }, person)}>Save details</Button>
        </form>

        <div className="space-y-2 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">Roles</h3>
          {person.roles.map(r => (
            <div key={r.membershipId} className="rounded-lg border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-ink">{roleSummary(r)}</span>
                {r.isProtected ? (
                  <span className="flex items-center gap-1 text-xs text-mute"><Lock className="h-3.5 w-3.5" /> Cannot be removed</span>
                ) : (
                  <div className="flex gap-1">
                    <Button variant="secondary" className="min-h-[32px] px-3 text-xs" onClick={() => setChanging(changing === r.membershipId ? null : r.membershipId)}>Change</Button>
                    <Button variant="danger" className="min-h-[32px] px-3 text-xs" loading={remove.isPending && remove.variables === r.membershipId}
                      onClick={() => { if (confirm(`Remove the ${roleLabel(r.role).toLowerCase()} role from ${person.name}?`)) remove.mutate(r.membershipId) }}>
                      Remove
                    </Button>
                  </div>
                )}
              </div>
              {changing === r.membershipId && (
                <ChangeRole person={person} name={name} phone={phone} role={r}
                  onDone={() => { setChanging(null); onChanged() }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function ChangeRole({ person, name, phone, role, onDone }: { person: Person; name: string; phone: string; role: PersonRole; onDone: () => void }) {
  const flats = useFlats()
  const [newRole, setNewRole] = useState(role.role)
  const [flatId, setFlatId]   = useState(role.flatId ?? '')
  const [rel, setRel]         = useState(role.memberType && role.memberType !== 'staff' ? role.memberType : 'owner')
  const needsFlat = MEMBER_ROLES.find(r => r.value === newRole)?.needsFlat ?? false
  const error = needsFlat && !flatId ? 'Choose the flat this resident lives in.' : null

  const save = useMutation({
    mutationFn: () => api.put(`/members/${role.membershipId}`, {
      name: name.trim() || person.name, phone: phone.replace(/[\s-]/g, '') || null,
      role: newRole, memberType: needsFlat ? rel : null, flatId: needsFlat ? flatId : null,
    }),
    onSuccess: () => { toast.success('Role updated'); onDone() },
    onError:   (e: Error) => toast.error(e.message),
  })

  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      <Field label="Role">
        <select className={selectClass} value={newRole} onChange={e => setNewRole(e.target.value)}>
          {MEMBER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </Field>
      {needsFlat && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Flat">
            <select className={selectClass} value={flatId} onChange={e => setFlatId(e.target.value)}>
              <option value="">Choose a flat</option>
              {flats.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </Field>
          <Field label="Relationship">
            <select className={selectClass} value={rel} onChange={e => setRel(e.target.value)}>
              {RELATIONSHIPS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <Button loading={save.isPending} disabled={!!error} onClick={() => save.mutate()}>Save role</Button>
    </div>
  )
}

// ── Add a person (or give an existing one another role) ──────────────────────
function AddPersonModal({ initial, onClose, onCreated }: { initial: Partial<MemberFormValues> | null; onClose: () => void; onCreated: () => void }) {
  const [v, setV] = useState<MemberFormValues>({ ...EMPTY_MEMBER_FORM, ...initial })
  const [showError, setShowError] = useState(false)
  const error = memberFormError(v)
  const set = (k: keyof MemberFormValues) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value })
  const needsFlat = MEMBER_ROLES.find(r => r.value === v.role)?.needsFlat ?? false
  const flats = useFlats()

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
