import { NextRequest, NextResponse } from 'next/server'
import { requireDocumentsWrite, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { sendSigningEmails } from '@/lib/signableDocuments'

// Body: { only_unnotified? } — email each recipient who still has to sign their personal link.
// The field editor calls this with only_unnotified once boxes are placed (first send); the
// documents list calls it without, to resend links to everyone who hasn't signed yet.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireDocumentsWrite()
  if ('res' in auth) return auth.res

  const { only_unnotified } = await req.json().catch(() => ({}))
  const db = serviceRole()
  const { data: document } = await db.from('signable_documents').select('id, title, status').eq('id', params.id).single()
  if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  if (['signed', 'cancelled'].includes(document.status)) {
    return NextResponse.json({ error: `This document is already ${document.status}` }, { status: 400 })
  }

  const { count: fieldCount } = await db.from('document_fields').select('id', { count: 'exact', head: true }).eq('document_id', params.id)
  if (!fieldCount) return NextResponse.json({ error: 'Place the signature boxes before sending — signers have nothing to fill yet' }, { status: 400 })

  let query = db.from('document_recipients').select('id, name, email, sign_token').eq('document_id', params.id).is('signed_at', null)
  if (only_unnotified) query = query.is('notified_at', null)
  const { data: recipients, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const results = await sendSigningEmails(db, document, recipients ?? [], baseUrl)
  if (results.length) {
    await logActivity(auth.user, 'update', 'signable_document', params.id, `Signing links emailed to ${results.filter((r) => r.sent).length} recipient(s)`)
  }
  return NextResponse.json({ emailResults: results })
}
