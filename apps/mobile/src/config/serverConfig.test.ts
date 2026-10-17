/**
 * Each test loads a fresh copy of the module (isolateModules) so the in-memory origin cache and
 * the EXPO_PUBLIC_API_URL fallback never leak between tests.
 */
type Mod = typeof import('./serverConfig');

function load(_env?: string, stored?: string): { mod: Mod; store: Map<string, string> } {
  const store = new Map<string, string>();
  if (stored) store.set('ds_server_url', stored);
  let mod!: Mod;
  jest.isolateModules(() => {
    jest.doMock('expo-secure-store', () => ({
      getItemAsync: async (k: string) => store.get(k) ?? null,
      setItemAsync: async (k: string, v: string) => { store.set(k, v); },
      deleteItemAsync: async (k: string) => { store.delete(k); },
    }));
    mod = require('./serverConfig');
  });
  return { mod, store };
}

describe('normalizeServerUrl', () => {
  const { mod } = load();
  const ok = (raw: string) => mod.normalizeServerUrl(raw);

  it.each([
    ['https://a.com',                        'https://a.com'],
    ['https://a.com:8443',                   'https://a.com:8443'],
    ['https://192.168.1.20:8443',            'https://192.168.1.20:8443'],
    ['https://[::1]:8443',                   'https://[::1]:8443'],
    ['  HTTPS://Example.COM/ ',              'https://example.com'],
    ['https://a.com/api/v1/',                'https://a.com'],
    ['https://a.com/some/path?q=1#x',        'https://a.com'],
  ])('accepts %p -> %p', (raw, origin) => {
    expect(ok(raw)).toEqual({ ok: true, origin });
  });

  it.each([
    ['',                  'empty'],
    ['   ',               'empty'],
    ['http://a.com',      'not_https'],
    ['a.com',             'not_https'],
    ['a.com:8443',        'not_https'],
    ['ftp://a.com',       'not_https'],
    ['https://',          'invalid'],
    ['https://a b',       'invalid'],
    ['https://user@a.com', 'invalid'],
    ['https://a.com:0',   'bad_port'],
    ['https://a.com:99999', 'bad_port'],
  ])('rejects %p with %p', (raw, reason) => {
    expect(ok(raw)).toEqual({ ok: false, reason });
  });
});

describe('stored origin and derived URLs', () => {
  it('throws ServerNotConfiguredError when nothing is stored and no env fallback', async () => {
    const { mod } = load();
    await expect(mod.getApiBase()).rejects.toBeInstanceOf(mod.ServerNotConfiguredError);
    await expect(mod.getHubUrl()).rejects.toBeInstanceOf(mod.ServerNotConfiguredError);
    expect(await mod.getServerOrigin()).toBeNull();
  });

  it('derives the API base and hub URL from the saved origin', async () => {
    const { mod, store } = load();
    await mod.setServerOrigin('https://a.com:8443');
    expect(store.get('ds_server_url')).toBe('https://a.com:8443');
    expect(await mod.getApiBase()).toBe('https://a.com:8443/api/v1');
    expect(await mod.getHubUrl()).toBe('https://a.com:8443/hubs/society');
  });

  it('reads an origin saved by a previous run', async () => {
    const { mod } = load(undefined, 'https://saved.example');
    expect(await mod.getServerOrigin()).toBe('https://saved.example');
  });

  // Expo inlines process.env.EXPO_PUBLIC_* at build time, so the fallback is tested as a pure function.
  it('derives the build-time default origin from EXPO_PUBLIC_API_URL', () => {
    const { mod } = load();
    expect(mod.originFromEnv('https://env.example/api/v1')).toBe('https://env.example');
    expect(mod.originFromEnv(undefined)).toBeNull();
    expect(mod.originFromEnv('')).toBeNull();
    expect(mod.originFromEnv('http://insecure.example')).toBeNull();
  });

  it('clearServerOrigin forgets the saved value', async () => {
    const { mod } = load();
    await mod.setServerOrigin('https://a.com');
    await mod.clearServerOrigin();
    expect(await mod.getServerOrigin()).toBeNull();
  });
});

describe('classifyFetchError', () => {
  const { mod } = load();
  const named = (name: string, message = '') => Object.assign(new Error(message), { name });

  it('treats AbortError as timeout', () => {
    expect(mod.classifyFetchError(named('AbortError'))).toBe('timeout');
  });
  it.each(['SSL handshake failed', 'certificate verify failed', 'TLS error', 'Trust anchor for certification path not found'])(
    'treats %p as certificate', (msg) => {
      expect(mod.classifyFetchError(new Error(msg))).toBe('certificate');
    });
  it('treats anything else as network', () => {
    expect(mod.classifyFetchError(new TypeError('Network request failed'))).toBe('network');
    expect(mod.classifyFetchError('boom')).toBe('network');
  });
});

describe('testConnection', () => {
  const { mod } = load();
  const res = (status: number) => ({ ok: status >= 200 && status < 300, status }) as Response;

  it('is ok on 200 and calls /health on the origin', async () => {
    const f = jest.fn(async () => res(200));
    expect(await mod.testConnection('https://a.com', f as unknown as typeof fetch)).toEqual({ ok: true });
    expect((f.mock.calls[0] as unknown[])[0]).toBe('https://a.com/health');
  });
  it('reports the status for a non-2xx answer', async () => {
    const f = jest.fn(async () => res(503));
    expect(await mod.testConnection('https://a.com', f as unknown as typeof fetch))
      .toEqual({ ok: false, kind: 'http', status: 503 });
  });
  it('classifies a thrown error', async () => {
    const f = jest.fn(async () => { throw new TypeError('Network request failed'); });
    expect(await mod.testConnection('https://a.com', f as unknown as typeof fetch))
      .toEqual({ ok: false, kind: 'network' });
    const g = jest.fn(async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); });
    expect(await mod.testConnection('https://a.com', g as unknown as typeof fetch))
      .toEqual({ ok: false, kind: 'timeout' });
  });
});
