import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://societies.athomes.space/api/v1';

const KEYS = {
  ACCESS_TOKEN:  'ds_access_token',
  REFRESH_TOKEN: 'ds_refresh_token',
  SOCIETY_ID:    'ds_active_society',
} as const;

/**
 * Axios instance with:
 * - JWT injection on every request
 * - Silent refresh on 401 (with retry)
 * - X-Society-Id header for tenant resolution
 * - Offline queue support (via react-query mutation cache)
 */
function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: BASE_URL,
    timeout: 15_000,
    headers: { 'Content-Type': 'application/json' },
  });

  // Request interceptor: attach JWT + active society
  client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const [token, societyId] = await Promise.all([
      SecureStore.getItemAsync(KEYS.ACCESS_TOKEN),
      SecureStore.getItemAsync(KEYS.SOCIETY_ID),
    ]);
    if (token)    config.headers.Authorization = `Bearer ${token}`;
    if (societyId) config.headers['X-Society-Id'] = societyId;
    return config;
  });

  // Response interceptor: handle 401 → refresh → retry once
  let isRefreshing = false;
  let failedQueue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config;
      if (error.response?.status !== 401 || original._retry) throw error;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return client(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        await Promise.all([
          SecureStore.setItemAsync(KEYS.ACCESS_TOKEN,  data.accessToken),
          SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, data.refreshToken),
        ]);

        failedQueue.forEach((p) => p.resolve(data.accessToken));
        failedQueue = [];

        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return client(original);
      } catch (refreshError) {
        failedQueue.forEach((p) => p.reject(refreshError));
        failedQueue = [];
        // Clear tokens — force re-login
        await Promise.all([
          SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
          SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
        ]);
        throw refreshError;
      } finally {
        isRefreshing = false;
      }
    }
  );

  return client;
}

export const apiClient = createApiClient();
export { KEYS as TokenKeys };
