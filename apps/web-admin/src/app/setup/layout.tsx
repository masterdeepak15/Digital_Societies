import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import type { ReactNode } from 'react'

// Whether the society exists is decided on every request, never cached.
export const dynamic = 'force-dynamic'

/** Asks the server if first-run setup has been done. Anything unclear counts as done, so the page stays closed. */
async function setupIsDone(): Promise<boolean> {
  const base = (process.env.API_URL ?? 'http://localhost:5000').replace(/\/+$/, '')
  try {
    const res = await fetch(`${base}/api/v1/setup/status`, { cache: 'no-store' })
    if (!res.ok) return true
    const body = (await res.json()) as { configured?: boolean }
    return body.configured !== false
  } catch {
    return true
  }
}

/** First-run setup is only for an installation with no society. Once one exists this page never shows again;
 *  everything it set up is changed later from Settings. */
export default async function SetupLayout({ children }: { children: ReactNode }) {
  if (await setupIsDone()) redirect(cookies().get('ds_token')?.value ? '/dashboard' : '/login')
  return <>{children}</>
}
