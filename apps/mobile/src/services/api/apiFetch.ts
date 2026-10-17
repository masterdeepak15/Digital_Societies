import type { Method } from 'axios';
import { apiClient } from './apiClient';

/**
 * fetch-shaped helper for screens that used raw fetch(): same signature, but it goes through
 * apiClient so the request uses the configured server, carries the auth token and active society,
 * and refreshes an expired session.
 */
export async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  try {
    const { data } = await apiClient.request<T>({
      url:     path,
      method:  (opts?.method ?? 'GET') as Method,
      data:    typeof opts?.body === 'string' ? JSON.parse(opts.body) : undefined,
      headers: opts?.headers as Record<string, string> | undefined,
    });
    return data;
  } catch (e: any) {
    const body = e?.response?.data;
    throw new Error(body?.message ?? body?.detail ?? 'Request failed');
  }
}
