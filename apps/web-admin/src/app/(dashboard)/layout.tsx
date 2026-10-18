import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get('ds_token')?.value
  if (!token) redirect('/login')

  return <AppShell>{children}</AppShell>
}
