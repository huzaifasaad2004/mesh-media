import { NextResponse } from 'next/server'
import { requireLeadsRead, serviceRole } from '@/lib/apiAuth'

export async function GET() {
  const auth = await requireLeadsRead()
  if ('res' in auth) return auth.res

  const { data, error } = await serviceRole()
    .from('pipeline_stages')
    .select('id, name, position')
    .order('position')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
