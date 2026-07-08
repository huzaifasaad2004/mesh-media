import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, serviceRole, OPS_WRITE } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

// Body: { status: 'completed' | 'cancelled' }
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(OPS_WRITE)
  if ('res' in auth) return auth.res

  const { status } = await req.json()
  if (!['completed', 'cancelled'].includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const { data, error } = await serviceRole().from('onboarding_runs')
    .update({ status, completed_at: new Date().toISOString() })
    .eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity(auth.user, 'update', 'onboarding_run', params.id, `marked ${status}`)
  return NextResponse.json(data)
}
