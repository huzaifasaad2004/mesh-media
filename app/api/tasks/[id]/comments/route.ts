import { NextRequest, NextResponse } from 'next/server'
import { requireUser, serviceRole } from '@/lib/apiAuth'
import { notifyUsers } from '@/lib/notify'

// RLS-scoped: managers+/viewer see all comments, a member only sees
// comments on tasks assigned to them (same scoping as the tasks table).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const { data, error } = await auth.db
    .from('task_comments')
    .select('*, author:profiles(full_name, avatar_url)')
    .eq('task_id', params.id)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// Body: { comment }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const { comment } = await req.json()
  if (!comment?.trim()) return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 })

  const db = serviceRole()
  const { data: task } = await db.from('tasks').select('id, title, assigned_to, created_by').eq('id', params.id).single()
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  // A member may only comment on a task actually assigned to them —
  // managers+ can comment on anything, mirroring RLS.
  if (auth.role === 'member' && task.assigned_to !== auth.user.id) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const { data, error } = await db.from('task_comments').insert({
    task_id: params.id, author_id: auth.user.id, comment: comment.trim(),
  }).select('*, author:profiles(full_name, avatar_url)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Notify whoever else is party to this task — the assignee and whoever
  // created it — excluding the person who just wrote the comment.
  const recipients = Array.from(new Set([task.assigned_to, task.created_by].filter(Boolean)))
    .filter((id) => id !== auth.user.id) as string[]
  if (recipients.length) {
    await notifyUsers(db, {
      userIds: recipients,
      title: 'New feedback on a task',
      body: `${data.author?.full_name ?? 'Someone'} on "${task.title}": ${comment.trim()}`,
      href: '/tasks',
      category: 'task_feedback',
      entityType: 'task', entityId: task.id, actions: ['reply'],
    })
  }

  return NextResponse.json(data)
}
