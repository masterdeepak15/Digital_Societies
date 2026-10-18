import { describe, it, expect } from 'vitest'
import { formatBytes, readApkAnswer } from './appDownload'

const response = (ok: boolean, headers: Record<string, string>) => ({
  ok,
  headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
})

describe('formatBytes', () => {
  it('writes sizes for people', () => {
    expect(formatBytes(76_100_000)).toBe('72.6 MB')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(500)).toBe('500 B')
  })
  it('is empty when the size is unknown', () => {
    expect(formatBytes(null)).toBe('')
    expect(formatBytes(0)).toBe('')
    expect(formatBytes(NaN)).toBe('')
  })
})

describe('readApkAnswer', () => {
  it('is available when the file is served, with its size', () =>
    expect(readApkAnswer(response(true, { 'content-type': 'application/vnd.android.package-archive', 'content-length': '79691776' })))
      .toEqual({ available: true, size: '76.0 MB' }))
  it('is not available when the address is missing', () =>
    expect(readApkAnswer(response(false, {}))).toEqual({ available: false, size: '' }))
  it('is not available when a page comes back instead of a file', () =>
    expect(readApkAnswer(response(true, { 'content-type': 'text/html; charset=utf-8' }))).toEqual({ available: false, size: '' }))
  it('is available even when the size is not given', () =>
    expect(readApkAnswer(response(true, { 'content-type': 'application/octet-stream' }))).toEqual({ available: true, size: '' }))
})
