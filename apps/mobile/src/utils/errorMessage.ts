/** A message a person can act on, taken from the server's reply when there is one. */
export function errorMessage(e: any, fallback = 'Something went wrong.'): string {
  const data = e?.response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  const fromServer = data?.message ?? data?.detail;
  if (typeof fromServer === 'string' && fromServer.trim()) return fromServer;
  if (e?.message === 'Network Error') return 'Could not reach the server. Check your connection and try again.';
  return fallback;
}
