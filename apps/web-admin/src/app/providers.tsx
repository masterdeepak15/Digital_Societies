'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, useEffect } from 'react'
import { Toaster } from 'sonner'
import { fetchMe, isLoggedIn } from '@/lib/auth'
import { useSignalR } from '@/lib/useSignalR'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime:          60 * 1000,
          retry:              1,
          refetchOnWindowFocus: false,
        },
      },
    }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AppInit />
      {children}
      <Toaster position="top-right" richColors closeButton />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

/**
 * Inner component so hooks run inside QueryClientProvider context.
 * Handles:
 *  1. Sync user profile on boot via GET /auth/me
 *  2. Connect to SignalR hub for live updates
 */
function AppInit() {
  // On boot — sync the user profile from GET /auth/me so local cache stays fresh
  // even after a token refresh between sessions.
  useEffect(() => {
    if (isLoggedIn()) fetchMe()
  }, [])

  // Connect to SignalR for live visitor / complaint / notice events.
  useSignalR()

  return null
}
