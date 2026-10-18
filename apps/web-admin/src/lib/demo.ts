// Demo/mock data is a development convenience only. In any other environment a failed or
// still-loading request must show an empty state, never invented residents, bills or visitors.
export const DEMO_ENABLED = process.env.NODE_ENV === 'development'

/** Returns the demo value in development, or a blanked-out copy (empty lists, 0, '') otherwise. */
export function demo<T>(value: T): T {
  if (DEMO_ENABLED) return value
  if (Array.isArray(value)) return [] as unknown as T
  if (typeof value === 'number') return 0 as unknown as T
  if (typeof value === 'string') return '' as unknown as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, demo(v)]),
    ) as T
  }
  return value
}
