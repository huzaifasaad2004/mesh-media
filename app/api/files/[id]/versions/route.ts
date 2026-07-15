import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, requireRoles, serviceRole, OPS_WRITE } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

// Full version history for the file's chain (itself + every replacement),
// newest first — this doubles as the access log: who uploaded what, when.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res

  const { data: file } = await auth.db.from('files').select('id, root_file_id').eq('id', params.id).single()
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const rootId = file.root_file_id ?? file.id

  const { data, error } = await auth.db
    .from('files')
    .select('id, name, file_size, storage_path, drive_url, version, created_at, uploader:profiles(full_name)')
    .or(`id.eq.${rootId},root_file_id.eq.${rootId}`)
    .order('version', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// Body: { file_base64?, file_name?, mime_type?, drive_url? } — replaces the
// content only; name/category/client/client_visible are inherited from the
// original so a version can't quietly change what a file "is".
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(OPS_WRITE)
  if ('res' in auth) return auth.res

  const db = serviceRole()
  const { data: original } = await db.from('files').select('*').eq('id', params.id).single()
  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const rootId = original.root_file_id ?? original.id
  const { data: siblings } = await db.from('files').select('version').or(`id.eq.${rootId},root_file_id.eq.${rootId}`)
  const maxVersion = Math.max(1, ...(siblings ?? []).map((s: any) => s.version))
  if (original.version !== maxVersion) {
    return NextResponse.json({ error: 'This is an older version — replace the current one instead' }, { status: 400 })
  }

  const { file_base64, file_name, mime_type, drive_url } = await req.json()
  if (!file_base64 && !drive_url?.trim()) {
    return NextResponse.json({ error: 'Provide a file to upload or a Drive link' }, { status: 400 })
  }

  const row: Record<string, unknown> = {
    client_id: original.client_id,
    project_id: original.project_id,
    name: original.name,
    category: original.category,
    client_visible: original.client_visible,
    uploaded_by: auth.user.id,
    root_file_id: rootId,
    version: maxVersion + 1,
  }

  if (file_base64) {
    const buffer = Buffer.from(file_base64, 'base64')
    if (buffer.byteLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File is too large for direct upload (max 8MB) — use a Drive link instead' }, { status: 400 })
    }
    const ext = (file_name?.split('.').pop() || 'bin').toLowerCase()
    const path = `${original.client_id || 'unassigned'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error: uploadError } = await db.storage
      .from('project-files')
      .upload(path, buffer, { contentType: mime_type || 'application/octet-stream', upsert: false })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })
    row.storage_path = path
    row.file_type = ext
    row.file_size = buffer.byteLength
  } else {
    row.drive_url = drive_url.trim()
  }

  const { data, error } = await db.from('files').insert(row).select('*, client:clients(id, company_name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity(auth.user, 'create', 'file', data.id, `${data.name} v${data.version} · ${data.client?.company_name ?? 'unassigned'}`)
  return NextResponse.json(data)
}
