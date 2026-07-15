import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, requireRoles, serviceRole, stripProtected, OPS_WRITE } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { MAX_DIRECT_UPLOAD_BYTES, MAX_DIRECT_UPLOAD_LABEL } from '@/lib/uploadLimits'

export async function GET() {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  const { data, error } = await auth.db
    .from('files')
    .select('*, client:clients(id, company_name), project:projects(id, name), uploader:profiles(full_name)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Only ever show the latest version of each file in the main list — older
  // versions still exist as rows (the version history / access log) but are
  // reached through /api/files/[id]/versions, not this list.
  const latestByRoot = new Map<string, any>()
  for (const f of data ?? []) {
    const rootId = f.root_file_id ?? f.id
    const current = latestByRoot.get(rootId)
    if (!current || f.version > current.version) latestByRoot.set(rootId, f)
  }
  return NextResponse.json(Array.from(latestByRoot.values()))
}

// Body: { client_id?, project_id?, name, category, client_visible, file_base64?, file_name?, mime_type?, drive_url? }
export async function POST(req: NextRequest) {
  const auth = await requireRoles(OPS_WRITE)
  if ('res' in auth) return auth.res

  const body = stripProtected(await req.json())
  const { client_id, project_id, name, category, client_visible, file_base64, file_name, mime_type, drive_url } = body as Record<string, any>
  if (!name?.trim()) return NextResponse.json({ error: 'A file name is required' }, { status: 400 })
  if (!file_base64 && !drive_url?.trim()) {
    return NextResponse.json({ error: 'Provide a file to upload or a Drive link' }, { status: 400 })
  }

  const db = serviceRole()
  const row: Record<string, unknown> = {
    client_id: client_id || null,
    project_id: project_id || null,
    name: name.trim(),
    category: category || 'other',
    client_visible: client_visible ?? true,
    uploaded_by: auth.user.id,
  }

  if (file_base64) {
    const buffer = Buffer.from(file_base64, 'base64')
    if (buffer.byteLength > MAX_DIRECT_UPLOAD_BYTES) {
      return NextResponse.json({ error: `File is too large for direct upload (max ${MAX_DIRECT_UPLOAD_LABEL}) — use a Drive link instead` }, { status: 400 })
    }
    const ext = (file_name?.split('.').pop() || 'bin').toLowerCase()
    const path = `${client_id || 'unassigned'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
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

  await logActivity(auth.user, 'create', 'file', data.id, `${data.name} · ${data.client?.company_name ?? 'unassigned'}`)
  return NextResponse.json(data)
}
