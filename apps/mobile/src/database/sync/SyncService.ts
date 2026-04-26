import { synchronize } from '@nozbe/watermelondb/sync';
import { database }    from '../database';
import { apiClient }   from '../../services/api/apiClient';
import NetInfo         from '@react-native-community/netinfo';

/**
 * Pull-based WatermelonDB ↔ server sync.
 * Runs: on app foreground, on connectivity restore, manually.
 * Offline writes are queued in SQLite and pushed on next sync.
 */
export class SyncService {
  private static _syncing = false;

  static async sync(): Promise<void> {
    if (SyncService._syncing) return;

    const net = await NetInfo.fetch();
    if (!net.isConnected) return;   // offline — skip, will retry when online

    SyncService._syncing = true;
    try {
      await synchronize({
        database,

        // Pull: fetch changes from server since last sync cursor
        pullChanges: async ({ lastPulledAt }) => {
          const { data } = await apiClient.get('/sync/pull', {
            params: { lastPulledAt },
          });
          return data; // { changes: {...}, timestamp: number }
        },

        // Push: send locally-created records (offline writes) to server
        pushChanges: async ({ changes, lastPulledAt }) => {
          await apiClient.post('/sync/push', { changes, lastPulledAt });
        },

        migrationsEnabledAtVersion: 1,
      });
    } catch (err) {
      console.warn('[SyncService] Sync failed:', err);
    } finally {
      SyncService._syncing = false;
    }
  }

  /** Listen for connectivity restoration and auto-sync */
  static startAutoSync() {
    NetInfo.addEventListener((state) => {
      if (state.isConnected) SyncService.sync();
    });
  }
}
