import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, serviceRole, OPS_WRITE } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(OPS_WRITE)
  if ('res' in auth) return auth.res
  const db = serviceRole()

  const { data: existing } = await db.from('files').select('name, storage_path').eq('id', params.id).single()
  if (existing?.storage_path) {
    await db.storage.from('project-files').remove([existing.storage_path])
  }
  const { error } = await db.from('files').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity(auth.user, 'delete', 'file', params.id, existing?.name)
  return NextResponse.json({ success: true })
}
