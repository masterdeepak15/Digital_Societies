import { useEffect }  from 'react';
import { router }     from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import RoleRouter      from '../../src/navigation/RoleRouter';
import { useAuthStore } from '../../src/store/authStore';

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync('ds_access_token');
      if (!token) router.replace('/(auth)/login');
    })();
  }, []);

  if (!isAuthenticated) return null;
  return <RoleRouter />;
}
