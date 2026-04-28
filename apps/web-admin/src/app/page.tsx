import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

/**
 * Root page: redirect based on auth state.
 * Server component — reads cookie server-side for instant redirect.
 */
export default function RootPage() {
  const token = cookies().get('ds_token')?.value
  if (!token) redirect('/login')
  redirect('/dashboard')
}
