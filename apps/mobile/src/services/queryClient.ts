import { QueryClient } from '@tanstack/react-query';

/** One shared client so a sign-out or server change can drop every cached answer. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});
