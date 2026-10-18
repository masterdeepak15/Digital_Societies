'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field, Modal } from '@/components/ui/Modal'
import {
  EMPTY_LAYOUT_FORM, groupFlats, layoutError, layoutPreview, parseWings,
  type FlatRow, type LayoutFormValues,
} from '@/lib/flatLayout'

interface LayoutResult { created: number; kept: number; removed: number; outsideLayoutStillInUse: number; total: number }

export default function FlatsPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState<LayoutFormValues>(EMPTY_LAYOUT_FORM)
  const [removeOthers, setRemoveOthers] = useState(false)
  const [showError, setShowError] = useState(false)
  const [editing, setEditing] = useState<FlatRow | null>(null)

  const { data: flats = [], isLoading } = useQuery<FlatRow[]>({
    queryKey: ['flats'],
    queryFn:  () => api.get('/flats'),
  })

  const error   = layoutError(form)
  const preview = layoutPreview(form)
  const set = (k: keyof LayoutFormValues) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['flats'] }); qc.invalidateQueries({ queryKey: ['flat-labels'] }) }

  const apply = useMutation({
    mutationFn: () => api.post<LayoutResult>('/flats/layout', {
      wings: parseWings(form.wings),
      floors: Number(form.floors),
      flatsPerFloor: Number(form.flatsPerFloor),
      removeUnusedOthers: removeOthers,
    }),
    onSuccess: r => {
      toast.success(`${r.created} flats added, ${r.kept} already there${r.removed ? `, ${r.removed} unused removed` : ''}. ${r.total} flats in total.`)
      if (r.outsideLayoutStillInUse) toast.message(`${r.outsideLayoutStillInUse} flats outside this layout were kept because people live there.`)
      refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const groups = groupFlats(flats)

  return (
    <div className="space-y-5">
      <PageHeader title="Flats" description="Describe your buildings once. Residents are then placed in these flats." />

      <form
        className="space-y-4 rounded-xl border border-line bg-surface p-5"
        onSubmit={e => { e.preventDefault(); if (error) setShowError(true); else apply.mutate() }}
      >
        <h2 className="text-[15px] font-bold text-ink">Building layout</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Wings or buildings" hint="Names separated by commas, for example A, B">
            <Input value={form.wings} onChange={set('wings')} placeholder="A" />
          </Field>
          <Field label="Floors in each"><Input inputMode="numeric" value={form.floors} onChange={set('floors')} /></Field>
          <Field label="Flats on each floor"><Input inputMode="numeric" value={form.flatsPerFloor} onChange={set('flatsPerFloor')} /></Field>
        </div>
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" checked={removeOthers} onChange={e => setRemoveOthers(e.target.checked)} className="mt-0.5" />
          <span>Remove empty flats that are not in this layout<span className="block text-xs text-mute">Flats with residents are always kept.</span></span>
        </label>
        {preview && <p className="text-sm text-mute">This will make <span className="font-semibold text-ink">{preview}</span>. Flats you already have are left as they are.</p>}
        {showError && error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <Button type="submit" loading={apply.isPending}>Apply layout</Button>
      </form>

      {editing && <FlatModal flat={editing} onClose={() => setEditing(null)} onChanged={() => { setEditing(null); refresh() }} />}

      {groups.length === 0 && !isLoading
        ? <div className="rounded-xl border border-line bg-surface">
            <EmptyState icon={Building} title="No flats yet" description="Fill in the layout above and press Apply layout." />
          </div>
        : groups.map(g => (
            <section key={g.wing} className="space-y-3 rounded-xl border border-line bg-surface p-5">
              <h2 className="text-[15px] font-bold text-ink">
                Wing {g.wing} <span className="font-normal text-mute">· {g.floors.reduce((n, f) => n + f.flats.length, 0)} flats</span>
              </h2>
              {g.floors.map(f => (
                <div key={f.floor} className="flex flex-wrap items-center gap-2">
                  <span className="w-16 shrink-0 text-xs text-mute">Floor {f.floor}</span>
                  {f.flats.map(fl => (
                    <button key={fl.id} type="button" onClick={() => setEditing(fl)} title="Edit or remove this flat"
                      className={cn('inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-sm hover:border-brand-600',
                        fl.residents > 0 ? 'border-brand-600/40 bg-brand-600/10 text-ink' : 'border-line text-mute')}>
                      {fl.label}
                      {fl.residents > 0 && <span className="text-xs text-mute">· {fl.residents}</span>}
                    </button>
                  ))}
                </div>
              ))}
            </section>
          ))}
    </div>
  )
}

function FlatModal({ flat, onClose, onChanged }: { flat: FlatRow; onClose: () => void; onChanged: () => void }) {
  const [wing, setWing]     = useState(flat.wing)
  const [number, setNumber] = useState(flat.number)
  const [floor, setFloor]   = useState(String(flat.floor))
  const bad = !wing.trim() ? 'Enter the wing.' : !number.trim() ? 'Enter the flat number.' : !/^\d+$/.test(floor.trim()) ? 'Floor must be a number.' : null

  const save = useMutation({
    mutationFn: () => api.put(`/flats/${flat.id}`, { wing: wing.trim(), number: number.trim(), floor: Number(floor) }),
    onSuccess: () => { toast.success('Flat updated'); onChanged() },
    onError:   (e: Error) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: () => api.delete(`/flats/${flat.id}`),
    onSuccess: () => { toast.success('Flat removed'); onChanged() },
    onError:   (e: Error) => toast.error(e.message),
  })

  return (
    <Modal title={`Flat ${flat.label}`} onClose={onClose}>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (!bad) save.mutate() }}>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Wing"><Input value={wing} onChange={e => setWing(e.target.value)} maxLength={10} /></Field>
          <Field label="Number" hint="For example 807"><Input value={number} onChange={e => setNumber(e.target.value)} maxLength={10} /></Field>
          <Field label="Floor"><Input inputMode="numeric" value={floor} onChange={e => setFloor(e.target.value)} /></Field>
        </div>
        {bad && <p role="alert" className="text-sm text-bad">{bad}</p>}
        {flat.residents > 0 && <p className="text-xs text-mute">{flat.residents} {flat.residents === 1 ? 'person lives' : 'people live'} here, so it cannot be removed.</p>}
        <div className="flex justify-between gap-2 pt-2">
          <Button variant="danger" disabled={flat.residents > 0} loading={remove.isPending}
            onClick={() => { if (confirm(`Remove flat ${flat.label}?`)) remove.mutate() }}>Remove flat</Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={save.isPending} disabled={!!bad}>Save</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

