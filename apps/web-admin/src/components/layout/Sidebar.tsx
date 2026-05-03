'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Building2, LayoutDashboard, CreditCard, Users, MessageSquare,
  ShieldAlert, Megaphone, BarChart3, CalendarCheck, Car, Globe,
  ShoppingBag, Wallet, Settings, LogOut,
} from 'lucide-react'
import { logout as authLogout } from '@/lib/auth'
import { stopSignalR } from '@/lib/useSignalR'
import { useRouter } from 'next/navigation'

const nav = [
  { label: 'Dashboard',    href: '/dashboard',    icon: LayoutDashboard },
  { label: 'Billing',      href: '/billing',      icon: CreditCard },
  { label: 'Members',      href: '/members',      icon: Users },
  { label: 'Visitors',     href: '/visitors',     icon: ShieldAlert },
  { label: 'Complaints',   href: '/complaints',   icon: MessageSquare },
  { label: 'Notices',      href: '/notices',      icon: Megaphone },
  { label: 'Accounting',   href: '/accounting',   icon: BarChart3 },
  { label: 'Facilities',   href: '/facilities',   icon: CalendarCheck },
  { label: 'Parking',      href: '/parking',      icon: Car },
  { label: 'Social Feed',  href: '/social',       icon: Globe },
  { label: 'Marketplace',  href: '/marketplace',  icon: ShoppingBag },
  { label: 'Wallet',       href: '/wallet',       icon: Wallet },
  { label: 'Settings',     href: '/settings',     icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  async function logout() {
    await stopSignalR()  // close WebSocket cleanly before clearing session
    await authLogout()   // POST /auth/logout + clears cookie/localStorage
    router.push('/login')
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-56 bg-gray-900 flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-gray-800">
        <div className="bg-brand-600 rounded-lg p-1.5">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <span className="text-white font-semibold text-sm">DS Admin</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-0.5 px-2">
        {nav.map(({ label, href, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition',
                active
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-gray-800">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
