import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, serviceRole, OPS_WRITE } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

// Body: { is_completed: boolean }
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(OPS_WRITE)
  if ('res' in auth) return auth.res

  const { is_completed } = await req.json()
  const db = serviceRole()

  const { data, error } = await db.from('onboarding_run_steps')
    .update({
      is_completed: !!is_completed,
      completed_at: is_completed ? new Date().toISOString() : null,
      completed_by: is_completed ? auth.user.id : null,
    })
    .eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity(auth.user, 'update', 'onboarding_run_step', params.id, `${is_completed ? 'completed' : 'reopened'}: ${data.title}`)
  return NextResponse.json(data)
}
