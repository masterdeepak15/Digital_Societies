/**
 * apiFetch — thin typed wrapper around the shared Axios client.
 *
 * Usage:
 *   const data = await apiFetch<MyType>('/some/endpoint');
 *   const data = await apiFetch<MyType>('/some/endpoint', {
 *     method: 'POST',
 *     body: JSON.stringify(payload),
 *   });
 *
 * Compatible with fetch-style call-sites (method / body options) while
 * delegating auth, token-refresh and tenant headers to apiClient.
 */
import { apiClient } from '../services/api/apiClient';

interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?:   string;
  headers?: Record<string, string>;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { method = 'GET', body, headers } = options;

  const response = await apiClient.request<T>({
    url:     path,
    method,
    data:    body ? JSON.parse(body) : undefined,
    headers: headers ?? {},
  });

  return response.data;
}
