/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Voice notes in Mesh Chat need microphone access. Keep it same-origin only;
  // location and camera remain fully disabled.
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(self), camera=()' },
  // Report-Only first (per the audit): watch the console for violations,
  // then rename to Content-Security-Policy to enforce once clean.
  {
    key: 'Content-Security-Policy-Report-Only',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig = {
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  // Supabase uses Node.js APIs — exclude from server-component bundling on Next 14.
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

module.exports = nextConfig
