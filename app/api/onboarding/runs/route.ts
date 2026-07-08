import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, serviceRole, OPS_WRITE } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

// Body: { client_id, template_id } — snapshots the template's steps into a
// new run so later edits to the template don't retroactively change runs
// already in progress.
export async function POST(req: NextRequest) {
  const auth = await requireRoles(OPS_WRITE)
  if ('res' in auth) return auth.res

  const { client_id, template_id } = await req.json()
  if (!client_id || !template_id) return NextResponse.json({ error: 'client_id and template_id are required' }, { status: 400 })

  const db = serviceRole()

  const { data: existingActive } = await db.from('onboarding_runs').select('id').eq('client_id', client_id).eq('status', 'active').maybeSingle()
  if (existingActive) return NextResponse.json({ error: 'This client already has an active onboarding run' }, { status: 400 })

  const { data: template, error: templateError } = await db.from('onboarding_templates')
    .select('name, steps:onboarding_template_steps(title, description, sort_order)')
    .eq('id', template_id).single()
  if (templateError || !template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  const { data: run, error } = await db.from('onboarding_runs').insert({
    client_id, template_id, template_name: template.name, created_by: auth.user.id,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const steps = (template.steps ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order)
  if (steps.length > 0) {
    await db.from('onboarding_run_steps').insert(
      steps.map((s: any, idx: number) => ({ run_id: run.id, title: s.title, description: s.description, sort_order: idx }))
    )
  }

  await logActivity(auth.user, 'create', 'onboarding_run', run.id, `${template.name} for client`)
  return NextResponse.json(run)
}
