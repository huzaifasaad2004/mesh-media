import { NextRequest, NextResponse } from 'next/server'
import { requireUser, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { isStaff } from '@/lib/roles'
import { notifyUsers } from '@/lib/notify'

// Body: { party: 'agency' | 'client', signer_name, signature_data? }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const { user, role } = auth

  const { party, signer_name, signature_data } = await req.json()
  if (!['agency', 'client'].includes(party) || !signer_name?.trim()) {
    return NextResponse.json({ error: 'party and signer_name are required' }, { status: 400 })
  }

  const db = serviceRole()
  const { data: document, error: docError } = await db.from('signable_documents').select('id, client_id, status').eq('id', params.id).single()
  if (docError || !document) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  if (document.status === 'cancelled') return NextResponse.json({ error: 'This document was cancelled' }, { status: 400 })

  if (party === 'agency') {
    if (!isStaff(role)) return NextResponse.json({ error: 'Only staff can sign on behalf of the agency' }, { status: 403 })
  } else {
    const { data: link } = await db.from('client_contacts').select('client_id').eq('user_id', user.id).eq('client_id', document.client_id).maybeSingle()
    if (!link) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

  const { error: signError } = await db.from('document_signatures').upsert({
    document_id: params.id,
    party,
    signer_name: signer_name.trim(),
    signature_data: signature_data || null,
    signer_user_id: user.id,
    ip_address: ip,
    signed_at: new Date().toISOString(),
  }, { onConflict: 'document_id,party' })
  if (signError) return NextResponse.json({ error: signError.message }, { status: 400 })

  const { data: allSignatures } = await db.from('document_signatures').select('party').eq('document_id', params.id)
  const parties = new Set((allSignatures ?? []).map((s) => s.party))
  const newStatus = parties.has('agency') && parties.has('client') ? 'signed' : 'partially_signed'
  await db.from('signable_documents').update({ status: newStatus }).eq('id', params.id)
  if (newStatus === 'signed') {
    await db.from('contracts').update({ status: 'signed', signed_at: new Date().toISOString() }).eq('signable_document_id', params.id)
  }

  await logActivity(user, 'sign', 'signable_document', params.id, `${party} signature by ${signer_name.trim()}`)

  // Notify staff when the client signs — they'll want to know it's done.
  if (party === 'client') {
    const { data: staff } = await db.from('profiles').select('id').in('role', ['owner', 'admin', 'manager'])
    if (staff?.length) {
      await notifyUsers(db, {
        userIds: staff.map((s) => s.id),
        title: 'Document signed by client',
        body: `${signer_name.trim()} signed`,
        href: `/documents/${params.id}`,
        category: 'critical_alert',
      })
    }
  }

  return NextResponse.json({ success: true, status: newStatus })
}
