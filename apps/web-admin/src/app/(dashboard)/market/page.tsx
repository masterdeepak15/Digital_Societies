'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tag, Trash2, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'

// GET /marketplace/market → [{ id, kind, title, description, priceRupees, condition, status, authorFlatDisplay, replyCount, createdAt }]
// GET /marketplace/market/{id} → { post, replies: [{ id, authorFlatDisplay, body, createdAt }] }
interface Post {
  id: string; kind: 'Sell' | 'Wanted' | 'Borrow'; title: string; description: string; priceRupees: number | null
  condition: string | null; status: 'Open' | 'Closed'; authorFlatDisplay: string; replyCount: number; createdAt: string
}
interface Reply { id: string; authorFlatDisplay: string; body: string; createdAt: string }

const KINDS = [
  { value: 'all',    label: 'All' },
  { value: 'Sell',   label: 'For sale' },
  { value: 'Wanted', label: 'Wanted' },
  { value: 'Borrow', label: 'Borrow' },
]
const kindLabel = (k: string) => KINDS.find(x => x.value === k)?.label ?? k
const price = (p: Post) =>
  p.kind === 'Borrow' ? '' : p.priceRupees == null ? (p.kind === 'Wanted' ? 'Any price' : 'Open to offers')
  : p.priceRupees === 0 ? 'Free' : `${p.kind === 'Wanted' ? 'Up to ' : ''}₹${p.priceRupees.toLocaleString('en-IN')}`
const when = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

/** Management view of the society market: see everything neighbours post and remove what should not be there. */
export default function MarketPage() {
  const qc = useQueryClient()
  const [kind, setKind] = useState('all')
  const [open, setOpen] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ items: Post[] }>({
    queryKey: ['market-posts'],
    queryFn: () => api.get('/marketplace/market?pageSize=50'),
  })
  const posts = (data?.items ?? []).filter(p => kind === 'all' || p.kind === kind)

  const removePost = useMutation({
    mutationFn: (id: string) => api.delete(`/marketplace/market/${id}`),
    onSuccess: () => { toast.success('Post removed'); qc.invalidateQueries({ queryKey: ['market-posts'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-5">
      <PageHeader title="Society market" description="What residents sell, want to buy or want to borrow. You can remove anything that should not be there." />

      <div className="flex flex-wrap gap-1 rounded-lg bg-surface-alt p-1 w-fit">
        {KINDS.map(k => (
          <button key={k.value} onClick={() => setKind(k.value)}
            className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition', kind === k.value ? 'bg-surface text-ink shadow-sm' : 'text-mute hover:text-ink')}>
            {k.label}
          </button>
        ))}
      </div>

      {posts.length === 0 && !isLoading
        ? <div className="rounded-xl border border-line bg-surface"><EmptyState icon={Tag} title="Nothing posted yet" description="Residents post from the mobile app: things to sell, buy or borrow." /></div>
        : <div className="space-y-3">
            {posts.map(p => (
              <div key={p.id} className={cn('rounded-xl border border-line bg-surface p-4', p.status === 'Closed' && 'opacity-70')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge label={kindLabel(p.kind)} />
                      {p.status === 'Closed' && <Badge label="Closed" />}
                      <span className="text-xs text-mute">{p.authorFlatDisplay} · {when(p.createdAt)}</span>
                    </div>
                    <h3 className="mt-1 font-semibold text-ink">{p.title}</h3>
                    {price(p) && <p className="text-sm font-medium text-ink">{price(p)}</p>}
                    {p.description && <p className="mt-1 line-clamp-2 text-sm text-mute">{p.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="secondary" className="min-h-[32px] px-3 text-xs" onClick={() => setOpen(open === p.id ? null : p.id)}>
                      <MessageSquare className="h-3.5 w-3.5" /> {p.replyCount} {open === p.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" className="min-h-[32px] px-3 text-xs text-bad" aria-label={`Remove ${p.title}`}
                      loading={removePost.isPending && removePost.variables === p.id}
                      onClick={() => { if (confirm(`Remove "${p.title}"? It disappears for everyone.`)) removePost.mutate(p.id) }}>
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
                </div>
                {open === p.id && <Replies postId={p.id} onChanged={() => qc.invalidateQueries({ queryKey: ['market-posts'] })} />}
              </div>
            ))}
          </div>}
    </div>
  )
}

function Replies({ postId, onChanged }: { postId: string; onChanged: () => void }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<{ post: Post; replies: Reply[] }>({
    queryKey: ['market-post', postId],
    queryFn: () => api.get(`/marketplace/market/${postId}`),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/marketplace/market/replies/${id}`),
    onSuccess: () => { toast.success('Reply removed'); qc.invalidateQueries({ queryKey: ['market-post', postId] }); onChanged() },
    onError: (e: Error) => toast.error(e.message),
  })
  const replies = data?.replies ?? []
  return (
    <div className="mt-3 space-y-2 border-t border-line pt-3">
      {isLoading && <p className="text-sm text-mute">Loading replies…</p>}
      {!isLoading && replies.length === 0 && <p className="text-sm text-mute">No replies yet.</p>}
      {replies.map(r => (
        <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg bg-surface-alt px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-mute">{r.authorFlatDisplay} · {when(r.createdAt)}</p>
            <p className="text-sm text-ink">{r.body}</p>
          </div>
          <Button variant="ghost" className="min-h-[28px] px-2 text-xs text-bad" aria-label="Remove reply"
            loading={remove.isPending && remove.variables === r.id} onClick={() => remove.mutate(r.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  )
}
