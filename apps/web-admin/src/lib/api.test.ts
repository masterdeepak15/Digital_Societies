import { describe, it, expect, afterEach, vi } from 'vitest'
import { api, ApiError } from './api'

const respond = (status: number, body: string | null, headers: Record<string, string> = { 'Content-Type': 'application/json' }) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status, headers })))

afterEach(() => { vi.unstubAllGlobals() })

describe('api responses', () => {
  it('reads a JSON body', async () => {
    respond(201, JSON.stringify({ noticeId: 'n1' }))
    expect(await api.post('/notices', {})).toEqual({ noticeId: 'n1' })
  })

  it('treats a successful answer with no body as success (pinning a notice returns a bare 200)', async () => {
    respond(200, '')
    expect(await api.put('/notices/n1/pin', { isPinned: true })).toBeUndefined()
  })

  it('treats 204 as success', async () => {
    respond(204, null)
    expect(await api.delete('/something/1')).toBeUndefined()
  })

  it('treats a body of only whitespace as no body', async () => {
    respond(200, '  \n')
    expect(await api.post('/x', {})).toBeUndefined()
  })

  it('still reports the server message when the call fails', async () => {
    respond(422, JSON.stringify({ title: 'ENTRY.NOT_PENDING', detail: 'Entry is not pending approval' }))
    await expect(api.post('/accounting/entries/1/approve', {})).rejects.toMatchObject({ status: 422, message: 'Entry is not pending approval' })
  })

  it('falls back to the status when a failure has no readable body', async () => {
    respond(500, '<html>oops</html>', { 'Content-Type': 'text/html' })
    await expect(api.get('/x')).rejects.toBeInstanceOf(ApiError)
    await expect(api.get('/x')).rejects.toMatchObject({ status: 500, message: 'HTTP 500' })
  })
})
