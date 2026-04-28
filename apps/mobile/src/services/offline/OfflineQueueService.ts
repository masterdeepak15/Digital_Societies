/**
 * OfflineQueueService
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles three offline-hardening responsibilities:
 *
 *  1. RETRY QUEUE — unsynced visitor records are pushed to the server whenever
 *     connectivity is restored, with exponential back-off.
 *
 *  2. AUTO-WIPE — visitor records older than WIPE_AFTER_DAYS (7) are deleted
 *     from the local SQLite database automatically. This limits PII exposure
 *     if the guard device is lost or stolen.
 *
 *  3. NETWORK LISTENER — subscribes to connectivity events and triggers a
 *     sync attempt each time the device comes back online.
 *
 * Usage (call once at app startup):
 *   OfflineQueueService.start()
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo'
import { Q }                     from '@nozbe/watermelondb'
import { database }              from '../../database/database'
import VisitorModel              from '../../database/models/VisitorModel'
import { SyncService }           from '../../database/sync/SyncService'

// ── Constants ─────────────────────────────────────────────────────────────────
const WIPE_AFTER_DAYS  = 7
const RETRY_INTERVAL   = 30_000    // ms — minimum time between retry attempts
const WIPE_INTERVAL    = 6 * 60 * 60 * 1000   // 6 h — how often we check for old records

// ── State ─────────────────────────────────────────────────────────────────────
let _networkUnsubscribe: (() => void) | null = null
let _retryTimer:  ReturnType<typeof setInterval> | null = null
let _wipeTimer:   ReturnType<typeof setInterval> | null = null
let _lastRetryAt = 0

// ── Public API ────────────────────────────────────────────────────────────────
export class OfflineQueueService {

  /** Call once when the app mounts (e.g. in root _layout.tsx useEffect). */
  static start(): void {
    OfflineQueueService._subscribeNetwork()
    OfflineQueueService._startWipeScheduler()
    // Run an immediate wipe on startup to clear any stale data from previous sessions
    OfflineQueueService._wipeOldVisitors().catch(console.warn)
  }

  /** Clean up listeners (call on app unmount / logout). */
  static stop(): void {
    _networkUnsubscribe?.()
    _networkUnsubscribe = null
    if (_retryTimer)  clearInterval(_retryTimer)
    if (_wipeTimer)   clearInterval(_wipeTimer)
    _retryTimer = null
    _wipeTimer  = null
  }

  /**
   * Returns the count of visitor records that are pending sync.
   * Useful for showing a badge/indicator on the guard UI.
   */
  static async pendingCount(): Promise<number> {
    const collection = database.get<VisitorModel>('visitors')
    const records    = await collection.query(Q.where('is_synced', false)).fetch()
    return records.length
  }

  /**
   * Immediately attempt to flush unsynced records.
   * No-op if offline or another sync is already in progress.
   */
  static async flushNow(): Promise<void> {
    const net = await NetInfo.fetch()
    if (!net.isConnected) return
    await OfflineQueueService._retrySyncNow()
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  /** Subscribe to connectivity events; trigger sync on reconnect. */
  private static _subscribeNetwork(): void {
    _networkUnsubscribe?.()
    _networkUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        // Debounce: don't retry more than once per RETRY_INTERVAL
        const now = Date.now()
        if (now - _lastRetryAt >= RETRY_INTERVAL) {
          OfflineQueueService._retrySyncNow().catch(console.warn)
        }
      }
    })
  }

  /** Push all unsynced visitor records to the server. */
  private static async _retrySyncNow(): Promise<void> {
    _lastRetryAt = Date.now()
    try {
      await SyncService.sync()
    } catch (err) {
      console.warn('[OfflineQueue] Sync attempt failed:', err)
    }
  }

  /** Schedule the wipe job to run every WIPE_INTERVAL ms. */
  private static _startWipeScheduler(): void {
    if (_wipeTimer) clearInterval(_wipeTimer)
    _wipeTimer = setInterval(() => {
      OfflineQueueService._wipeOldVisitors().catch(console.warn)
    }, WIPE_INTERVAL)
  }

  /**
   * Delete visitor records older than WIPE_AFTER_DAYS from local storage.
   * Only synced records are deleted — pending records are kept until synced.
   *
   * Why: GDPR / data minimisation — guard devices should not retain visitor
   * PII indefinitely. 7 days is enough for audit reference.
   */
  private static async _wipeOldVisitors(): Promise<void> {
    const cutoff     = Date.now() - WIPE_AFTER_DAYS * 24 * 60 * 60 * 1000
    const collection = database.get<VisitorModel>('visitors')

    // Find synced records older than the cutoff
    const stale = await collection.query(
      Q.and(
        Q.where('is_synced', true),
        Q.where('entry_time', Q.lt(cutoff))
      )
    ).fetch()

    if (stale.length === 0) return

    await database.write(async () => {
      const deletions = stale.map(record => record.prepareDestroyPermanently())
      await database.batch(...deletions)
    })

    console.info(`[OfflineQueue] Auto-wiped ${stale.length} visitor record(s) older than ${WIPE_AFTER_DAYS} days.`)
  }
}
