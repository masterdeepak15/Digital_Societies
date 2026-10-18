import type { AdminUser } from './auth'

/** Pages only an admin may open; an accountant sees the finance side of the console. */
export const ADMIN_ONLY_PATHS = ['/wallet', '/members', '/flats', '/complaints', '/parking', '/settings'] as const

export const isAdminUser = (user: AdminUser | null): boolean => !!user && user.roles.includes('admin')

/** True when `user` may open `pathname` (an unknown user is let through; the API still enforces access). */
export function canOpen(user: AdminUser | null, pathname: string): boolean {
  if (!user || isAdminUser(user)) return true
  return !ADMIN_ONLY_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}
