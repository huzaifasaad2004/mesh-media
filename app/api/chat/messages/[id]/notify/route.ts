import { NextResponse } from 'next/server'
import { requireStaff, serviceRole } from '@/lib/apiAuth'
import { canAccessChatChannel } from '@/lib/chat'
import { notifyUsers } from '@/lib/notify'
import { sendBrowserPush } from '@/lib/push'

const STAFF = ['owner', 'admin', 'manager', 'member', 'viewer']

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  const db = serviceRole()
  const { data: message } = await db.from('chat_messages')
    .select('id, channel_id, sender_id, body, message_type, attachment_name, channel:chat_channels(name, kind, is_private), sender:profiles!chat_messages_sender_id_fkey(full_name, email), mentions:chat_mentions(user_id)')
    .eq('id', params.id).maybeSingle()
  if (!message || message.sender_id !== auth.user.id || !await canAccessChatChannel(auth.user.id, message.channel_id)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const channel = Array.isArray(message.channel) ? message.channel[0] : message.channel
  const sender = Array.isArray(message.sender) ? message.sender[0] : message.sender
  const { data: members } = channel?.kind === 'channel' && !channel?.is_private
    ? await db.from('profiles').select('id').in('role', STAFF).neq('id', auth.user.id)
    : await db.from('chat_channel_members').select('user_id').eq('channel_id', message.channel_id).neq('user_id', auth.user.id)
  const userIds = (members ?? []).map((member: any) => member.id ?? member.user_id)
  const preview = message.body || (message.message_type === 'voice' ? 'Sent a voice note' : message.message_type === 'image' ? 'Sent an image' : `Sent ${message.attachment_name || 'a file'}`)
  const mentionIds = (message.mentions ?? []).map((mention: any) => mention.user_id) as string[]
  const pushBase = { body: String(preview).slice(0, 240), href: `/chat?channel=${message.channel_id}`, tag: `mesh-chat-${message.channel_id}` }
  await Promise.all([notifyUsers(db, {
    userIds,
    title: `New message from ${sender?.full_name || sender?.email || 'a teammate'}`,
    body: String(preview).slice(0, 240),
    href: `/chat?channel=${message.channel_id}`,
    category: 'chat',
  }), sendBrowserPush(mentionIds, {
    ...pushBase,
    title: `${sender?.full_name || sender?.email || 'A teammate'} mentioned you`,
  }), sendBrowserPush(userIds.filter((id) => !mentionIds.includes(id)), {
    ...pushBase,
    title: channel?.name ? `#${channel.name}` : sender?.full_name || 'Mesh Chat',
  })])
  return NextResponse.json({ ok: true })
}
