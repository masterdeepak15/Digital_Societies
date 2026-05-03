'use client'

/**
 * useSignalR — connects to /hubs/society with JWT auth and invalidates
 * React Query caches when the server pushes live events.
 *
 * Supported server → client events (match SignalR hub method names):
 *   VisitorCheckedIn     → invalidates ['visitors']
 *   VisitorExited        → invalidates ['visitors']
 *   ComplaintCreated     → invalidates ['complaints', 'dashboard']
 *   ComplaintUpdated     → invalidates ['complaints', 'dashboard']
 *   NoticePublished      → invalidates ['notices']
 *   BillGenerated        → invalidates ['bills', 'dashboard']
 *   BillPaid             → invalidates ['bills', 'dashboard']
 *
 * Reconnects automatically (SignalR HubConnection default policy).
 * The hook is a no-op in SSR (typeof window === 'undefined').
 *
 * Usage — mount once at the top of the authenticated layout or providers:
 *   useSignalR()
 */

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getToken } from './auth'
import { API_BASE } from './api'

// @microsoft/signalr must be installed:
//   npm install @microsoft/signalr  (package is already in society-app stack)
// We import lazily so SSR bundles don't choke on the browser-only WebSocket API.
type HubConnection = import('@microsoft/signalr').HubConnection

let _connection: HubConnection | null = null

export function useSignalR() {
  const qc = useQueryClient()

  useEffect(() => {
    if (typeof window === 'undefined') return

    let mounted = true

    async function connect() {
      // Lazy import — keeps SSR clean.
      const { HubConnectionBuilder, LogLevel, HttpTransportType } =
        await import('@microsoft/signalr')

      const token = getToken()
      if (!token) return   // not authenticated — skip

      const hubUrl = `${API_BASE.replace('/api/v1', '')}/hubs/society`

      const connection = new HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => getToken() ?? '',
          transport: HttpTransportType.WebSockets,
        })
        .withAutomaticReconnect()
        .configureLogging(
          process.env.NODE_ENV === 'development' ? LogLevel.Information : LogLevel.Warning,
        )
        .build()

      // ── Event handlers ──────────────────────────────────────────────────────
      connection.on('VisitorCheckedIn', () => {
        qc.invalidateQueries({ queryKey: ['visitors'] })
        qc.invalidateQueries({ queryKey: ['dashboard'] })
      })

      connection.on('VisitorExited', () => {
        qc.invalidateQueries({ queryKey: ['visitors'] })
        qc.invalidateQueries({ queryKey: ['dashboard'] })
      })

      connection.on('ComplaintCreated', () => {
        qc.invalidateQueries({ queryKey: ['complaints'] })
        qc.invalidateQueries({ queryKey: ['dashboard'] })
      })

      connection.on('ComplaintUpdated', () => {
        qc.invalidateQueries({ queryKey: ['complaints'] })
        qc.invalidateQueries({ queryKey: ['dashboard'] })
      })

      connection.on('NoticePublished', () => {
        qc.invalidateQueries({ queryKey: ['notices'] })
      })

      connection.on('BillGenerated', () => {
        qc.invalidateQueries({ queryKey: ['bills'] })
        qc.invalidateQueries({ queryKey: ['dashboard'] })
      })

      connection.on('BillPaid', () => {
        qc.invalidateQueries({ queryKey: ['bills'] })
        qc.invalidateQueries({ queryKey: ['dashboard'] })
      })

      connection.onreconnected(() => {
        // Re-fetch everything stale after a reconnect gap.
        qc.invalidateQueries()
      })

      try {
        await connection.start()
        if (mounted) _connection = connection
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[SignalR] Could not connect to /hubs/society:', err)
        }
        // Non-fatal — app works without live updates (falls back to staleTime polling).
      }
    }

    // Only create one connection per browser session.
    if (!_connection) connect()

    return () => {
      mounted = false
      // Do NOT stop the connection on component unmount — it's a singleton
      // intended to persist for the whole authenticated session.
      // It's stopped on logout via stopSignalR().
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/**
 * Call this on logout to cleanly close the WebSocket.
 * Should be called from the same place that calls auth.logout().
 */
export async function stopSignalR() {
  if (_connection) {
    try { await _connection.stop() } catch {}
    _connection = null
  }
}
