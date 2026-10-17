import { describe, it, expect } from 'vitest'
import { statusTone } from './status'

describe('statusTone', () => {
  it.each([
    ['paid', 'good'], ['Approved', 'good'], ['RESOLVED', 'good'], ['Entered', 'good'], ['Inside', 'good'], ['connected', 'good'],
    ['pending', 'warn'], ['Waiting', 'warn'], ['due', 'warn'], ['In Progress', 'warn'], ['in_progress', 'warn'], ['open', 'warn'],
    ['overdue', 'bad'], ['OVERDUE', 'bad'], ['Rejected', 'bad'], ['denied', 'bad'], ['failed', 'bad'], ['sos', 'bad'],
    ['Left', 'neutral'], ['', 'neutral'], ['closed', 'neutral'], ['whatever', 'neutral'],
  ] as const)('%s -> %s', (status, tone) => {
    expect(statusTone(status)).toBe(tone)
  })
})
