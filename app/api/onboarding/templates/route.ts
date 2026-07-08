import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireRoles, serviceRole, MANAGERS } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

export async function GET() {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const { data, error } = await auth.db
    .from('onboarding_templates')
    .select('*, steps:onboarding_template_steps(*)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json((data ?? []).map((t: any) => ({ ...t, steps: (t.steps ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order) })))
}

// Body: { name, description?, steps: [{ title, description? }] }
export async function POST(req: NextRequest) {
  const auth = await requireRoles(MANAGERS)
  if ('res' in auth) return auth.res

  const { name, description, steps } = await req.json()
  if (!name) return NextResponse.json({ error: 'Template name is required' }, { status: 400 })

  const db = serviceRole()
  const { data: template, error } = await db.from('onboarding_templates')
    .insert({ name, description: description || null, created_by: auth.user.id })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (Array.isArray(steps) && steps.length > 0) {
    await db.from('onboarding_template_steps').insert(
      steps.map((s: { title: string; description?: string }, idx: number) => ({
        template_id: template.id, title: s.title, description: s.description || null, sort_order: idx,
      }))
    )
  }

  await logActivity(auth.user, 'create', 'onboarding_template', template.id, template.name)
  return NextResponse.json(template)
}
