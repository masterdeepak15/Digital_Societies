import { useEffect } from 'react';
import { Stack }     from 'expo-router';
import { SyncService } from '../src/database/sync/SyncService';

export default function RootLayout() {
  useEffect(() => {
    SyncService.startAutoSync();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)"  />
    </Stack>
  );
}
