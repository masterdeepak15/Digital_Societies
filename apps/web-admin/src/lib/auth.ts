import Cookies from 'js-cookie'
import { API_BASE } from './api'

const TOKEN_KEY   = 'ds_token'
const REFRESH_KEY = 'ds_refresh'
const USER_KEY    = 'ds_user'

export interface AdminUser {
  userId:    string
  name:      string
  email:     string
  phone?:    string | null
  roles:     string[]
  societyId: string
}

/** Shape of GET /auth/me and of `profile` in the OTP / 2FA verify responses. */
export interface ApiProfile {
  userId:       string
  name:         string
  email:        string
  phone?:       string | null
  memberships?: { societyId: string; role: string }[]
}

/** The console only needs roles + the first society; derive them from the API profile. */
export function profileToAdminUser(p: ApiProfile): AdminUser {
  const memberships = p.memberships ?? []
  return {
    userId:    p.userId,
    name:      p.name,
    email:     p.email,
    phone:     p.phone ?? null,
    roles:     Array.from(new Set(memberships.map(m => m.role.toLowerCase()))),
    societyId: memberships[0]?.societyId ?? '',
  }
}

export function saveSession(token: string, user: AdminUser, refreshToken?: string) {
  const secure = typeof location !== 'undefined' && location.protocol === 'https:'
  Cookies.set(TOKEN_KEY, token, { expires: 7, sameSite: 'Lax', secure })
  if (refreshToken) Cookies.set(REFRESH_KEY, refreshToken, { expires: 30, sameSite: 'Lax', secure })
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getRefreshToken(): string | undefined {
  return Cookies.get(REFRESH_KEY)
}

export function clearSession() {
  Cookies.remove(TOKEN_KEY)
  Cookies.remove(REFRESH_KEY)
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
  const refreshToken = getRefreshToken()
  try {
    if (token && refreshToken) {
      // The server revokes the refresh token it is given; without a body it cannot.
      await fetch(`${API_BASE}/auth/logout`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ refreshToken }),
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
    const profile = (await res.json()) as ApiProfile
    if (!profile?.userId) return null
    const user = profileToAdminUser(profile)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    }
    return user
  } catch {
    return null
  }
}
