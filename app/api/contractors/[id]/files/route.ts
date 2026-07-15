import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { requireUser, serviceRole } from '@/lib/apiAuth'
import { isStaff } from '@/lib/roles'
import { logActivity } from '@/lib/activityLog'
import { MAX_DIRECT_UPLOAD_BYTES, MAX_DIRECT_UPLOAD_LABEL } from '@/lib/uploadLimits'

// Body: { file_base64, file_name, mime_type, token? }
// Either staff (any staff role can upload on a contractor's behalf) or the
// contractor's own access token authorizes the upload — same dual-auth
// pattern as the document e-signature field routes.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { file_base64, file_name, mime_type, token } = await req.json()
  if (!file_base64 || !file_name) return NextResponse.json({ error: 'A file is required' }, { status: 400 })

  const db = serviceRole()
  const { data: contractor, error: contractorErr } = await db.from('contractors').select('id, name, access_token, user_id').eq('id', params.id).single()
  if (contractorErr || !contractor) return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })

  let uploader: User | null = null
  if (token) {
    if (token !== contractor.access_token) return NextResponse.json({ error: 'Invalid access link' }, { status: 403 })
  } else {
    const auth = await requireUser()
    if ('res' in auth) return auth.res
    const isOwnContractorAccount = auth.role === 'contractor' && contractor.user_id === auth.user.id
    if (!isStaff(auth.role) && !isOwnContractorAccount) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    uploader = auth.user
  }

  const buffer = Buffer.from(file_base64, 'base64')
  if (buffer.byteLength > MAX_DIRECT_UPLOAD_BYTES) {
    return NextResponse.json({ error: `File is too large for direct upload (max ${MAX_DIRECT_UPLOAD_LABEL})` }, { status: 400 })
  }

  const ext = (file_name.split('.').pop() || 'bin').toLowerCase()
  const path = `contractors/${params.id}/${Date.now()}.${ext}`

  const { error: uploadError } = await db.storage.from('project-files').upload(path, buffer, { contentType: mime_type || 'application/octet-stream', upsert: false })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })
  const { data: publicUrl } = db.storage.from('project-files').getPublicUrl(path)

  const { data: file, error } = await db.from('files').insert({
    contractor_id: params.id,
    name: file_name,
    storage_path: path,
    drive_url: publicUrl.publicUrl,
    file_type: mime_type || null,
    file_size: buffer.length,
    uploaded_by: uploader?.id ?? null,
    category: 'other',
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (uploader) await logActivity(uploader, 'upload', 'contractor_file', file.id, `${file_name} · ${contractor.name}`)

  return NextResponse.json(file)
}
