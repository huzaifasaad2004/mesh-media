import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, serviceRole } from '@/lib/apiAuth'
import { attachSignedUrls, canAccessChatChannel } from '@/lib/chat'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  if (!await canAccessChatChannel(auth.user.id, params.id)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const before = req.nextUrl.searchParams.get('before')
  let query = serviceRole().from('chat_messages')
    .select('*, sender:profiles!chat_messages_sender_id_fkey(id, full_name, email, avatar_url, role), reactions:chat_reactions(emoji, user_id), receipts:chat_message_receipts(user_id, delivered_at, read_at), mentions:chat_mentions(user_id)')
    .eq('channel_id', params.id).order('created_at', { ascending: false }).limit(60)
  if (before) query = query.lt('created_at', before)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const db = serviceRole()
  const deliveredAt = new Date().toISOString()
  if (data?.length) {
    await db.from('chat_message_receipts').update({ delivered_at: deliveredAt })
      .eq('user_id', auth.user.id).in('message_id', data.map((message) => message.id)).is('delivered_at', null)
  }
  const rows = (data ?? []).reverse().map((message: any) => ({
    ...message,
    receipts: (message.receipts ?? []).map((receipt: any) => receipt.user_id === auth.user.id && !receipt.delivered_at
      ? { ...receipt, delivered_at: deliveredAt }
      : receipt),
  }))
  const replyIds = Array.from(new Set(rows.map((message: any) => message.reply_to_id).filter(Boolean))) as string[]
  const { data: replies } = replyIds.length
    ? await serviceRole().from('chat_messages').select('id, body, sender_id').in('id', replyIds)
    : { data: [] }
  const replyById = new Map((replies ?? []).map((reply: any) => [reply.id, reply]))
  const replySenderIds = Array.from(new Set((replies ?? []).map((reply: any) => reply.sender_id).filter(Boolean))) as string[]
  const { data: replySenders } = replySenderIds.length
    ? await serviceRole().from('profiles').select('id, full_name').in('id', replySenderIds)
    : { data: [] }
  const names = new Map((replySenders ?? []).map((profile: any) => [profile.id, profile.full_name]))
  const messages = await attachSignedUrls(rows.map((message: any) => ({
    ...message,
    reply: message.reply_to_id && replyById.get(message.reply_to_id)
      ? { ...replyById.get(message.reply_to_id), sender: { full_name: names.get((replyById.get(message.reply_to_id) as any).sender_id) ?? 'Team member' } }
      : null,
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
    .select('*, sender:profiles!chat_messages_sender_id_fkey(id, full_name, email, avatar_url, role), reactions:chat_reactions(emoji, user_id)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const { data: channel } = await db.from('chat_channels').select('kind, is_private').eq('id', params.id).single()
  const { data: recipients } = channel?.kind === 'channel' && !channel.is_private
    ? await db.from('profiles').select('id').in('role', ['owner', 'admin', 'manager', 'member', 'viewer']).neq('id', auth.user.id)
    : await db.from('chat_channel_members').select('user_id').eq('channel_id', params.id).neq('user_id', auth.user.id)
  const recipientIds = (recipients ?? []).map((recipient: any) => recipient.id ?? recipient.user_id) as string[]
  const requestedMentions = Array.isArray(body.mention_user_ids) ? body.mention_user_ids.filter((id: unknown): id is string => typeof id === 'string') : []
  const validRequestedIds = Array.from(new Set<string>(requestedMentions.filter((id: string) => recipientIds.includes(id))))
  const { data: mentionedPeople } = validRequestedIds.length
    ? await db.from('profiles').select('id, full_name, email').in('id', validRequestedIds)
    : { data: [] }
  const mentionIds = (mentionedPeople ?? []).filter((person) => {
    const label = person.full_name || person.email
    return !!label && text.toLocaleLowerCase().includes(`@${label.toLocaleLowerCase()}`)
  }).map((person) => person.id)
  await Promise.all([
    recipientIds.length ? db.from('chat_message_receipts').insert(recipientIds.map((userId) => ({ message_id: data.id, user_id: userId }))) : Promise.resolve(),
    mentionIds.length ? db.from('chat_mentions').insert(mentionIds.map((userId) => ({ message_id: data.id, user_id: userId }))) : Promise.resolve(),
  ])
  await Promise.all([
    db.from('chat_channels').update({ updated_at: new Date().toISOString() }).eq('id', params.id),
    db.from('chat_channel_members').upsert({ channel_id: params.id, user_id: auth.user.id, last_read_at: new Date().toISOString() }, { onConflict: 'channel_id,user_id' }),
  ])
  return NextResponse.json(data, { status: 201 })
}
