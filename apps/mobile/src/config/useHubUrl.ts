import { useEffect, useState } from 'react';
import { getHubUrl } from './serverConfig';

/** The SignalR hub URL for the configured server, or null until known / when unconfigured. */
export function useHubUrl(): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getHubUrl().then((u) => { if (alive) setUrl(u); }).catch(() => { if (alive) setUrl(null); });
    return () => { alive = false; };
  }, []);
  return url;
}
