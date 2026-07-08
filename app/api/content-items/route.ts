import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, serviceRole, stripProtected } from '@/lib/apiAuth'
import { MANAGERS } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { notifyUsers } from '@/lib/notify'

// RLS-scoped: managers+ see everything; a member sees their own submissions
// plus items for clients they're assigned to.
export async function GET() {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  const { data, error } = await auth.db
    .from('content_items')
    .select('*, client:clients(company_name), project:projects(name), creator:profiles!content_items_created_by_fkey(full_name), manager:profiles!content_items_manager_id_fkey(full_name)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// Body: { client_id, project_id?, title, description?, file_url? }
export async function POST(req: NextRequest) {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  const body = stripProtected(await req.json())
  const { client_id, title } = body as { client_id?: string; title?: string }
  if (!client_id || !title) return NextResponse.json({ error: 'client_id and title are required' }, { status: 400 })

  // A member may only submit content for a client they're actually assigned
  // to — never leaves the "employees must never submit directly to a
  // client" requirement to the UI alone.
  if (!MANAGERS.includes(auth.role)) {
    const { data: allowed } = await auth.db.rpc('my_assigned_client_ids')
    const allowedIds = new Set((allowed ?? []).map((r: any) => r.my_assigned_client_ids ?? r))
    if (!allowedIds.has(client_id)) {
      return NextResponse.json({ error: 'You are not assigned to this client' }, { status: 403 })
    }
  }

  const db = serviceRole()
  const { data, error } = await db.from('content_items').insert({
    client_id,
    project_id: body.project_id || null,
    title,
    description: body.description || null,
    file_url: body.file_url || null,
    created_by: auth.user.id,
    status: 'pending_manager',
  }).select('*, client:clients(company_name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity(auth.user, 'create', 'content_item', data.id, `${title} · ${data.client?.company_name ?? ''}`)

  // Notify managers+ that something needs review — never the client at this stage.
  const { data: managers } = await db.from('profiles').select('id').in('role', ['owner', 'admin', 'manager'])
  if (managers?.length) {
    await notifyUsers(db, {
      userIds: managers.map(m => m.id),
      title: 'Content pending your review',
      body: `${title} · ${data.client?.company_name ?? ''}`,
      href: '/content',
      category: 'content_review',
    })
  }

  return NextResponse.json(data)
}
