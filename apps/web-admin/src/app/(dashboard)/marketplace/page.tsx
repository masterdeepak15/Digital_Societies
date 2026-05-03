'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShoppingBag, Search, AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api'
import { formatDate, cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

// ── Types — aligned with API ListingDto ───────────────────────────────────────
// API: { id, providerName, title, category, price, rating, isActive }
// Backend has no admin moderation endpoints (approve/reject/delete) yet —
// the page is intentionally read-only until those endpoints land. See AUDIT-WEB-ADMIN.md.
interface Listing {
  id:           string
  title:        string
  description?: string
  price:        number
  category:     string
  isActive:     boolean
  rating?:      number
  providerName: string
  // UI-only optional fields (kept so demo data still renders nicely)
  postedBy?:    string
  flatDisplay?: string
  createdAt?:   string
  reportCount?: number
  status?:      'pending' | 'active' | 'sold' | 'rejected'
}

interface ListingsPage { items: Listing[]; total: number; page: number; pageSize: number }

type Tab = 'listings' | 'reported'
type CategoryFilter = 'all' | 'Cleaning' | 'Plumbing' | 'Electrical' | 'Painting' | 'Gardening' | 'Repairs' | 'Other'

const CATEGORY_EMOJI: Record<string, string> = {
  Cleaning:   '🧹',
  Plumbing:   '🔧',
  Electrical: '💡',
  Painting:   '🎨',
  Gardening:  '🌿',
  Repairs:    '🛠️',
  Other:      '🏷️',
}

const CATEGORY_COLOR: Record<string, string> = {
  Cleaning:   'bg-blue-100 text-blue-700',
  Plumbing:   'bg-purple-100 text-purple-700',
  Electrical: 'bg-orange-100 text-orange-700',
  Painting:   'bg-pink-100 text-pink-700',
  Gardening:  'bg-green-100 text-green-700',
  Repairs:    'bg-amber-100 text-amber-700',
  Other:      'bg-gray-100 text-gray-700',
}

export default function MarketplacePage() {
  const [tab,      setTab]      = useState<Tab>('listings')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [search,   setSearch]   = useState('')

  const { data } = useQuery<ListingsPage>({
    queryKey: ['marketplace-listings', tab],
    queryFn:  () => api.get('/marketplace/listings'),
  })
  const listings: Listing[] = data?.items ?? DEMO_LISTINGS

  // NOTE: backend has no admin moderation endpoints for listings yet.
  // Approve / reject / delete buttons removed until PATCH/DELETE /marketplace/listings/{id}
  // is implemented. See AUDIT-WEB-ADMIN.md for the planned API.

  const displayed = listings.filter(l => {
    const matchesTab      = tab === 'reported' ? (l.reportCount ?? 0) > 0 : true
    const matchesCategory = category === 'all' || l.category === category
    const matchesSearch   = search === '' ||
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      (l.providerName ?? l.postedBy ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (l.flatDisplay ?? '').toLowerCase().includes(search.toLowerCase())
    return matchesTab && matchesCategory && matchesSearch
  })

  const activeCount   = listings.filter(l => l.isActive).length
  const inactiveCount = listings.filter(l => !l.isActive).length
  const reportedCount = listings.filter(l => (l.reportCount ?? 0) > 0).length

  return (
    <div className="space-y-5">
      <PageHeader
        title="Marketplace"
        description="Society classifieds — approve listings and moderate reports"
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Active Listings</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Inactive</p>
          <p className="text-2xl font-bold text-gray-400 mt-1">{inactiveCount}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Reported</p>
          <p className={`text-2xl font-bold mt-1 ${reportedCount > 0 ? 'text-red-500' : 'text-gray-900'}`}>{reportedCount}</p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['listings', 'reported'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium capitalize transition',
              tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            {t === 'reported' ? `Reported${reportedCount > 0 ? ` (${reportedCount})` : ''}` : 'All Listings'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search title, resident, flat…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg flex-wrap">
          {(['all', 'Cleaning', 'Plumbing', 'Electrical', 'Painting', 'Gardening', 'Repairs', 'Other'] as CategoryFilter[]).map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition',
                category === c ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
              {c === 'all' ? 'All' : `${CATEGORY_EMOJI[c] ?? ''} ${c}`}
            </button>
          ))}
        </div>
      </div>

      {/* Listings */}
      {displayed.length === 0
        ? <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
            <EmptyState icon={ShoppingBag} title="No listings match this filter" />
          </div>
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayed.map(listing => (
              <div key={listing.id} className={cn(
                'bg-white border rounded-xl shadow-sm overflow-hidden',
                (listing.reportCount ?? 0) > 0 ? 'border-red-200' : 'border-gray-100'
              )}>
                {/* Image placeholder */}
                <div className="h-36 bg-gray-100 flex items-center justify-center text-4xl">
                  {CATEGORY_EMOJI[listing.category]}
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-800 leading-tight">{listing.title}</h3>
                    {(listing.reportCount ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full shrink-0">
                        <AlertTriangle className="w-3 h-3" /> {listing.reportCount ?? 0}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', CATEGORY_COLOR[listing.category] ?? 'bg-gray-100 text-gray-700')}>
                      {listing.category}
                    </span>
                    <Badge label={listing.isActive ? 'Active' : 'Inactive'} />
                    {listing.rating != null && (
                      <span className="text-xs text-amber-600">★ {listing.rating.toFixed(1)}</span>
                    )}
                  </div>

                  {listing.description && <p className="text-sm text-gray-500 line-clamp-2">{listing.description}</p>}

                  {listing.price > 0
                    ? <p className="text-lg font-bold text-gray-900">₹{listing.price.toLocaleString('en-IN')}</p>
                    : <p className="text-sm font-medium text-green-600">Free</p>
                  }

                  <div className="text-xs text-gray-400">
                    {listing.providerName ?? listing.postedBy}
                    {listing.flatDisplay ? ` · ${listing.flatDisplay}` : ''}
                    {listing.createdAt   ? ` · ${formatDate(listing.createdAt)}` : ''}
                  </div>

                  {/* Admin moderation API for marketplace listings is not yet implemented. */}
                  <p className="text-xs text-gray-300 italic pt-1">Read-only — moderation API pending</p>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_LISTINGS: Listing[] = [
  { id:'1', title:'Quick Fix — Tap & pipe repairs', description:'Same-day fixes for leaks and clogs', price:250,   category:'Plumbing',   isActive:true,  rating:4.6, providerName:'Quick Fix',     flatDisplay:'A-101', createdAt:'2026-04-20', reportCount:0 },
  { id:'2', title:'BrightSpark Electrical',         description:'Wiring, fan installation, switch repairs', price:300, category:'Electrical', isActive:true, rating:4.4, providerName:'BrightSpark',    flatDisplay:'A-102', createdAt:'2026-04-22', reportCount:1 },
  { id:'3', title:'Maths Home Tutor (Class 9-10)',  description:'Experienced maths tutor. Online/offline. Weekends available.', price:2000, category:'Other', isActive:true, rating:4.8, providerName:'Anita Desai', flatDisplay:'A-104', createdAt:'2026-04-24', reportCount:0 },
  { id:'4', title:'Greenery Garden Care',           description:'Weekly garden trimming + watering for balconies and lawns.', price:600, category:'Gardening', isActive:false, rating:4.1, providerName:'Greenery Co.',  flatDisplay:'B-101', createdAt:'2026-04-27', reportCount:0 },
  { id:'5', title:'CleanSweep Deep Clean',          description:'2-3 BHK deep clean, eco-friendly chemicals, 4-hour service.', price:1500, category:'Cleaning', isActive:true, rating:4.7, providerName:'CleanSweep',  flatDisplay:'A-105', createdAt:'2026-04-28', reportCount:0 },
  { id:'6', title:'PaintRight — interior',          description:'Wall painting and texture work. Material extra.', price:8000, category:'Painting', isActive:true, rating:4.2, providerName:'PaintRight',  flatDisplay:'C-201', createdAt:'2026-04-18', reportCount:2 },
]
