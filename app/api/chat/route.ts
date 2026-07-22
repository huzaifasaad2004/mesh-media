import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, serviceRole } from '@/lib/apiAuth'

const STAFF = ['owner', 'admin', 'manager', 'member', 'viewer']

export async function GET() {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  const db = serviceRole()

  // Make the first visit useful without requiring a separate setup screen.
  const { count } = await db.from('chat_channels').select('id', { count: 'exact', head: true })
  if (count === 0) {
    const { data: general } = await db.from('chat_channels').insert({
      name: 'general', description: 'Company-wide announcements and conversation',
      kind: 'channel', is_private: false, created_by: auth.user.id,
    }).select('id').single()
    if (general) await db.from('chat_channel_members').insert({ channel_id: general.id, user_id: auth.user.id, role: 'owner' })
  }

  const [{ data: channels, error }, { data: people }] = await Promise.all([
    auth.db.from('chat_channels').select('*, members:chat_channel_members(user_id, role, last_read_at, profile:profiles(id, full_name, email, avatar_url, role))').order('updated_at', { ascending: false }),
    db.from('profiles').select('id, full_name, email, avatar_url, role').in('role', STAFF).order('full_name'),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const enriched = await Promise.all((channels ?? []).map(async (channel: any) => {
    const mine = channel.members?.find((m: any) => m.user_id === auth.user.id)
    const { count: unread } = await db.from('chat_messages').select('id', { count: 'exact', head: true })
      .eq('channel_id', channel.id).neq('sender_id', auth.user.id).gt('created_at', mine?.last_read_at ?? '1970-01-01')
    const { data: last } = await db.from('chat_messages').select('body, message_type, created_at').eq('channel_id', channel.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
    return { ...channel, unread_count: unread ?? 0, last_message: last }
  }))
  return NextResponse.json({ channels: enriched, people: people ?? [], me: auth.user.id })
}

export async function POST(req: NextRequest) {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  const body = await req.json()
  const kind = ['channel', 'group', 'direct'].includes(body.kind) ? body.kind : 'channel'
  const memberIds = Array.from(new Set<string>([auth.user.id, ...(Array.isArray(body.member_ids) ? body.member_ids : [])]))
  if (kind === 'direct' && memberIds.length !== 2) return NextResponse.json({ error: 'Choose one person for a direct message' }, { status: 400 })
  if (kind === 'channel' && !body.name?.trim()) return NextResponse.json({ error: 'Channel name is required' }, { status: 400 })

  const db = serviceRole()
  const { data: validMembers } = await db.from('profiles').select('id').in('id', memberIds).in('role', STAFF)
  if ((validMembers ?? []).length !== memberIds.length) {
    return NextResponse.json({ error: 'Every chat member must be an active staff user' }, { status: 400 })
  }
  if (kind === 'direct') {
    const { data: candidates } = await db.from('chat_channels').select('*, members:chat_channel_members(user_id)').eq('kind', 'direct')
    const existing = candidates?.find((c: any) => c.members?.length === 2 && memberIds.every((id) => c.members.some((m: any) => m.user_id === id)))
    if (existing) return NextResponse.json(existing)
  }

  const { data: channel, error } = await db.from('chat_channels').insert({
    name: kind === 'direct' ? null : body.name?.trim(), description: body.description?.trim() || null,
    kind, is_private: kind !== 'channel' || !!body.is_private, created_by: auth.user.id,
  }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const { error: memberError } = await db.from('chat_channel_members').insert(memberIds.map((userId) => ({
    channel_id: channel.id, user_id: userId, role: userId === auth.user.id ? 'owner' : 'member',
  })))
  if (memberError) { await db.from('chat_channels').delete().eq('id', channel.id); return NextResponse.json({ error: memberError.message }, { status: 400 }) }
  return NextResponse.json(channel, { status: 201 })
}
