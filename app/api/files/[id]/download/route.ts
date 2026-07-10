import { NextRequest, NextResponse } from 'next/server'
import { requireUser, serviceRole } from '@/lib/apiAuth'

// RLS-scoped existence check via auth.db (staff full access, client-portal
// users only their own client_visible files), then redirect to the actual
// asset — Drive link as-is, or the Storage bucket's public URL.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('res' in auth) return auth.res

  const { data: file, error } = await auth.db.from('files').select('drive_url, storage_path').eq('id', params.id).single()
  if (error || !file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  if (file.drive_url) return NextResponse.redirect(file.drive_url)
  if (file.storage_path) {
    const { data } = serviceRole().storage.from('project-files').getPublicUrl(file.storage_path)
    return NextResponse.redirect(data.publicUrl)
  }
  return NextResponse.json({ error: 'File has no content' }, { status: 404 })
}
