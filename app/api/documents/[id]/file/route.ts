import { NextRequest, NextResponse } from 'next/server'
import { requireUser, serviceRole } from '@/lib/apiAuth'
import { SIGNABLE_BUCKET, storagePathFromUrl, type DocumentFileVersion } from '@/lib/signableDocuments'

// Streams a document's PDF from our own origin (?version=original|signed|certificate).
// The signer page renders it with pdf.js, which fails silently on a cross-origin fetch —
// serving it same-origin removes CORS, caching, and bucket-visibility from the equation.
// Access mirrors the document itself: a recipient's personal ?token=, or a logged-in
// user who can already read the document through RLS (staff, or the client it belongs to).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.nextUrl.searchParams.get('token')
  const version = (req.nextUrl.searchParams.get('version') ?? 'original') as DocumentFileVersion
  const db = serviceRole()

  if (token) {
    const { data: recipient } = await db.from('document_recipients')
      .select('id').eq('sign_token', token).eq('document_id', params.id).maybeSingle()
    if (!recipient) return NextResponse.json({ error: 'Invalid or expired signing link' }, { status: 403 })
  } else {
    const auth = await requireUser()
    if ('res' in auth) return auth.res
    const { data: visible } = await auth.db.from('signable_documents').select('id').eq('id', params.id).maybeSingle()
    if (!visible) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const { data: document } = await db.from('signable_documents')
    .select('title, status, file_url, storage_path, merged_file_url, completion_certificate_url')
    .eq('id', params.id).single()
  if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  if (token && document.status === 'cancelled') return NextResponse.json({ error: 'This document was cancelled' }, { status: 400 })

  const path = version === 'signed' ? storagePathFromUrl(document.merged_file_url)
    : version === 'certificate' ? storagePathFromUrl(document.completion_certificate_url)
    : document.storage_path ?? storagePathFromUrl(document.file_url)
  if (!path) return NextResponse.json({ error: `No ${version} file for this document yet` }, { status: 404 })

  const { data: blob, error } = await db.storage.from(SIGNABLE_BUCKET).download(path)
  if (error || !blob) return NextResponse.json({ error: 'The file could not be loaded from storage' }, { status: 502 })

  const suffix = version === 'signed' ? ' (signed)' : version === 'certificate' ? ' (certificate)' : ''
  const filename = `${document.title}${suffix}.pdf`.replace(/[^\w .()-]+/g, '_')
  return new NextResponse(await blob.arrayBuffer(), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
