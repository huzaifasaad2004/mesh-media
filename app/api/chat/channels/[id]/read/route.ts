import { NextResponse } from 'next/server'
import { requireStaff, serviceRole } from '@/lib/apiAuth'
import { canAccessChatChannel } from '@/lib/chat'

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  if (!await canAccessChatChannel(auth.user.id, params.id)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const { error } = await serviceRole().from('chat_channel_members').upsert({ channel_id: params.id, user_id: auth.user.id, last_read_at: new Date().toISOString() }, { onConflict: 'channel_id,user_id' })
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true })
}
