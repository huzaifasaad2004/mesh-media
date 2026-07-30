import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, requireTasksManage, serviceRole, stripProtected } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { notifyUsers } from '@/lib/notify'
import { attachTaskImageUrls } from '@/lib/taskAttachments'

export async function GET() {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  const { data, error } = await auth.db
    .from('tasks')
    .select('*, assignee:profiles!tasks_assigned_to_fkey(full_name, avatar_url, email), client:clients(company_name), attachments:task_attachments(id, task_id, storage_path, file_name, mime_type, file_size, uploaded_by, created_at)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(await attachTaskImageUrls(data ?? []))
}

export async function POST(req: NextRequest) {
  // Only holders of tasks.manage (managers+ by default, editable in the
  // permissions matrix) can create/assign tasks — members can update status
  // on tasks already assigned to them (see PUT), not create or assign new ones.
  const auth = await requireTasksManage()
  if ('res' in auth) return auth.res
  const body = stripProtected(await req.json())
  const db = serviceRole()
  const { data, error } = await db.from('tasks').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'create', 'task', data.id, data.title)

  if (data.assigned_to && data.assigned_to !== auth.user.id) {
    await notifyUsers(db, {
      userIds: [data.assigned_to],
      title: 'New task assigned to you',
      body: data.title,
      href: '/tasks',
      category: 'task_assignment',
      entityType: 'task', entityId: data.id, actions: ['complete', 'reply'],
    })
  }

  return NextResponse.json(data)
}
