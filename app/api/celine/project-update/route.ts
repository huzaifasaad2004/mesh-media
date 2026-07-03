// ── app/api/celine/project-update/route.ts (add to the m3m repo) ────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { celineAuthorized } from '@/lib/celine/auth'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const ALLOWED_STATUS = ['active', 'completed', 'paused', 'cancelled']

export async function POST(req: NextRequest) {
  if (!celineAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { project_id, status, description } = await req.json()
  if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 })
  const patch: Record<string, unknown> = {}
  if (status && ALLOWED_STATUS.includes(status)) patch.status = status
  if (description) patch.description = description
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  const { data, error } = await admin().from('projects').update(patch).eq('id', project_id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, project: { id: data.id, status: data.status } })
}
