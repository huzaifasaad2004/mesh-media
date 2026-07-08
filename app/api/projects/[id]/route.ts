import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireRoles, serviceRole, stripProtected, OPS_WRITE, MANAGERS } from '@/lib/apiAuth'
import { isAdmin } from '@/lib/roles'
import { hasPermission } from '@/lib/permissions'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const db = auth.db // RLS-scoped: each sub-list is filtered per the caller's role

  // Belt-and-suspenders on top of RLS: never send invoice data to a caller
  // without finance.read, even from a project side door (BUILD_PLAN.md §D #9).
  const canSeeFinance = isAdmin(auth.role) || await hasPermission(serviceRole(), auth.user.id, auth.role, 'finance.read')

  const [{ data: project, error }, { data: tasks }, { data: invoices }, { data: files }, { data: milestones }] =
    await Promise.all([
      db.from('projects').select('*, client:clients(id, company_name, email)').eq('id', params.id).single(),
      db.from('tasks').select('*, assignee:profiles!tasks_assigned_to_fkey(full_name)').eq('project_id', params.id).order('created_at', { ascending: false }),
      canSeeFinance
        ? db.from('invoices').select('id, invoice_number, total, status, issue_date').eq('project_id', params.id).order('issue_date', { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      db.from('files').select('*').eq('project_id', params.id).order('created_at', { ascending: false }),
      db.from('milestones').select('*').eq('project_id', params.id).order('sort_order').order('due_date'),
    ])
  if (error || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  return NextResponse.json({ ...project, tasks, invoices, files, milestones })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(OPS_WRITE)
  if ('res' in auth) return auth.res
  const body = stripProtected(await req.json())
  const { data, error } = await serviceRole().from('projects').update(body).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(MANAGERS)
  if ('res' in auth) return auth.res
  const { error } = await serviceRole().from('projects').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
