import type { ConnectionResult, NormalizeResult } from './serverConfig';

type Rejection = Extract<NormalizeResult, { ok: false }>['reason'];

export function describeValidation(reason: Rejection): string {
  switch (reason) {
    case 'empty':     return "Enter your society's address.";
    case 'not_https': return 'Start with https://';
    case 'bad_port':  return 'Port must be between 1 and 65535.';
    default:          return 'That does not look like a web address.';
  }
}

export function describeConnection(result: ConnectionResult): string {
  if (result.ok) return 'Connected.';
  switch (result.kind) {
    case 'timeout':     return 'The server did not answer in 8 seconds.';
    case 'certificate': return "This phone does not trust the server's certificate.";
    case 'http':        return `The server answered with an error (status ${result.status ?? 'unknown'}).`;
    default:
      // Android reports an untrusted certificate as a plain network failure, so say so.
      return 'Could not reach the server. Check the address and your connection. If it uses a self-signed certificate, this phone must trust it first.';
  }
}
