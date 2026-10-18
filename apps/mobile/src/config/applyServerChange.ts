export interface ServerChangeDeps {
  getOrigin: () => Promise<string | null>;
  setOrigin: (origin: string) => Promise<void>;
  clearTokens: () => Promise<void>;
  logout: () => void;
}

// Resolved lazily so importing this module (and its tests) does not pull in native modules.
function defaultDeps(): ServerChangeDeps {
  const cfg = require('./serverConfig') as typeof import('./serverConfig');
  const { authService } = require('../services/api/authService') as typeof import('../services/api/authService');
  const { useAuthStore } = require('../store/authStore') as typeof import('../store/authStore');
  return {
    getOrigin: cfg.getServerOrigin,
    setOrigin: cfg.setServerOrigin,
    clearTokens: authService.clearTokens,
    logout: () => useAuthStore.getState().logout(),
  };
}

/**
 * Saves a new server origin. A different server means the stored tokens and society belong to
 * someone else's backend, so the session is cleared; saving the same origin changes nothing.
 */
export async function applyServerChange(origin: string, deps: ServerChangeDeps = defaultDeps()): Promise<{ changed: boolean }> {
  const current = await deps.getOrigin();
  if (current === origin) return { changed: false };
  // Sign out first: a request in flight must never pair the old session's tokens with the new origin.
  deps.logout();
  await deps.clearTokens();
  await deps.setOrigin(origin);
  return { changed: true };
}
