import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireTasksManage, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { notifyUsers, type NotificationAction } from '@/lib/notify'

const allowed = new Set<NotificationAction>(['approve', 'reject', 'complete', 'reply'])

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const body = await req.json().catch(() => ({}))
  const action = body.action as NotificationAction
  if (!allowed.has(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  const db = serviceRole()
  const { data: notification } = await db.from('notifications')
    .select('*').eq('id', params.id).eq('user_id', auth.user.id).single()
  if (!notification) return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
  if (!(notification.available_actions ?? []).includes(action)) {
    return NextResponse.json({ error: 'This action is no longer available' }, { status: 409 })
  }

  if (notification.entity_type === 'approval' && (action === 'approve' || action === 'reject')) {
    if (!['owner', 'admin', 'manager'].includes(auth.role ?? '')) {
      return NextResponse.json({ error: 'Only managers can decide approvals' }, { status: 403 })
    }
    const status = action === 'approve' ? 'approved' : 'rejected'
    const { data, error } = await db.from('approvals').update({
      status, decided_by: auth.user.id, decided_at: new Date().toISOString(),
    }).eq('id', notification.entity_id).eq('status', 'pending').select().single()
    if (error || !data) return NextResponse.json({ error: 'This approval was already decided' }, { status: 409 })
    await db.from('notifications').update({
      read: true, available_actions: [], action_completed_at: new Date().toISOString(), action_completed_by: auth.user.id,
    }).eq('entity_type', 'approval').eq('entity_id', notification.entity_id)
    await notifyUsers(db, {
      userIds: [data.requester], title: `Request ${status}: ${data.title}`,
      body: `Your ${data.type.replace('_', ' ')} request was ${status}.`, href: '/approvals', category: 'approval_request',
    })
    return NextResponse.json({ success: true, message: `Request ${status}` })
  }

  if (notification.entity_type === 'task') {
    const { data: task } = await db.from('tasks').select('id, title, assigned_to, created_by, status').eq('id', notification.entity_id).single()
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    const manages = await requireTasksManage()
    const isManager = !('res' in manages)
    if (!isManager && (auth.role !== 'member' || task.assigned_to !== auth.user.id)) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    if (action === 'complete') {
      if (task.status === 'done') return NextResponse.json({ error: 'Task is already complete' }, { status: 409 })
      const { data: completed, error: updateError } = await db.from('tasks').update({ status: 'done' })
        .eq('id', task.id).neq('status', 'done').select('id').maybeSingle()
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })
      if (!completed) return NextResponse.json({ error: 'Task is already complete' }, { status: 409 })
      await db.from('notifications').update({
        read: true, available_actions: [], action_completed_at: new Date().toISOString(), action_completed_by: auth.user.id,
      }).eq('entity_type', 'task').eq('entity_id', task.id)
      await logActivity(auth.user, 'update', 'task', task.id, `${task.title} · done`)
      if (task.created_by && task.created_by !== auth.user.id) await notifyUsers(db, {
        userIds: [task.created_by], title: 'Task marked done', body: task.title, href: '/tasks', category: 'task_feedback',
      })
      return NextResponse.json({ success: true, message: 'Task marked complete' })
    }

    if (action === 'reply') {
      const reply = typeof body.reply === 'string' ? body.reply.trim() : ''
      if (!reply || reply.length > 2000) return NextResponse.json({ error: 'Reply must be between 1 and 2,000 characters' }, { status: 400 })
      const { error } = await db.from('task_comments').insert({ task_id: task.id, author_id: auth.user.id, comment: reply })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      const recipients = Array.from(new Set([task.assigned_to, task.created_by].filter(Boolean)))
        .filter(id => id !== auth.user.id) as string[]
      await db.from('notifications').update({ read: true }).eq('id', notification.id)
      if (recipients.length) await notifyUsers(db, {
        userIds: recipients, title: 'New feedback on a task', body: `Reply on "${task.title}": ${reply}`,
        href: '/tasks', category: 'task_feedback', entityType: 'task', entityId: task.id, actions: ['reply'],
      })
      return NextResponse.json({ success: true, message: 'Reply sent' })
    }
  }

  return NextResponse.json({ error: 'Action does not match this notification' }, { status: 400 })
}
