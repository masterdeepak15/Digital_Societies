import { synchronize } from '@nozbe/watermelondb/sync';
import { database }    from '../database';
import { apiClient }   from '../../services/api/apiClient';
import NetInfo         from '@react-native-community/netinfo';
import { uploadImage } from '../../services/media/mediaService';

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
    let pushedVisitorIds: string[] = [];
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
          const created: Array<Record<string, any>> = (changes as any).visitors?.created ?? [];
          // Pictures taken at the gate (maybe offline) are uploaded first; the server then only gets their ids.
          // If an upload fails the whole push fails, so the entry stays queued and is retried later.
          const withPictures = [];
          for (const rec of created) {
            const next = { ...rec };
            if (rec.photo_uri && !rec.photo_media_id) next.photo_media_id = (await uploadImage(rec.photo_uri)).id;
            if (rec.id_photo_uri && !rec.id_photo_media_id) next.id_photo_media_id = (await uploadImage(rec.id_photo_uri)).id;
            withPictures.push(next);
          }
          const payload = { ...(changes as any), visitors: { ...(changes as any).visitors, created: withPictures } };
          const { data } = await apiClient.post('/sync/push', { changes: payload, lastPulledAt });
          // The server keeps its own copy under a new id and the next pull brings it back, so once every
          // offline visitor is applied the local stand-ins are removed (otherwise the log shows them twice).
          if (created.length > 0 && data?.applied === created.length) pushedVisitorIds = created.map((r) => r.id);
        },

        // No migrations exist yet (schema version 1), so migration sync must stay off:
        // WatermelonDB rejects it on a database created without a migrations definition.
      });
      if (pushedVisitorIds.length > 0) {
        await database.write(async () => {
          for (const id of pushedVisitorIds) {
            try { await (await database.get('visitors').find(id)).destroyPermanently(); } catch { /* already gone */ }
          }
        });
        SyncService._syncing = false;
        void SyncService.sync(); // pull the server copies back in
      }
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
