import Cookies from 'js-cookie'

// Single source of truth for the backend prefix.
//
// NEXT_PUBLIC_API_URL can be set in two equivalent ways:
//   • "https://host"         — legacy format; we append /api/v1
//   • "https://host/api/v1"  — full format; we use as-is (avoids double prefix)
//
// Callers write clean paths like '/wallet/balance'.
// Endpoints outside the v1 prefix (e.g. /hubs/society) use absolute URLs.
const rawApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '')
export const API_BASE = rawApiUrl.endsWith('/api/v1')
  ? rawApiUrl
  : `${rawApiUrl}/api/v1`

// HOST is the scheme+domain portion — used for non-v1 paths like SignalR hubs.
export const API_HOST = API_BASE.replace(/\/api\/v1$/, '')

const TOKEN_KEY = 'ds_token'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path        // absolute URL — leave alone
  if (path.startsWith('/_/')) return `${API_HOST}${path.slice(2)}`  // /_/health → /health
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

// ── Token refresh — one in-flight refresh shared across concurrent 401s ────────
let _refreshPromise: Promise<string | null> | null = null

async function doRefresh(): Promise<string | null> {
  const token = Cookies.get(TOKEN_KEY)
  if (!token) return null
  try {
    const res = await fetch(resolveUrl('/auth/refresh'), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    })
    if (!res.ok) return null
    const { accessToken } = (await res.json()) as { accessToken?: string }
    if (accessToken) Cookies.set(TOKEN_KEY, accessToken, { expires: 7, sameSite: 'Lax' })
    return accessToken ?? null
  } catch {
    return null
  }
}

function clearSessionAndRedirect() {
  Cookies.remove(TOKEN_KEY)
  if (typeof localStorage !== 'undefined') localStorage.removeItem('ds_user')
  if (typeof window !== 'undefined') window.location.href = '/login'
}

// Internal request — _retry prevents infinite refresh loops.
async function request<T>(
  path: string,
  options: RequestInit & { _retry?: boolean } = {},
): Promise<T> {
  const token = Cookies.get(TOKEN_KEY)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  // X-Society-Id removed — server resolves societyId from the JWT (RLS).

  const { _retry, ...fetchOptions } = options
  const res = await fetch(resolveUrl(path), { ...fetchOptions, headers })

  // ── 401 → attempt token refresh, retry once ────────────────────────────────
  if (res.status === 401 && !_retry) {
    if (!_refreshPromise) {
      _refreshPromise = doRefresh().finally(() => { _refreshPromise = null })
    }
    const newToken = await _refreshPromise
    if (newToken) {
      // Retry the original request with the fresh token.
      return request<T>(path, { ...options, _retry: true })
    }
    // Refresh failed — session is dead; redirect to login.
    clearSessionAndRedirect()
    throw new ApiError(401, 'Session expired — please log in again')
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try { const j = await res.json(); msg = j.title ?? j.message ?? msg } catch {}
    throw new ApiError(res.status, msg)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get:    <T>(path: string)                     => request<T>(path),
  post:   <T>(path: string, body: unknown)      => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown)      => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown)      => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: <T>(path: string)                     => request<T>(path, { method: 'DELETE' }),
}
