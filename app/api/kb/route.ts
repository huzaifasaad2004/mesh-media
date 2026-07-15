import { NextRequest, NextResponse } from 'next/server'
import { requireKbRead, requireKbWrite, serviceRole, stripProtected } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

// RLS-scoped: anyone with kb.read sees published articles; an author (or
// manager+) also sees their own drafts.
export async function GET() {
  const auth = await requireKbRead()
  if ('res' in auth) return auth.res
  const { data, error } = await auth.db
    .from('kb_articles')
    .select('*, creator:profiles!kb_articles_created_by_fkey(full_name), updater:profiles!kb_articles_updated_by_fkey(full_name)')
    .order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// Body: { title, category?, content?, status? }
export async function POST(req: NextRequest) {
  const auth = await requireKbWrite()
  if ('res' in auth) return auth.res
  const body = stripProtected(await req.json())
  const { title } = body as { title?: string }
  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const db = serviceRole()
  const { data, error } = await db.from('kb_articles').insert({
    title: title.trim(),
    category: body.category?.trim() || 'General',
    content: body.content || '',
    status: body.status === 'published' ? 'published' : 'draft',
    created_by: auth.user.id,
    updated_by: auth.user.id,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity(auth.user, 'create', 'kb_article', data.id, data.title)
  return NextResponse.json(data)
}
