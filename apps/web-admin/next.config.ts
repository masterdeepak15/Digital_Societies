import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'https', hostname: '*.digitalsocieties.app' },
    ],
  },
  async rewrites() {
    // Proxy /api/* to the backend in development so we avoid CORS issues
    const apiBase = process.env.API_URL ?? 'http://localhost:5000'
    return [
      { source: '/api/:path*', destination: `${apiBase}/api/:path*` },
    ]
  },
}

export default nextConfig
