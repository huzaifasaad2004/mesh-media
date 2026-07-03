import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function getUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const b = await req.json()
  const patch: Record<string, unknown> = {}
  if (b.minutes !== undefined) patch.minutes = Math.max(0, Math.round(Number(b.minutes) || 0))
  if (b.description !== undefined) patch.description = b.description || null
  if (b.billable !== undefined) patch.billable = b.billable
  const { data, error } = await admin().from('time_entries')
    .update(patch).eq('id', params.id).eq('user_id', user.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { error } = await admin().from('time_entries').delete().eq('id', params.id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
