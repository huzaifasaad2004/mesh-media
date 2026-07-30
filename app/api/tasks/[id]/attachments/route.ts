import { NextRequest, NextResponse } from 'next/server'
import { requireTasksManage, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import {
  attachTaskImageUrls,
  detectTaskImageMime,
  extensionForTaskImage,
  MAX_TASK_ATTACHMENT_BYTES,
  MAX_TASK_ATTACHMENT_LABEL,
  MAX_TASK_ATTACHMENTS,
} from '@/lib/taskAttachments'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTasksManage()
  if ('res' in auth) return auth.res

  const db = serviceRole()
  const [{ data: task }, { count }] = await Promise.all([
    db.from('tasks').select('id, title').eq('id', params.id).maybeSingle(),
    db.from('task_attachments').select('id', { count: 'exact', head: true }).eq('task_id', params.id),
  ])
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  if ((count ?? 0) >= MAX_TASK_ATTACHMENTS) {
    return NextResponse.json({ error: `A task can have up to ${MAX_TASK_ATTACHMENTS} reference images` }, { status: 400 })
  }

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Choose an image' }, { status: 400 })
  }
  if (file.size > MAX_TASK_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: `Images must be ${MAX_TASK_ATTACHMENT_LABEL} or smaller` }, { status: 413 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const mime = detectTaskImageMime(buffer)
  if (!mime) return NextResponse.json({ error: 'Use a JPG, PNG, GIF, or WebP image' }, { status: 400 })

  const path = `${params.id}/${crypto.randomUUID()}.${extensionForTaskImage(mime)}`
  const { error: uploadError } = await db.storage
    .from('task-attachments')
    .upload(path, buffer, { contentType: mime, upsert: false })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

  const safeName = file.name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255) || `reference.${extensionForTaskImage(mime)}`
  const { data: attachment, error } = await db.from('task_attachments').insert({
    task_id: params.id,
    storage_path: path,
    file_name: safeName,
    mime_type: mime,
    file_size: file.size,
    uploaded_by: auth.user.id,
  }).select().single()

  if (error) {
    await db.storage.from('task-attachments').remove([path])
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await logActivity(auth.user, 'upload', 'task_attachment', attachment.id, task.title)
  const [withUrl] = await attachTaskImageUrls([{ attachments: [attachment] }])
  return NextResponse.json(withUrl.attachments?.[0], { status: 201 })
}
