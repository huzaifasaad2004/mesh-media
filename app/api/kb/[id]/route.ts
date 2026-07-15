import { NextRequest, NextResponse } from 'next/server'
import { requireKbRead, requireKbWrite, serviceRole, stripProtected } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireKbRead()
  if ('res' in auth) return auth.res
  const { data, error } = await auth.db
    .from('kb_articles')
    .select('*, creator:profiles!kb_articles_created_by_fkey(full_name), updater:profiles!kb_articles_updated_by_fkey(full_name)')
    .eq('id', params.id)
    .single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

// Body: { title?, category?, content?, status? }
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireKbWrite()
  if ('res' in auth) return auth.res
  const body = stripProtected(await req.json())

  const patch: Record<string, unknown> = { updated_by: auth.user.id }
  if (typeof body.title === 'string') {
    if (!body.title.trim()) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    patch.title = body.title.trim()
  }
  if (typeof body.category === 'string') patch.category = body.category.trim() || 'General'
  if (typeof body.content === 'string') patch.content = body.content
  if (body.status === 'draft' || body.status === 'published') patch.status = body.status

  const db = serviceRole()
  const { data, error } = await db.from('kb_articles').update(patch).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity(auth.user, 'update', 'kb_article', params.id, data.title)
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireKbWrite()
  if ('res' in auth) return auth.res
  const db = serviceRole()
  const { data: existing } = await db.from('kb_articles').select('title').eq('id', params.id).single()
  const { error } = await db.from('kb_articles').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'delete', 'kb_article', params.id, existing?.title)
  return NextResponse.json({ success: true })
}
