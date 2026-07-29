import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireTasksManage, serviceRole, stripProtected } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { notifyUsers } from '@/lib/notify'
import { emitAutomationEvent } from '@/lib/automations/engine'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const managesAuth = await requireTasksManage()
  const isManager = !('res' in managesAuth)
  if (!isManager && auth.role !== 'member') {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  let body = stripProtected(await req.json())
  const db = serviceRole()
  const { data: before } = await db.from('tasks').select('assigned_to, created_by, status, title').eq('id', params.id).single()

  if (!isManager) {
    // A member may only update the status of a task already assigned to
    // them — not reassign it, retitle it, or touch any other field.
    if (!before || before.assigned_to !== auth.user.id) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }
    body = 'status' in body ? { status: body.status } : {}
    if (!body.status) return NextResponse.json({ error: 'Members may only update task status' }, { status: 403 })
  }

  const { data, error } = await db.from('tasks').update(body).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'update', 'task', params.id, data.title)

  if (data.assigned_to && data.assigned_to !== before?.assigned_to && data.assigned_to !== auth.user.id) {
    await notifyUsers(db, {
      userIds: [data.assigned_to],
      title: 'Task assigned to you',
      body: data.title,
      href: '/tasks',
      category: 'task_assignment',
      entityType: 'task', entityId: data.id, actions: ['complete', 'reply'],
    })
  }

  // Closing the loop: tell whoever created the task once it's marked done
  // (skip if they did it themselves, or if it was already done — status
  // toggled back and forth shouldn't re-notify every time).
  if (data.status === 'done' && before?.status !== 'done') {
    await db.from('notifications').update({
      available_actions: [], action_completed_at: new Date().toISOString(), action_completed_by: auth.user.id,
    }).eq('entity_type', 'task').eq('entity_id', data.id)
  }
  if (data.status === 'done' && before?.status !== 'done' && data.created_by && data.created_by !== auth.user.id) {
    await notifyUsers(db, {
      userIds: [data.created_by],
      title: 'Task marked done',
      body: data.title,
      href: '/tasks',
      category: 'task_feedback',
    })
  }
  if (data.status === 'done' && before?.status !== 'done') {
    await emitAutomationEvent('task_completed', {
      eventKey: data.id, actorId: auth.user.id, entityId: data.id, entityType: 'task', clientId: data.client_id, projectId: data.project_id,
      values: { task_title: data.title, status: data.status, priority: data.priority, assigned_to: data.assigned_to },
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  // Only holders of tasks.manage can delete tasks — members lose delete entirely.
  const auth = await requireTasksManage()
  if ('res' in auth) return auth.res
  const { data: existing } = await serviceRole().from('tasks').select('title').eq('id', params.id).single()
  const { error } = await serviceRole().from('tasks').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'delete', 'task', params.id, existing?.title)
  return NextResponse.json({ success: true })
}
