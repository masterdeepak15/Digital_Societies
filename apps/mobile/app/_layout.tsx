import { useEffect } from 'react';
import { Stack }     from 'expo-router';
import { SyncService }          from '../src/database/sync/SyncService';
import { OfflineQueueService }  from '../src/services/offline/OfflineQueueService';

export default function RootLayout() {
  useEffect(() => {
    // SyncService handles WatermelonDB ↔ server pull/push sync
    SyncService.startAutoSync();
    // OfflineQueueService adds: retry queue, 7-day auto-wipe, connectivity listener
    OfflineQueueService.start();
    return () => OfflineQueueService.stop();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)"  />
    </Stack>
  );
}
