/** Where the all-in-one image serves the Android app from. Other installs have no such file. */
export const APK_PATH = '/download/digital-societies.apk'

/** "76.1 MB" for a byte count; an empty string when the size is unknown. */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0 || !Number.isFinite(bytes)) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++ }
  return `${unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

/** What a HEAD request for the app file tells us: whether it is there, and how big it is. */
export function readApkAnswer(res: { ok: boolean; headers: { get(name: string): string | null } }): { available: boolean; size: string } {
  const type = res.headers.get('content-type') ?? ''
  // A web server that answers every address with a page is not a file: only count real app files.
  const looksLikeApp = !type.includes('text/html')
  if (!res.ok || !looksLikeApp) return { available: false, size: '' }
  const length = Number(res.headers.get('content-length'))
  return { available: true, size: formatBytes(Number.isFinite(length) ? length : null) }
}
