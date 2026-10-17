import { useEffect } from 'react';
import { Stack }     from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts as useJakarta, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts as useFigtree, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold } from '@expo-google-fonts/figtree';
import { useFonts as useManrope, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { SyncService }          from '../src/database/sync/SyncService';
import { OfflineQueueService }  from '../src/services/offline/OfflineQueueService';
import { ThemeProvider }        from '../src/theme/ThemeProvider';

// Keep the splash screen up until the fonts are ready (or have failed — then system fonts are used).
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [jakartaLoaded, jakartaError] = useJakarta({
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
  });
  const [figtreeLoaded, figtreeError] = useFigtree({
    Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold,
  });
  const [manropeLoaded, manropeError] = useManrope({
    Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold,
  });
  const fontsDone =
    (jakartaLoaded || !!jakartaError) && (figtreeLoaded || !!figtreeError) && (manropeLoaded || !!manropeError);

  useEffect(() => {
    if (fontsDone) SplashScreen.hideAsync().catch(() => {});
  }, [fontsDone]);

  useEffect(() => {
    // SyncService handles WatermelonDB ↔ server pull/push sync
    SyncService.startAutoSync();
    // OfflineQueueService adds: retry queue, 7-day auto-wipe, connectivity listener
    OfflineQueueService.start();
    return () => OfflineQueueService.stop();
  }, []);

  if (!fontsDone) return null;

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)"  />
      </Stack>
    </ThemeProvider>
  );
}
