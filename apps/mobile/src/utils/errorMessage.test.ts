import { errorMessage } from './errorMessage';

describe('errorMessage', () => {
  it('prefers the server message', () => {
    expect(errorMessage({ response: { data: { code: 'FACILITY.LIMIT', message: 'Maximum 2 advance bookings per flat.' } }, message: 'Request failed with status code 400' }))
      .toBe('Maximum 2 advance bookings per flat.');
  });
  it('reads a ProblemDetails detail', () => {
    expect(errorMessage({ response: { data: { title: 'VALIDATION', detail: 'Incorrect code.' } } })).toBe('Incorrect code.');
  });
  it('accepts a plain string body', () => {
    expect(errorMessage({ response: { data: 'Unknown flat for this society.' } })).toBe('Unknown flat for this society.');
  });
  it('explains a network failure', () => {
    expect(errorMessage({ message: 'Network Error' })).toMatch(/reach the server/i);
  });
  it('falls back to the fallback text', () => {
    expect(errorMessage({}, 'Something went wrong.')).toBe('Something went wrong.');
    expect(errorMessage(undefined)).toBe('Something went wrong.');
  });
});
