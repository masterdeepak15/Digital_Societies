import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router }       from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import RoleRouter       from '../../src/navigation/RoleRouter';
import { useAuthStore } from '../../src/store/authStore';
import { authService }  from '../../src/services/api/authService';
import { Colors }       from '../../src/theme/colors';

/**
 * App shell — guards all (app) routes.
 *
 * Two cases:
 *  1. Fresh login — `isAuthenticated` is already true (set by LoginScreen).
 *  2. App restart — token is in SecureStore but Zustand store is empty.
 *     → Call /auth/me to re-hydrate the store, then render RoleRouter.
 */
export default function AppLayout() {
  const { isAuthenticated, login } = useAuthStore();
  const [checking, setChecking] = useState(!isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      setChecking(false);
      return;
    }

    // App restart path: check SecureStore for a stored token
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('ds_access_token');
        if (!token) {
          router.replace('/(auth)/login');
          return;
        }
        // Token exists — re-hydrate store from server
        const { data } = await authService.me();
        login(data, token);
      } catch {
        // Token expired or server unreachable → force re-login
        router.replace('/(auth)/login');
      } finally {
        setChecking(false);
      }
    })();
  }, [isAuthenticated, login]);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) return null;
  return <RoleRouter />;
}
