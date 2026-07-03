// ── lib/celine/auth.ts (add to the m3m repo) ────────────────────────
// Bearer-token guard for the Celine action endpoints.
// Env needed on Vercel: CELINE_API_TOKEN (same value as Celine's M3M_API_TOKEN)
import { NextRequest } from 'next/server'
import crypto from 'crypto'

export function celineAuthorized(req: NextRequest): boolean {
  const token = process.env.CELINE_API_TOKEN
  if (!token) return false
  const header = req.headers.get('authorization') ?? ''
  const provided = header.replace(/^Bearer\s+/i, '')
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(token)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
