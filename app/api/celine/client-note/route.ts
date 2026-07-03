// ── app/api/celine/client-note/route.ts (add to the m3m repo) ───────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { celineAuthorized } from '@/lib/celine/auth'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  if (!celineAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { client_id, content } = await req.json()
  if (!client_id || !content) return NextResponse.json({ error: 'client_id and content required' }, { status: 400 })
  const { data, error } = await admin().from('client_notes')
    .insert({ client_id, content: `[Celine] ${content}` })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, note_id: data.id })
}
