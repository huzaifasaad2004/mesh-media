import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireRoles, serviceRole, MANAGERS } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const { data, error } = await auth.db
    .from('onboarding_templates')
    .select('*, steps:onboarding_template_steps(*)')
    .eq('id', params.id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ...data, steps: (data.steps ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order) })
}

// Body: { name, description?, steps: [{ title, description? }] } — steps are
// fully replaced on every update, same convention as invoice/quotation items.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(MANAGERS)
  if ('res' in auth) return auth.res

  const { name, description, steps } = await req.json()
  const db = serviceRole()

  const { data: template, error } = await db.from('onboarding_templates')
    .update({ name, description: description || null })
    .eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (Array.isArray(steps)) {
    await db.from('onboarding_template_steps').delete().eq('template_id', params.id)
    if (steps.length > 0) {
      await db.from('onboarding_template_steps').insert(
        steps.map((s: { title: string; description?: string }, idx: number) => ({
          template_id: params.id, title: s.title, description: s.description || null, sort_order: idx,
        }))
      )
    }
  }

  await logActivity(auth.user, 'update', 'onboarding_template', params.id, template.name)
  return NextResponse.json(template)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(MANAGERS)
  if ('res' in auth) return auth.res
  const { data: existing } = await serviceRole().from('onboarding_templates').select('name').eq('id', params.id).single()
  const { error } = await serviceRole().from('onboarding_templates').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'delete', 'onboarding_template', params.id, existing?.name)
  return NextResponse.json({ success: true })
}
