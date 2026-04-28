'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShoppingBag, Search, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDate, cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Listing {
  id:           string
  title:        string
  description:  string
  price:        number
  category:     'sale' | 'rent' | 'service' | 'free'
  status:       'pending' | 'active' | 'sold' | 'rejected'
  images:       string[]
  postedBy:     string
  flatDisplay:  string
  createdAt:    string
  reportCount:  number
}

type Tab = 'listings' | 'reported'
type CategoryFilter = 'all' | 'sale' | 'rent' | 'service' | 'free'

const CATEGORY_EMOJI: Record<string, string> = {
  sale:    '🏷️',
  rent:    '🔑',
  service: '🔧',
  free:    '🎁',
}

const CATEGORY_COLOR: Record<string, string> = {
  sale:    'bg-blue-100 text-blue-700',
  rent:    'bg-purple-100 text-purple-700',
  service: 'bg-orange-100 text-orange-700',
  free:    'bg-green-100 text-green-700',
}

export default function MarketplacePage() {
  const qc = useQueryClient()
  const [tab,      setTab]      = useState<Tab>('listings')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [search,   setSearch]   = useState('')

  const { data: listings = DEMO_LISTINGS } = useQuery<Listing[]>({
    queryKey: ['marketplace-listings', tab],
    queryFn:  () => api.get(`/marketplace/listings?status=${tab === 'reported' ? 'reported' : 'pending,active'}`),
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/marketplace/listings/${id}`, { status: 'active' }),
    onSuccess:  () => { toast.success('Listing approved'); qc.invalidateQueries({ queryKey: ['marketplace-listings'] }) },
    onError:    (e: Error) => toast.error(e.message),
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/marketplace/listings/${id}`, { status: 'rejected' }),
    onSuccess:  () => { toast.success('Listing rejected'); qc.invalidateQueries({ queryKey: ['marketplace-listings'] }) },
    onError:    (e: Error) => toast.error(e.message),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/marketplace/listings/${id}`),
    onSuccess:  () => { toast.success('Listing removed'); qc.invalidateQueries({ queryKey: ['marketplace-listings'] }) },
    onError:    (e: Error) => toast.error(e.message),
  })

  const displayed = listings.filter(l => {
    const matchesTab      = tab === 'reported' ? l.reportCount > 0 : true
    const matchesCategory = category === 'all' || l.category === category
    const matchesSearch   = search === '' ||
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.postedBy.toLowerCase().includes(search.toLowerCase()) ||
      l.flatDisplay.toLowerCase().includes(search.toLowerCase())
    return matchesTab && matchesCategory && matchesSearch
  })

  const pendingCount  = listings.filter(l => l.status === 'pending').length
  const activeCount   = listings.filter(l => l.status === 'active').length
  const reportedCount = listings.filter(l => l.reportCount > 0).length

  return (
    <div className="space-y-5">
      <PageHeader
        title="Marketplace"
        description="Society classifieds — approve listings and moderate reports"
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Pending Approval</p>
          <p className="text-2xl font-bold text-amber-500 mt-1">{pendingCount}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Active Listings</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{activeCount}</p>
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
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['all', 'sale', 'rent', 'service', 'free'] as CategoryFilter[]).map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium capitalize transition',
                category === c ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
              {c === 'all' ? 'All' : `${CATEGORY_EMOJI[c]} ${c}`}
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
                listing.reportCount > 0 ? 'border-red-200' : 'border-gray-100'
              )}>
                {/* Image placeholder */}
                <div className="h-36 bg-gray-100 flex items-center justify-center text-4xl">
                  {CATEGORY_EMOJI[listing.category]}
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-800 leading-tight">{listing.title}</h3>
                    {listing.reportCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full shrink-0">
                        <AlertTriangle className="w-3 h-3" /> {listing.reportCount}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', CATEGORY_COLOR[listing.category])}>
                      {listing.category}
                    </span>
                    <Badge label={listing.status} />
                  </div>

                  <p className="text-sm text-gray-500 line-clamp-2">{listing.description}</p>

                  {listing.price > 0
                    ? <p className="text-lg font-bold text-gray-900">₹{listing.price.toLocaleString()}</p>
                    : <p className="text-sm font-medium text-green-600">Free</p>
                  }

                  <div className="text-xs text-gray-400">
                    {listing.postedBy} · {listing.flatDisplay} · {formatDate(listing.createdAt)}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    {listing.status === 'pending' && (
                      <>
                        <button
                          onClick={() => approveMutation.mutate(listing.id)}
                          className="flex-1 flex items-center justify-center gap-1 text-xs text-green-700 border border-green-200 hover:bg-green-50 py-1.5 rounded-lg">
                          <CheckCircle className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate(listing.id)}
                          className="flex-1 flex items-center justify-center gap-1 text-xs text-red-600 border border-red-200 hover:bg-red-50 py-1.5 rounded-lg">
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    )}
                    {listing.status === 'active' && listing.reportCount > 0 && (
                      <button
                        onClick={() => { if (confirm('Remove this listing?')) removeMutation.mutate(listing.id) }}
                        className="flex-1 flex items-center justify-center gap-1 text-xs text-red-600 border border-red-200 hover:bg-red-50 py-1.5 rounded-lg">
                        <XCircle className="w-3.5 h-3.5" /> Remove Listing
                      </button>
                    )}
                  </div>
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
  { id:'1', title:'Sofa Set (3+1+1)', description:'Beige fabric sofa set, 3 years old, minor wear. Moving out sale.', price:8000, category:'sale', status:'active', images:[], postedBy:'Rajesh Sharma', flatDisplay:'A-101', createdAt:'2026-04-20', reportCount:0 },
  { id:'2', title:'Parking Slot Sublet', description:'B2-05 car slot available for sublet from May. Monthly ₹1500.', price:1500, category:'rent', status:'active', images:[], postedBy:'Priya Mehta', flatDisplay:'A-102', createdAt:'2026-04-22', reportCount:1 },
  { id:'3', title:'Home Tutor — Maths (Class 9-10)', description:'Experienced maths tutor. Online/offline. Weekends available.', price:2000, category:'service', status:'active', images:[], postedBy:'Anita Desai', flatDisplay:'A-104', createdAt:'2026-04-24', reportCount:0 },
  { id:'4', title:'Baby Clothes Bundle', description:'0-6 month baby clothes, gently used, all branded. Free to a good home.', price:0, category:'free', status:'pending', images:[], postedBy:'Meena Patel', flatDisplay:'B-101', createdAt:'2026-04-27', reportCount:0 },
  { id:'5', title:'MacBook Pro 14" M3', description:'2024 model, 16GB/512GB. 1 year warranty remaining. Bill available.', price:95000, category:'sale', status:'pending', images:[], postedBy:'Vikram Nair', flatDisplay:'A-105', createdAt:'2026-04-28', reportCount:0 },
  { id:'6', title:'Yoga Classes', description:'Morning yoga sessions in terrace garden, 6:30–7:30 AM, Mon/Wed/Fri.', price:800, category:'service', status:'active', images:[], postedBy:'Sunita Rao', flatDisplay:'C-201', createdAt:'2026-04-18', reportCount:2 },
]
