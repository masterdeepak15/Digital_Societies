import { describeValidation, describeConnection } from './messages';

describe('describeValidation', () => {
  it.each([
    ['empty',     "Enter your society's address."],
    ['not_https', 'Start with https://'],
    ['invalid',   'That does not look like a web address.'],
    ['bad_port',  'Port must be between 1 and 65535.'],
  ] as const)('%p', (reason, text) => {
    expect(describeValidation(reason)).toBe(text);
  });
});

describe('describeConnection', () => {
  it('names the timeout', () => {
    expect(describeConnection({ ok: false, kind: 'timeout' })).toBe('The server did not answer in 8 seconds.');
  });
  it('explains the certificate problem', () => {
    expect(describeConnection({ ok: false, kind: 'certificate' })).toBe("This phone does not trust the server's certificate.");
  });
  it('mentions self-signed certificates for a generic network failure', () => {
    const text = describeConnection({ ok: false, kind: 'network' });
    expect(text).toMatch(/Could not reach the server/);
    expect(text).toMatch(/self-signed certificate/);
  });
  it('includes the HTTP status', () => {
    expect(describeConnection({ ok: false, kind: 'http', status: 503 })).toBe('The server answered with an error (status 503).');
  });
  it('is a friendly confirmation when ok', () => {
    expect(describeConnection({ ok: true })).toBe('Connected.');
  });
});
