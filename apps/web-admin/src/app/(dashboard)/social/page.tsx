'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Flag, Pin, Lock, Eye, MessageSquare, ThumbsUp } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDateTime, initialsOf } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'

// ── Types — aligned with API PostDto ─────────────────────────────────────────
// API: { id, authorUserId, authorName, body, category, createdAt, isPinned, isLocked, imageCount, commentCount, reactionsCount }
// UI keeps a few optional fields (reportCount, reportReason, status) that come from a future moderation join.
interface ReportedPost {
  id:             string
  authorUserId?:  string
  authorName:     string
  authorFlat?:    string
  body:           string
  category?:      string
  createdAt:      string
  isPinned:       boolean
  isLocked:       boolean
  commentCount:   number
  reactionsCount: number
  imageCount?:    number
  imageSrc?:      string
  // Moderation-only:
  reportCount?:   number
  reportReason?:  string
  status?:        'pending' | 'removed' | 'cleared'
}

interface PostsPage { items: ReportedPost[]; total: number; page: number; pageSize: number }

type Tab = 'reported' | 'all'

export default function SocialFeedPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('reported')

  const { data } = useQuery<PostsPage>({
    queryKey: ['social', tab],
    queryFn:  () => api.get('/social/posts?page=1&pageSize=50'),
  })
  const posts: ReportedPost[] = data?.items ?? DEMO_POSTS

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/social/posts/${id}`),
    onSuccess:  () => { toast.success('Post removed'); qc.invalidateQueries({ queryKey: ['social'] }) },
    onError:    (e: Error) => toast.error(e.message),
  })

  // No dedicated "clear report" endpoint exists yet — for now we just refresh.
  // Once POST /social/posts/{id}/dismiss-reports lands, swap this in.
  const clearMutation = useMutation({
    mutationFn: async (_id: string) => Promise.resolve(),
    onSuccess:  () => { toast.success('Report cleared'); qc.invalidateQueries({ queryKey: ['social'] }) },
  })

  const pinMutation = useMutation({
    mutationFn: ({ id, pin }: { id: string; pin: boolean }) =>
      api.put(`/social/posts/${id}/pin`, { isPinned: pin }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['social'] }),
    onError:    (e: Error) => toast.error(e.message),
  })

  const lockMutation = useMutation({
    mutationFn: ({ id, lock }: { id: string; lock: boolean }) =>
      api.put(`/social/posts/${id}/lock`, { isLocked: lock }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['social'] }),
    onError:    (e: Error) => toast.error(e.message),
  })

  // Mute author button removed — backend has no /social/users/{id}/mute endpoint yet.
  // Tracked as P2 follow-up in AUDIT-WEB-ADMIN.md.

  const reported = posts.filter(p => (p.reportCount ?? 0) > 0 && (p.status ?? 'pending') === 'pending')
  const displayed = tab === 'reported' ? reported : posts

  return (
    <div className="space-y-5">
      <PageHeader
        title="Social Feed"
        description="Community posts moderation"
        action={
          reported.length > 0 && (
            <span className="bg-red-100 text-red-700 text-sm font-medium px-3 py-1 rounded-full">
              {reported.length} reported {reported.length === 1 ? 'post' : 'posts'}
            </span>
          )
        }
      />

      {/* Tab nav */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { key: 'reported', label: `Reported (${reported.length})` },
          { key: 'all',      label: 'All Posts' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition',
              tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Post cards */}
      {displayed.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
          <EmptyState icon={MessageSquare} title="No posts to moderate" description="All clear! No reported content." />
        </div>
      ) : (
        <div className="space-y-4">
          {displayed.map(post => (
            <div
              key={post.id}
              className={cn(
                'bg-white border rounded-xl shadow-sm overflow-hidden',
                (post.reportCount ?? 0) > 0 && post.status === 'pending' ? 'border-red-200' : 'border-gray-100'
              )}
            >
              {/* Report banner */}
              {(post.reportCount ?? 0) > 0 && (post.status ?? 'pending') === 'pending' && (
                <div className="bg-red-50 border-b border-red-100 px-5 py-2 flex items-center gap-2">
                  <Flag className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-red-700 font-medium">
                    {post.reportCount ?? 0} report{(post.reportCount ?? 0) > 1 ? 's' : ''}
                    {post.reportReason ? ` — ${post.reportReason}` : ''}
                  </span>
                </div>
              )}

              <div className="p-5">
                {/* Author row */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold">
                    {initialsOf(post.authorName)}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-800">{post.authorName}</p>
                    <p className="text-xs text-gray-400">
                      {post.authorFlat ? `${post.authorFlat} · ` : ''}{formatDateTime(post.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {post.isPinned && <Badge label="pinned" />}
                    {post.isLocked && <Badge label="locked" />}
                    {post.status === 'removed' && <Badge label="removed" />}
                  </div>
                </div>

                {/* Content */}
                <p className="text-sm text-gray-700 mb-3">{post.body}</p>
                {post.imageSrc && (
                  <img src={post.imageSrc} alt="" className="rounded-lg w-full max-h-48 object-cover mb-3" />
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                  <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" />{post.reactionsCount}</span>
                  <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" />{post.commentCount} comments</span>
                </div>

                {/* Moderation actions */}
                <div className="flex gap-2 flex-wrap border-t border-gray-50 pt-3">
                  {(post.status ?? 'pending') === 'pending' && (post.reportCount ?? 0) > 0 && (
                    <>
                      <button
                        onClick={() => clearMutation.mutate(post.id)}
                        disabled={clearMutation.isPending}
                        className="flex items-center gap-1.5 text-xs text-green-700 border border-green-200 hover:bg-green-50 px-3 py-1.5 rounded-lg transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> Clear Report
                      </button>
                      <button
                        onClick={() => removeMutation.mutate(post.id)}
                        disabled={removeMutation.isPending}
                        className="flex items-center gap-1.5 text-xs text-red-600 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition"
                      >
                        <Flag className="w-3.5 h-3.5" /> Remove Post
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => pinMutation.mutate({ id: post.id, pin: !post.isPinned })}
                    disabled={pinMutation.isPending}
                    className={cn(
                      'flex items-center gap-1.5 text-xs border px-3 py-1.5 rounded-lg transition',
                      post.isPinned
                        ? 'text-amber-700 border-amber-200 hover:bg-amber-50'
                        : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    <Pin className="w-3.5 h-3.5" /> {post.isPinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    onClick={() => lockMutation.mutate({ id: post.id, lock: !post.isLocked })}
                    disabled={lockMutation.isPending}
                    className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition"
                  >
                    <Lock className="w-3.5 h-3.5" /> {post.isLocked ? 'Unlock' : 'Lock Comments'}
                  </button>
                  {/* Mute Author button removed — endpoint not implemented (see AUDIT-WEB-ADMIN.md). */}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_POSTS: ReportedPost[] = [
  {
    id: '1',
    body: 'The management committee is completely incompetent! They can\'t even fix the lift for 3 days. What are we paying maintenance for?? Useless administration.',
    authorName: 'Anonymous123',
    authorFlat: 'B-203',
    createdAt: '2026-04-26T18:30:00Z',
    reportCount: 4,
    reportReason: 'Abusive language and personal attacks',
    status: 'pending',
    reactionsCount: 2,
    commentCount: 8,
    isPinned: false,
    isLocked: false,
  },
  {
    id: '2',
    body: 'Anyone selling furniture? Looking for a second-hand sofa and dining table. Budget ₹15,000.',
    authorName: 'Priya Mehta',
    authorFlat: 'A-102',
    createdAt: '2026-04-26T10:00:00Z',
    reportCount: 1,
    reportReason: 'Spam / commercial post',
    status: 'pending',
    reactionsCount: 3,
    commentCount: 5,
    isPinned: false,
    isLocked: false,
  },
  {
    id: '3',
    body: 'Reminder: AGM is on May 5 at 7 PM in the Club House. Please confirm attendance. Agenda will be shared tomorrow.',
    authorName: 'Rajesh Sharma',
    createdAt: '2026-04-25T09:00:00Z',
    reactionsCount: 24,
    commentCount: 12,
    isPinned: true,
    isLocked: false,
  },
  {
    id: '4',
    body: 'Beautiful sunset from our terrace yesterday! Love living here ❤️',
    authorName: 'Anita Desai',
    authorFlat: 'A-104',
    createdAt: '2026-04-24T19:45:00Z',
    reactionsCount: 42,
    commentCount: 7,
    isPinned: false,
    isLocked: false,
  },
]
