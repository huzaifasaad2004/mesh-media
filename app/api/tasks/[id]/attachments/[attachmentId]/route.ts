import { NextRequest, NextResponse } from 'next/server'
import { requireTasksManage, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; attachmentId: string } },
) {
  const auth = await requireTasksManage()
  if ('res' in auth) return auth.res

  const db = serviceRole()
  const { data: attachment } = await db.from('task_attachments')
    .select('id, storage_path, file_name')
    .eq('id', params.attachmentId)
    .eq('task_id', params.id)
    .maybeSingle()
  if (!attachment) return NextResponse.json({ error: 'Image not found' }, { status: 404 })

  const { error } = await db.from('task_attachments').delete().eq('id', attachment.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await db.storage.from('task-attachments').remove([attachment.storage_path])
  await logActivity(auth.user, 'delete', 'task_attachment', attachment.id, attachment.file_name)
  return NextResponse.json({ success: true })
}
