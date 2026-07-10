import { NextRequest, NextResponse } from 'next/server'
import { serviceRole } from '@/lib/apiAuth'

// Unauthenticated read for a recipient's personal signing link — no login required.
// The token itself is the credential: it's a unique per-recipient uuid mailed only to them.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'A signing token is required' }, { status: 401 })

  const db = serviceRole()
  const { data: recipient, error: recipError } = await db.from('document_recipients')
    .select('id, document_id, name, email, role')
    .eq('sign_token', token).eq('document_id', params.id).maybeSingle()
  if (recipError || !recipient) return NextResponse.json({ error: 'Invalid or expired signing link' }, { status: 403 })

  const { data: document, error } = await db.from('signable_documents')
    .select('*, client:clients(company_name), fields:document_fields(*), recipients:document_recipients(id, name, email, role, signed_at)')
    .eq('id', params.id).single()
  if (error || !document) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  if (document.status === 'cancelled') return NextResponse.json({ error: 'This document was cancelled' }, { status: 400 })

  return NextResponse.json({ ...document, viewer: recipient })
}
