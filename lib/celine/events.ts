// ── lib/celine/events.ts (add to the m3m repo) ──────────────────────
// Dual-path event delivery to Celine:
//  1. write to celine_events_outbox (Celine polls it — guaranteed delivery)
//  2. fire-and-forget HMAC-signed POST to Celine's /hooks/m3m (instant)
// Env needed on Vercel: CELINE_WEBHOOK_URL, CELINE_WEBHOOK_SECRET
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export type CelinePortal = 'admin' | 'team' | 'client'

export async function emitCelineEvent(
  type: string,
  portal: CelinePortal,
  payload: Record<string, unknown>,
): Promise<void> {
  // 1. outbox (pull path) — never throw into the caller's request
  try {
    await admin().from('celine_events_outbox').insert({ type, portal, payload })
  } catch { /* outbox table not installed yet — push path may still work */ }

  // 2. push path (instant)
  const url = process.env.CELINE_WEBHOOK_URL
  const secret = process.env.CELINE_WEBHOOK_SECRET
  if (!url || !secret) return
  try {
    const body = JSON.stringify({ type, portal, payload })
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex')
    await fetch(`${url.replace(/\/$/, '')}/hooks/m3m`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-celine-signature': signature },
      body,
      signal: AbortSignal.timeout(4000),
    })
  } catch { /* Celine offline — she'll pick it up from the outbox */ }
}
