import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, serviceRole } from '@/lib/apiAuth'
import { attachSignedUrls, canAccessChatChannel } from '@/lib/chat'

const ALLOWED = new Set(['image/jpeg','image/png','image/gif','image/webp','application/pdf','audio/webm','audio/mp4','audio/mpeg','audio/ogg','video/webm'])

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  if (!await canAccessChatChannel(auth.user.id, params.id)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const form = await req.formData()
  const file = form.get('file') as File | null
  const duration = Number(form.get('duration') ?? 0)
  if (!file || file.size === 0) return NextResponse.json({ error: 'Choose a file' }, { status: 400 })
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'Files must be 20MB or smaller' }, { status: 413 })
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: 'This file type is not supported' }, { status: 400 })
  const db = serviceRole()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
  const path = `${params.id}/${crypto.randomUUID()}-${safeName}`
  const { error: uploadError } = await db.storage.from('chat-attachments').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })
  const messageType = file.type.startsWith('audio/') ? 'voice' : file.type.startsWith('image/') ? 'image' : 'file'
  const { data, error } = await db.from('chat_messages').insert({
    channel_id: params.id, sender_id: auth.user.id, body: (form.get('body') as string || '').trim() || null,
    message_type: messageType, attachment_path: path, attachment_name: file.name.slice(0, 255),
    attachment_type: file.type, attachment_size: file.size,
    voice_duration_seconds: messageType === 'voice' && Number.isFinite(duration) ? Math.max(0, Math.round(duration)) : null,
    reply_to_id: (form.get('reply_to_id') as string) || null,
  }).select('*, sender:profiles!chat_messages_sender_id_fkey(id, full_name, email, avatar_url, role), reactions:chat_reactions(emoji, user_id)').single()
  if (error) { await db.storage.from('chat-attachments').remove([path]); return NextResponse.json({ error: error.message }, { status: 400 }) }
  await db.from('chat_channels').update({ updated_at: new Date().toISOString() }).eq('id', params.id)
  const [withUrl] = await attachSignedUrls([data])
  return NextResponse.json(withUrl, { status: 201 })
}
