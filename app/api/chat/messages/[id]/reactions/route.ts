import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, serviceRole } from '@/lib/apiAuth'
import { canAccessChatChannel } from '@/lib/chat'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  const emoji = String((await req.json()).emoji ?? '').slice(0, 16)
  const db = serviceRole()
  const { data: message } = await db.from('chat_messages').select('channel_id').eq('id', params.id).maybeSingle()
  if (!message || !emoji || !await canAccessChatChannel(auth.user.id, message.channel_id)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const { data: existing } = await db.from('chat_reactions').select('message_id').eq('message_id', params.id).eq('user_id', auth.user.id).eq('emoji', emoji).maybeSingle()
  const result = existing
    ? await db.from('chat_reactions').delete().eq('message_id', params.id).eq('user_id', auth.user.id).eq('emoji', emoji)
    : await db.from('chat_reactions').insert({ message_id: params.id, user_id: auth.user.id, emoji })
  return result.error ? NextResponse.json({ error: result.error.message }, { status: 400 }) : NextResponse.json({ active: !existing })
}
