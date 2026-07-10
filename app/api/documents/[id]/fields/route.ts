import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireDocumentsWrite, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

// RLS-scoped read — staff see all, client-portal users only their own document's fields.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const { data, error } = await auth.db
    .from('document_fields')
    .select('*')
    .eq('document_id', params.id)
    .order('page_number')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// Body: { fields: [{ page_number, field_type, recipient_id, x, y, width, height }] }
// Replaces the full field layout for this document — the placement editor always saves the whole set.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireDocumentsWrite()
  if ('res' in auth) return auth.res

  const { fields } = await req.json()
  if (!Array.isArray(fields)) return NextResponse.json({ error: 'fields must be an array' }, { status: 400 })

  const db = serviceRole()
  const { data: document, error: docError } = await db.from('signable_documents').select('id, title, status').eq('id', params.id).single()
  if (docError || !document) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const { data: recipients } = await db.from('document_recipients').select('id').eq('document_id', params.id)
  const validRecipientIds = new Set((recipients ?? []).map((r) => r.id))

  for (const f of fields) {
    if (!['signature', 'name', 'date'].includes(f.field_type) || !validRecipientIds.has(f.recipient_id)) {
      return NextResponse.json({ error: 'Every field needs a valid field_type and a recipient from this document' }, { status: 400 })
    }
  }

  await db.from('document_fields').delete().eq('document_id', params.id)

  if (fields.length > 0) {
    const { error: insertError } = await db.from('document_fields').insert(
      fields.map((f: any) => ({
        document_id: params.id,
        page_number: f.page_number,
        field_type: f.field_type,
        recipient_id: f.recipient_id,
        x: f.x, y: f.y, width: f.width, height: f.height,
      }))
    )
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })
  }

  const newStatus = fields.length > 0 && document.status === 'sent' ? 'fields_pending' : document.status
  if (newStatus !== document.status) await db.from('signable_documents').update({ status: newStatus }).eq('id', params.id)

  await logActivity(auth.user, 'update', 'signable_document', params.id, `${fields.length} field(s) placed on ${document.title}`)

  return NextResponse.json({ success: true })
}
