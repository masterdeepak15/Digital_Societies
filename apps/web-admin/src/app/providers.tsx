'use client'

import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, useEffect } from 'react'
import { Toaster, toast } from 'sonner'
import { ApiError } from '@/lib/api'
import { fetchMe, isLoggedIn } from '@/lib/auth'
import { useSignalR } from '@/lib/useSignalR'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      // A failed load must be visible: without this a 403/500 just renders an empty page.
      queryCache: new QueryCache({
        onError: (error, query) => {
          const status = error instanceof ApiError ? error.status : undefined
          if (status === 401) return // the session-expiry flow redirects to /login
          const message = status === 403
            ? "You don't have access to this section with your role."
            : error instanceof Error && error.message ? `Could not load data: ${error.message}` : 'Could not load data.'
          toast.error(message, { id: JSON.stringify(query.queryKey) })
        },
      }),
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
