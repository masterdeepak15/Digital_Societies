import * as SecureStore from 'expo-secure-store';

/**
 * Single source of truth for which server the app talks to.
 * Only this file may read EXPO_PUBLIC_API_URL; everything else asks for getApiBase()/getHubUrl().
 */

const STORAGE_KEY = 'ds_server_url';

export type NormalizeResult =
  | { ok: true; origin: string }
  | { ok: false; reason: 'empty' | 'invalid' | 'not_https' | 'bad_port' };

const SCHEME = /^([a-z][a-z0-9+.-]*):\/\//i;
// host (domain / IPv4 / bracketed IPv6) with an optional :port, then an optional path/query/fragment
const AUTHORITY = /^(\[[0-9a-f:.]+\]|[^\s/:?#@[\]]+)(?::([^/?#\s]*))?(?:[/?#].*)?$/i;
const HOSTNAME = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;

/**
 * Accepts https://host, https://host:port (domain, IPv4 or [IPv6]) and returns the bare origin.
 * Path, query, fragment, trailing slashes and a pasted /api/v1 suffix are dropped.
 * http:// and scheme-less input are rejected (no guessing).
 */
export function normalizeServerUrl(raw: string): NormalizeResult {
  const text = (raw ?? '').trim();
  if (text === '') return { ok: false, reason: 'empty' };

  const scheme = SCHEME.exec(text);
  if (!scheme) {
    // "a.com", "a.com:8443", "192.168.1.20:8443": looks like an address but has no scheme.
    return { ok: false, reason: AUTHORITY.test(text) ? 'not_https' : 'invalid' };
  }
  if (scheme[1].toLowerCase() !== 'https') return { ok: false, reason: 'not_https' };

  const m = AUTHORITY.exec(text.slice(scheme[0].length));
  if (!m) return { ok: false, reason: 'invalid' };

  const host = m[1].toLowerCase();
  if (!host.startsWith('[') && !HOSTNAME.test(host)) return { ok: false, reason: 'invalid' };

  let port = '';
  if (m[2] !== undefined) {
    if (!/^\d+$/.test(m[2])) return { ok: false, reason: 'invalid' };
    const n = Number(m[2]);
    if (n < 1 || n > 65535) return { ok: false, reason: 'bad_port' };
    port = `:${n}`;
  }
  return { ok: true, origin: `https://${host}${port}` };
}

export class ServerNotConfiguredError extends Error {
  constructor() {
    super('No server address is configured.');
    this.name = 'ServerNotConfiguredError';
  }
}

// undefined = not read yet, null = read and empty
let cached: string | null | undefined;

/** Origin of the build-time default server (EXPO_PUBLIC_API_URL), or null when unset/invalid. */
export function originFromEnv(env: string | undefined): string | null {
  if (!env) return null;
  const n = normalizeServerUrl(env);
  return n.ok ? n.origin : null;
}

export async function getServerOrigin(): Promise<string | null> {
  if (cached === undefined) {
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    const n = stored ? normalizeServerUrl(stored) : null;
    cached = n && n.ok ? n.origin : originFromEnv(process.env.EXPO_PUBLIC_API_URL);
  }
  return cached;
}

export async function setServerOrigin(origin: string): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, origin);
  cached = origin;
}

export async function clearServerOrigin(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
  cached = undefined;
}

export async function getApiBase(): Promise<string> {
  const origin = await getServerOrigin();
  if (!origin) throw new ServerNotConfiguredError();
  return `${origin}/api/v1`;
}

export async function getHubUrl(): Promise<string> {
  const origin = await getServerOrigin();
  if (!origin) throw new ServerNotConfiguredError();
  return `${origin}/hubs/society`;
}

export type ConnectionResult =
  | { ok: true }
  | { ok: false; kind: 'timeout' | 'network' | 'certificate' | 'http'; status?: number };

export function classifyFetchError(e: unknown): 'timeout' | 'network' | 'certificate' {
  const name = (e as { name?: string } | null)?.name;
  if (name === 'AbortError') return 'timeout';
  const message = e instanceof Error ? e.message : String(e ?? '');
  // React Native often reports TLS failures as a bare "Network request failed", which cannot be
  // told apart from an unreachable host; only explicit messages are classified as certificate.
  if (/certificate|ssl|tls|trust anchor/i.test(message)) return 'certificate';
  return 'network';
}

const TEST_TIMEOUT_MS = 8000;

/** GET {origin}/health with an 8 s timeout. */
export async function testConnection(
  origin: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectionResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${origin}/health`, { signal: controller.signal });
    return res.ok ? { ok: true } : { ok: false, kind: 'http', status: res.status };
  } catch (e) {
    return { ok: false, kind: classifyFetchError(e) };
  } finally {
    clearTimeout(timer);
  }
}
