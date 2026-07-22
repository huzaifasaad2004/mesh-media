import { NextResponse } from 'next/server'
import { requireStaff, serviceRole } from '@/lib/apiAuth'
import { canAccessChatChannel } from '@/lib/chat'

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  if (!await canAccessChatChannel(auth.user.id, params.id)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const db = serviceRole()
  const readAt = new Date().toISOString()
  const { data: messages } = await db.from('chat_messages').select('id').eq('channel_id', params.id).neq('sender_id', auth.user.id)
  const [{ error }, { error: receiptError }] = await Promise.all([
    db.from('chat_channel_members').upsert({ channel_id: params.id, user_id: auth.user.id, last_read_at: readAt }, { onConflict: 'channel_id,user_id' }),
    messages?.length
      ? db.from('chat_message_receipts').update({ delivered_at: readAt, read_at: readAt }).eq('user_id', auth.user.id).in('message_id', messages.map((message) => message.id)).is('read_at', null)
      : Promise.resolve({ error: null }),
  ])
  const updateError = error || receiptError
  return updateError ? NextResponse.json({ error: updateError.message }, { status: 400 }) : NextResponse.json({ ok: true })
}
