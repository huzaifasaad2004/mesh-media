import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, serviceRole } from '@/lib/apiAuth'
import { attachSignedUrls, canAccessChatChannel } from '@/lib/chat'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  if (!await canAccessChatChannel(auth.user.id, params.id)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const before = req.nextUrl.searchParams.get('before')
  let query = serviceRole().from('chat_messages')
    .select('*, sender:profiles!chat_messages_sender_id_fkey(id, full_name, email, avatar_url, role), reply:chat_messages!chat_messages_reply_to_id_fkey(id, body, sender_id), reactions:chat_reactions(emoji, user_id)')
    .eq('channel_id', params.id).order('created_at', { ascending: false }).limit(60)
  if (before) query = query.lt('created_at', before)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const rows = (data ?? []).reverse()
  const replySenderIds = Array.from(new Set(rows.map((message: any) => message.reply?.sender_id).filter(Boolean))) as string[]
  const { data: replySenders } = replySenderIds.length
    ? await serviceRole().from('profiles').select('id, full_name').in('id', replySenderIds)
    : { data: [] }
  const names = new Map((replySenders ?? []).map((profile: any) => [profile.id, profile.full_name]))
  const messages = await attachSignedUrls(rows.map((message: any) => ({
    ...message,
    reply: message.reply ? { ...message.reply, sender: { full_name: names.get(message.reply.sender_id) ?? 'Team member' } } : null,
  })))
  return NextResponse.json(messages)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  if (!await canAccessChatChannel(auth.user.id, params.id)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const body = await req.json()
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 10000) : ''
  if (!text) return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
  const db = serviceRole()
  const { data, error } = await db.from('chat_messages').insert({ channel_id: params.id, sender_id: auth.user.id, body: text, reply_to_id: body.reply_to_id || null })
    .select('*, sender:profiles!chat_messages_sender_id_fkey(id, full_name, email, avatar_url, role), reply:chat_messages!chat_messages_reply_to_id_fkey(id, body, sender_id), reactions:chat_reactions(emoji, user_id)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await Promise.all([
    db.from('chat_channels').update({ updated_at: new Date().toISOString() }).eq('id', params.id),
    db.from('chat_channel_members').upsert({ channel_id: params.id, user_id: auth.user.id, last_read_at: new Date().toISOString() }, { onConflict: 'channel_id,user_id' }),
  ])
  return NextResponse.json(data, { status: 201 })
}
