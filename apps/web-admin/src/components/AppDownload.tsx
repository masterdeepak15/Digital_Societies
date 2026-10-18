'use client'

import { useEffect, useState } from 'react'
import { Smartphone } from 'lucide-react'
import { APK_PATH, readApkAnswer } from '@/lib/appDownload'

/** "Get the Android app" card for the sign-in page. It shows only when this install actually serves the app file. */
export function AppDownload() {
  const [apk, setApk] = useState<{ available: boolean; size: string }>({ available: false, size: '' })

  useEffect(() => {
    let cancelled = false
    fetch(APK_PATH, { method: 'HEAD', cache: 'no-store' })
      .then(res => { if (!cancelled) setApk(readApkAnswer(res)) })
      .catch(() => { /* no app file here: nothing to show */ })
    return () => { cancelled = true }
  }, [])

  if (!apk.available) return null

  return (
    <a
      href={APK_PATH}
      download
      className="mt-8 flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-left transition hover:border-brand-600"
    >
      <Smartphone className="h-6 w-6 shrink-0 text-brand-600" aria-hidden="true" />
      <span>
        <span className="block text-sm font-semibold text-ink">Get the Android app</span>
        <span className="block text-xs text-mute">Download the APK{apk.size ? ` (${apk.size})` : ''}, then open it on your phone to install.</span>
      </span>
    </a>
  )
}
