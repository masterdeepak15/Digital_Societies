const mockRequest = jest.fn();
jest.mock('./apiClient', () => ({ apiClient: { request: (...a: unknown[]) => mockRequest(...a) } }));

import { apiFetch } from './apiFetch';

beforeEach(() => mockRequest.mockReset());

describe('apiFetch', () => {
  it('sends a GET with no body by default and returns the response data', async () => {
    mockRequest.mockResolvedValue({ data: { ok: 1 } });
    await expect(apiFetch('/parking/levels')).resolves.toEqual({ ok: 1 });
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ url: '/parking/levels', method: 'GET', data: undefined }));
  });

  it('parses a JSON string body and keeps the method', async () => {
    mockRequest.mockResolvedValue({ data: {} });
    await apiFetch('/sos', { method: 'POST', body: JSON.stringify({ lat: 1, lng: 2 }) });
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ url: '/sos', method: 'POST', data: { lat: 1, lng: 2 } }));
  });

  it('throws the server message when the request fails', async () => {
    mockRequest.mockRejectedValue({ response: { data: { message: 'Slot taken' } } });
    await expect(apiFetch('/x')).rejects.toThrow('Slot taken');
  });

  it('falls back to ProblemDetails detail, then to a generic message', async () => {
    mockRequest.mockRejectedValueOnce({ response: { data: { detail: 'Not allowed' } } });
    await expect(apiFetch('/x')).rejects.toThrow('Not allowed');
    mockRequest.mockRejectedValueOnce(new Error('timeout'));
    await expect(apiFetch('/x')).rejects.toThrow('Request failed');
  });
});
