import Cookies from 'js-cookie'
import { adaptResponse } from './adapters'

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
const REFRESH_KEY = 'ds_refresh'

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
  // POST /auth/refresh takes the refresh token in the body (not the access token).
  const refreshToken = Cookies.get(REFRESH_KEY)
  if (!refreshToken) return null
  try {
    const res = await fetch(resolveUrl('/auth/refresh'), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return null
    const { accessToken, refreshToken: rotated } =
      (await res.json()) as { accessToken?: string; refreshToken?: string }
    if (accessToken) Cookies.set(TOKEN_KEY, accessToken, { expires: 7, sameSite: 'Lax', secure: secureCookie() })
    if (rotated)     Cookies.set(REFRESH_KEY, rotated, { expires: 30, sameSite: 'Lax', secure: secureCookie() })
    return accessToken ?? null
  } catch {
    return null
  }
}

// Sign-in endpoints answer 401 for a wrong/expired code. That is a normal validation failure,
// not an expired session: it must surface the server message, not refresh-and-redirect.
const isAuthEndpoint = (path: string) => /^\/auth\/(otp|2fa|refresh)(\/|$)/.test(path)

// Cookies carry bearer tokens: mark them Secure whenever the page is served over HTTPS.
const secureCookie = () => typeof location !== 'undefined' && location.protocol === 'https:'

function clearSessionAndRedirect() {
  Cookies.remove(TOKEN_KEY)
  Cookies.remove(REFRESH_KEY)
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
  if (res.status === 401 && !_retry && !isAuthEndpoint(path)) {
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
    // ProblemDetails: `detail` is the human message, `title` is the machine code.
    try { const j = await res.json(); msg = j.detail ?? j.message ?? j.title ?? msg } catch {}
    throw new ApiError(res.status, msg)
  }

  if (res.status === 204) return undefined as T
  const json = await res.json()
  // GET list responses are normalised once here (see adapters.ts); writes pass through untouched.
  const method = (fetchOptions.method ?? 'GET').toUpperCase()
  return (method === 'GET' ? adaptResponse(path, json) : json) as T
}

export const api = {
  get:    <T>(path: string)                     => request<T>(path),
  post:   <T>(path: string, body: unknown)      => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown)      => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown)      => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: <T>(path: string)                     => request<T>(path, { method: 'DELETE' }),
}
