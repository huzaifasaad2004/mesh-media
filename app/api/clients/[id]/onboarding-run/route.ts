import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/apiAuth'

// Returns this client's active run if there is one, otherwise the most
// recently finished one (so the UI can show "Completed X" / offer a
// restart), or null if onboarding was never started.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('res' in auth) return auth.res

  const { data: active } = await auth.db
    .from('onboarding_runs')
    .select('*, steps:onboarding_run_steps(*)')
    .eq('client_id', params.id).eq('status', 'active').maybeSingle()

  const run = active ?? (
    await auth.db
      .from('onboarding_runs')
      .select('*, steps:onboarding_run_steps(*)')
      .eq('client_id', params.id)
      .order('started_at', { ascending: false })
      .limit(1).maybeSingle()
  ).data

  if (!run) return NextResponse.json(null)
  return NextResponse.json({ ...run, steps: (run.steps ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order) })
}
