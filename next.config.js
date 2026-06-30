/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  // Supabase uses Node.js APIs — exclude from edge bundling
  serverExternalPackages: ['@supabase/supabase-js'],
}

module.exports = nextConfig
