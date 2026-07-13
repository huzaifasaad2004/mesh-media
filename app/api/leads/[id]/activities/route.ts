import { NextRequest, NextResponse } from 'next/server'
import { requireLeadsRead, requireLeadsWrite, serviceRole } from '@/lib/apiAuth'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireLeadsRead()
  if ('res' in auth) return auth.res

  const { data, error } = await serviceRole()
    .from('lead_activities')
    .select('id, type, note, created_at, author:profiles!lead_activities_created_by_fkey(full_name)')
    .eq('lead_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// Body: { type: 'note'|'call'|'meeting'|'email'|'whatsapp', note }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireLeadsWrite()
  if ('res' in auth) return auth.res

  const b = await req.json()
  const type = ['note', 'call', 'meeting', 'email', 'whatsapp'].includes(b.type) ? b.type : 'note'
  if (!b.note?.trim()) return NextResponse.json({ error: 'A note is required' }, { status: 400 })

  const { data, error } = await serviceRole().from('lead_activities').insert({
    lead_id: params.id, type, note: b.note.trim(), created_by: auth.user.id,
  }).select('id, type, note, created_at, author:profiles!lead_activities_created_by_fkey(full_name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
