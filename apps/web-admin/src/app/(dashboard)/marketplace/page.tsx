'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShoppingBag, Search, Plus, Power, Phone, Pencil, Trash2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal, Field } from '@/components/ui/Modal'
import {
  EMPTY_LISTING_FORM, RATE_UNITS, SERVICE_CATEGORIES, categoryLabel, listingFormError, listingToForm, rateUnitLabel, toListingPayload,
  type ListingFormValues,
} from '@/lib/listingForm'

// GET /marketplace/listings?includeInactive=true → [{ id, providerName, phone, category, title, description,
//   baseRateRupees, rateUnit, commissionPct, averageRating, reviewCount, isActive }]   (adapted: price, rating)
interface Listing {
  id:            string
  providerName:  string
  phone?:        string
  category:      string
  title:         string
  description?:  string
  price:         number
  rateUnit?:     string
  commissionPct?: number
  rating?:       number
  reviewCount?:  number
  isActive:      boolean
  approval?:     'Pending' | 'Approved' | 'Rejected'   // a resident's registration waits here until approved
  rejectionReason?: string | null
}

interface ListingsPage { items: Listing[] }

const selectClass =
  'min-h-[40px] w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-saffron'

export default function MarketplacePage() {
  const qc = useQueryClient()
  const [category, setCategory] = useState('all')
  const [search,   setSearch]   = useState('')
  const [editing,  setEditing]  = useState<Listing | 'new' | null>(null)
  const [rejecting, setRejecting] = useState<Listing | null>(null)

  const { data, isLoading } = useQuery<ListingsPage>({
    queryKey: ['marketplace-listings'],
    queryFn:  () => api.get('/marketplace/listings?includeInactive=true&pageSize=100'),
  })
  const listings: Listing[] = data?.items ?? []

  const activeMutation = useMutation({
    mutationFn: (v: { id: string; isActive: boolean }) => api.put(`/marketplace/listings/${v.id}/active`, { isActive: v.isActive }),
    onSuccess: (_d, v) => { toast.success(v.isActive ? 'Service switched on' : 'Service switched off'); qc.invalidateQueries({ queryKey: ['marketplace-listings'] }) },
    onError:   (e: Error) => toast.error(e.message),
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/marketplace/listings/${id}/approve`, {}),
    onSuccess: () => { toast.success('Approved. Residents can see it now.'); qc.invalidateQueries({ queryKey: ['marketplace-listings'] }) },
    onError:   (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/marketplace/listings/${id}`),
    onSuccess: () => { toast.success('Service deleted'); qc.invalidateQueries({ queryKey: ['marketplace-listings'] }) },
    onError:   (e: Error) => toast.error(e.message),
  })

  const waiting  = listings.filter(l => l.approval === 'Pending')
  const approved = listings.filter(l => l.approval !== 'Pending')

  const displayed = approved.filter(l =>
    (category === 'all' || l.category === category) &&
    (search === '' ||
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.providerName.toLowerCase().includes(search.toLowerCase())))

  const usedCategories = SERVICE_CATEGORIES.filter(c => listings.some(l => l.category === c.value))

  return (
    <div className="space-y-5">
      <PageHeader
        title="Marketplace"
        description="Trusted service providers your residents can book"
        action={<Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add service</Button>}
      />

      <div className="grid grid-cols-2 gap-4">
        <Stat label="Active services" value={approved.filter(l => l.isActive && l.approval !== 'Rejected').length} />
        <Stat label="Waiting for approval" value={waiting.length} />
      </div>

      {waiting.length > 0 && (
        <section aria-label="Waiting for approval" className="space-y-3 rounded-xl border border-saffron/40 bg-surface p-4">
          <div>
            <h2 className="font-semibold text-ink">Waiting for your approval</h2>
            <p className="text-sm text-mute">Residents registered these. Residents only see a service after you approve it.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {waiting.map(l => (
              <div key={l.id} className="space-y-2 rounded-lg border border-line p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{l.title}</p>
                    <p className="text-sm text-mute">{l.providerName}{l.phone ? ` · ${l.phone}` : ''}</p>
                  </div>
                  <p className="font-bold text-ink">₹{l.price.toLocaleString('en-IN')} <span className="text-xs font-normal text-mute">{rateUnitLabel(l.rateUnit ?? '')}</span></p>
                </div>
                <p className="text-xs font-medium text-mute">{categoryLabel(l.category)}</p>
                {l.description && <p className="text-sm text-mute">{l.description}</p>}
                <div className="flex gap-2">
                  <Button className="min-h-[32px] px-3 text-xs" loading={approveMutation.isPending && approveMutation.variables === l.id}
                    onClick={() => approveMutation.mutate(l.id)}>
                    <Check className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button variant="danger" className="min-h-[32px] px-3 text-xs" onClick={() => setRejecting(l)}>
                    <X className="h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-3 rounded-xl border border-line bg-surface p-3">
        <div className="relative min-w-40 flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-mute" aria-hidden="true" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search service or provider" className="pl-9" aria-label="Search services" />
        </div>
        {usedCategories.length > 1 && (
          <div className="flex flex-wrap gap-1 rounded-lg bg-surface-alt p-1">
            {[{ value: 'all', label: 'All' }, ...usedCategories].map(c => (
              <button key={c.value} onClick={() => setCategory(c.value)}
                className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition',
                  category === c.value ? 'bg-surface text-ink shadow-sm' : 'text-mute hover:text-ink')}>
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {displayed.length === 0 && !isLoading
        ? <div className="rounded-xl border border-line bg-surface">
            <EmptyState
              icon={ShoppingBag}
              title={listings.length === 0 ? 'No services yet' : 'No services match this filter'}
              description={listings.length === 0 ? 'Add the plumbers, electricians and other helpers your society trusts.' : undefined}
            />
          </div>
        : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {displayed.map(l => (
              <div key={l.id} className={cn('space-y-3 rounded-xl border border-line bg-surface p-4', !l.isActive && 'opacity-70')}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold leading-tight text-ink">{l.title}</h3>
                    <p className="text-sm text-mute">{l.providerName}</p>
                  </div>
                  <Badge label={l.approval === 'Rejected' ? 'Rejected' : l.isActive ? 'Active' : 'Switched off'} />
                </div>
                <p className="text-xs font-medium text-mute">{categoryLabel(l.category)}</p>
                {l.description && <p className="line-clamp-2 text-sm text-mute">{l.description}</p>}
                {l.approval === 'Rejected' && l.rejectionReason && <p className="text-sm text-bad">Rejected: {l.rejectionReason}</p>}
                <p className="text-lg font-bold text-ink">
                  ₹{l.price.toLocaleString('en-IN')} <span className="text-sm font-normal text-mute">{rateUnitLabel(l.rateUnit ?? '')}</span>
                </p>
                <div className="flex items-center justify-between text-xs text-mute">
                  {l.phone ? <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{l.phone}</span> : <span />}
                  {l.reviewCount ? <span>★ {(l.rating ?? 0).toFixed(1)} ({l.reviewCount})</span> : <span>No reviews yet</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {l.approval === 'Rejected' && (
                    <Button className="min-h-[32px] px-3 text-xs" loading={approveMutation.isPending && approveMutation.variables === l.id}
                      onClick={() => approveMutation.mutate(l.id)}>
                      <Check className="h-3.5 w-3.5" /> Approve
                    </Button>
                  )}
                  <Button variant="secondary" className="min-h-[32px] px-3 text-xs" onClick={() => setEditing(l)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant={l.isActive ? 'danger' : 'secondary'} className="min-h-[32px] px-3 text-xs"
                    loading={activeMutation.isPending && activeMutation.variables?.id === l.id}
                    onClick={() => activeMutation.mutate({ id: l.id, isActive: !l.isActive })}>
                    <Power className="h-3.5 w-3.5" /> {l.isActive ? 'Switch off' : 'Switch on'}
                  </Button>
                  <Button variant="ghost" className="min-h-[32px] px-3 text-xs text-bad" aria-label={`Delete ${l.title}`}
                    loading={deleteMutation.isPending && deleteMutation.variables === l.id}
                    onClick={() => { if (confirm(`Delete ${l.title}? Switch it off instead if you only want to hide it.`)) deleteMutation.mutate(l.id) }}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>}

      {rejecting && (
        <RejectModal
          listing={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => { setRejecting(null); qc.invalidateQueries({ queryKey: ['marketplace-listings'] }) }}
        />
      )}

      {editing && (
        <ServiceModal
          listing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['marketplace-listings'] }) }}
        />
      )}
    </div>
  )
}

function RejectModal({ listing, onClose, onDone }: { listing: Listing; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const reject = useMutation({
    mutationFn: () => api.post(`/marketplace/listings/${listing.id}/reject`, { reason: reason.trim() }),
    onSuccess: () => { toast.success('Rejected. The resident can see why.'); onDone() },
    onError:   (e: Error) => toast.error(e.message),
  })
  return (
    <Modal title={`Reject ${listing.title}`} onClose={onClose}>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (reason.trim()) reject.mutate() }}>
        <Field label="Why? (the resident will see this)">
          <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Phone number is not reachable" maxLength={500} autoFocus />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" loading={reject.isPending} disabled={!reason.trim()}>Reject</Button>
        </div>
      </form>
    </Modal>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs text-mute">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    </div>
  )
}

function ServiceModal({ listing, onClose, onSaved }: { listing: Listing | null; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState<ListingFormValues>(listing ? listingToForm(listing) : EMPTY_LISTING_FORM)
  const [showError, setShowError] = useState(false)
  const error = listingFormError(v)
  const set = (k: keyof ListingFormValues) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value })

  const save = useMutation({
    mutationFn: () => listing
      ? api.put(`/marketplace/listings/${listing.id}`, toListingPayload(v))
      : api.post('/marketplace/listings', toListingPayload(v)),
    onSuccess: () => { toast.success(listing ? 'Service updated' : 'Service added'); onSaved() },
    onError:   (e: Error) => toast.error(e.message),
  })

  return (
    <Modal title={listing ? 'Edit service' : 'Add service'} onClose={onClose}>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (error) setShowError(true); else save.mutate() }}>
        <Field label="Service provider"><Input value={v.providerName} onChange={set('providerName')} placeholder="Ramesh Kale" maxLength={100} autoFocus /></Field>
        <Field label="Phone number"><Input type="tel" value={v.phone} onChange={set('phone')} placeholder="9975001173" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select className={selectClass} value={v.category} onChange={set('category')}>
              {SERVICE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Service"><Input value={v.title} onChange={set('title')} placeholder="Leak repair" maxLength={120} /></Field>
        </div>
        <Field label="Details (optional)"><Input value={v.description} onChange={set('description')} placeholder="Taps, pipes and water tanks" maxLength={1000} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Rate (₹)"><Input inputMode="decimal" value={v.rate} onChange={set('rate')} placeholder="350" /></Field>
          <Field label="Charged">
            <select className={selectClass} value={v.rateUnit} onChange={set('rateUnit')}>
              {RATE_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </Field>
          <Field label="Society cut (%)" hint="0 if none"><Input inputMode="decimal" value={v.commission} onChange={set('commission')} /></Field>
        </div>
        {showError && error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={save.isPending}>{listing ? 'Save changes' : 'Add service'}</Button>
        </div>
      </form>
    </Modal>
  )
}
