import Cookies from 'js-cookie'

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
  localStorage.removeItem(USER_KEY)
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
