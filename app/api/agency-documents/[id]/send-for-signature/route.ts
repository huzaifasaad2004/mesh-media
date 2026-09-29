import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { requireDocumentsWrite, serviceRole } from '@/lib/apiAuth'
import { renderLetterheadPdf } from '@/lib/pdf/LetterheadPdf'
import { contractSignatureFields } from '@/lib/letterhead/contractLayout'
import { SIGNABLE_BUCKET, SAFE_RECIPIENT_COLUMNS, sendSigningEmails } from '@/lib/signableDocuments'
import { logActivity } from '@/lib/activityLog'

export const runtime = 'nodejs'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Body: { agency: { name, email }, client: { name, email } }
// Turns a Document Studio contract into an e-signature document: renders the letterhead PDF
// (whose last page is the signature page), places each party's signature + date boxes on the
// printed lines, links it to the CRM client so it shows in their portal, and emails both
// signers their personal links.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireDocumentsWrite()
  if ('res' in auth) return auth.res

  const { agency, client } = await req.json().catch(() => ({}))
  for (const [label, party] of [['MeshMedia', agency], ['Client', client]] as const) {
    if (!party?.name?.trim() || !EMAIL.test(party?.email?.trim() ?? '')) {
      return NextResponse.json({ error: `${label} signer needs a name and a valid email` }, { status: 400 })
    }
  }

  const { data: studioDoc } = await auth.db.from('agency_documents').select('*').eq('id', params.id).single()
  if (!studioDoc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  if (studioDoc.document_type !== 'contract') {
    return NextResponse.json({ error: 'Set the document type to Contract first — only contracts have a signature page' }, { status: 400 })
  }

  const pdf = await renderLetterheadPdf(studioDoc)
  const pageCount = (await PDFDocument.load(pdf)).getPageCount()

  const db = serviceRole()
  const path = `${studioDoc.client_id || 'unlinked'}/studio-${studioDoc.id}-${Date.now()}.pdf`
  const { error: uploadError } = await db.storage.from(SIGNABLE_BUCKET).upload(path, Buffer.from(pdf), { contentType: 'application/pdf', upsert: false })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })
  const { data: publicUrl } = db.storage.from(SIGNABLE_BUCKET).getPublicUrl(path)

  const { data: document, error: docError } = await db.from('signable_documents').insert({
    client_id: studioDoc.client_id || null,
    title: studioDoc.title,
    file_url: publicUrl.publicUrl,
    storage_path: path,
    page_count: pageCount,
    status: 'fields_pending',
    created_by: auth.user.id,
  }).select('id, title').single()
  if (docError || !document) return NextResponse.json({ error: docError?.message ?? 'Could not create the signing document' }, { status: 400 })

  const { data: recipients, error: recipError } = await db.from('document_recipients').insert([
    { document_id: document.id, name: agency.name.trim(), email: agency.email.trim(), role: 'agency' },
    { document_id: document.id, name: client.name.trim(), email: client.email.trim(), role: 'client' },
  ]).select(`${SAFE_RECIPIENT_COLUMNS}, sign_token`)
  if (recipError || !recipients) return NextResponse.json({ error: recipError?.message ?? 'Could not add the signers' }, { status: 400 })

  const byRole = (role: string) => recipients.find((r) => r.role === role)!
  const { error: fieldError } = await db.from('document_fields').insert(
    (['agency', 'client'] as const).flatMap((party) => contractSignatureFields(party).map((f) => ({
      document_id: document.id, recipient_id: byRole(party).id, page_number: pageCount, ...f,
    })))
  )
  if (fieldError) return NextResponse.json({ error: fieldError.message }, { status: 400 })

  // The link column comes from the contracts migration — still mark it sent if it's missing.
  const { error: linkError } = await db.from('agency_documents').update({ status: 'sent', signable_document_id: document.id }).eq('id', studioDoc.id)
  if (linkError) await db.from('agency_documents').update({ status: 'sent' }).eq('id', studioDoc.id)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const emailResults = await sendSigningEmails(db, document, recipients, baseUrl)
  await logActivity(auth.user, 'create', 'signable_document', document.id, `${studioDoc.title} · sent for signature from Document Studio`)

  return NextResponse.json({ signable_document_id: document.id, emailResults })
}
