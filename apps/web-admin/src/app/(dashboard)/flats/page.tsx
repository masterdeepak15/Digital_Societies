'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field } from '@/components/ui/Modal'
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

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/flats/${id}`),
    onSuccess: () => { toast.success('Flat removed'); refresh() },
    onError:   (e: Error) => toast.error(e.message),
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
                    <span key={fl.id} className={cn('group inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-sm',
                      fl.residents > 0 ? 'border-brand-600/40 bg-brand-600/10 text-ink' : 'border-line text-mute')}>
                      {fl.label}
                      {fl.residents > 0
                        ? <span className="text-xs text-mute">· {fl.residents}</span>
                        : (
                          <button type="button" aria-label={`Remove flat ${fl.label}`} className="hidden text-bad group-hover:inline"
                            onClick={() => { if (confirm(`Remove flat ${fl.label}?`)) remove.mutate(fl.id) }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                    </span>
                  ))}
                </div>
              ))}
            </section>
          ))}
    </div>
  )
}
