// ── app/api/celine/client-create/route.ts ──────────────────────────
// Lets Celine create a new client record from a chat/voice instruction.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { celineAuthorized } from '@/lib/celine/auth'
import { emitCelineEvent } from '@/lib/celine/events'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const STATUSES = ['lead', 'onboarding', 'active', 'paused', 'churned']

export async function POST(req: NextRequest) {
  if (!celineAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const b = await req.json()
  if (!b.company_name) return NextResponse.json({ error: 'company_name required' }, { status: 400 })

  // Guard against duplicates — if a same-named client exists, return it instead of forking.
  const { data: existing } = await admin().from('clients')
    .select('id, company_name').ilike('company_name', b.company_name).limit(1)
  if (existing?.[0]) {
    return NextResponse.json({ ok: true, client_id: existing[0].id, already_existed: true, company_name: existing[0].company_name })
  }

  const { data, error } = await admin().from('clients').insert({
    company_name: b.company_name,
    industry: b.industry ?? null,
    status: STATUSES.includes(b.status) ? b.status : 'lead',
    email: b.email ?? null,
    phone: b.phone ?? null,
    contact_person: b.contact_person ?? null,
    notes: b.notes ? `${b.notes}\n\n— added by Celine` : '— added by Celine',
    monthly_retainer: b.monthly_retainer ?? null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await emitCelineEvent('client_created', 'admin', { client_id: data.id, company_name: data.company_name })
  return NextResponse.json({ ok: true, client_id: data.id, company_name: data.company_name })
}
