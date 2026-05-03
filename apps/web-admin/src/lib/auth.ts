import Cookies from 'js-cookie'
import { API_BASE } from './api'

const TOKEN_KEY = 'ds_token'
const USER_KEY  = 'ds_user'

export interface AdminUser {
  userId:    string
  name:      string
  phone:     string
  roles:     string[]
  societyId: string
}

export function saveSession(token: string, user: AdminUser) {
  Cookies.set(TOKEN_KEY, token, { expires: 7, sameSite: 'Lax' })
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  Cookies.remove(TOKEN_KEY)
  if (typeof localStorage !== 'undefined') localStorage.removeItem(USER_KEY)
}

export function getToken(): string | undefined {
  return Cookies.get(TOKEN_KEY)
}

export function getUser(): AdminUser | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as AdminUser } catch { return null }
}

export function isLoggedIn(): boolean {
  return !!getToken()
}

/**
 * POST /auth/logout — invalidates the refresh-token in Redis.
 * Clears local session regardless of whether the call succeeds.
 */
export async function logout(): Promise<void> {
  const token = getToken()
  try {
    if (token) {
      await fetch(`${API_BASE}/auth/logout`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      })
    }
  } catch { /* swallow network errors — session cleared regardless */ } finally {
    clearSession()
  }
}

/**
 * GET /auth/me — fetches the current user's profile from the server and
 * refreshes the local USER_KEY cache. Returns null if unauthenticated.
 */
export async function fetchMe(): Promise<AdminUser | null> {
  const token = getToken()
  if (!token) return null
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (!res.ok) return null
    const user = (await res.json()) as AdminUser
    if (user?.userId) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(USER_KEY, JSON.stringify(user))
      }
    }
    return user
  } catch {
    return null
  }
}
