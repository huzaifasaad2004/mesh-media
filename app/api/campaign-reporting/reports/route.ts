import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { MANAGERS, requireRoles, serviceRole } from '@/lib/apiAuth'
import { getCampaignReportData } from '@/lib/campaignReportData'
import { renderCampaignReportPdf } from '@/lib/pdf/CampaignReportPdf'
import { COMPANY } from '@/lib/company'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requireRoles(MANAGERS); if ('res' in auth) return auth.res
  const client = req.nextUrl.searchParams.get('client'); if (!client) return NextResponse.json([])
  const { data, error } = await serviceRole().from('campaign_reports').select('*').eq('client_id', client).order('created_at', { ascending: false }).limit(30)
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles(MANAGERS); if ('res' in auth) return auth.res
  const form = await req.formData(); const clientId = String(form.get('clientId') ?? ''), projectId = String(form.get('projectId') ?? '') || null
  const start = String(form.get('start') ?? ''), end = String(form.get('end') ?? ''), timezone = String(form.get('timezone') ?? 'Asia/Dubai')
  const provider = String(form.get('provider') ?? '') || null, campaign = String(form.get('campaign') ?? '') || null
  const commentary = String(form.get('commentary') ?? ''), send = form.get('send') === 'true', recipient = String(form.get('recipient') ?? '')
  if (!clientId || !start || !end) return NextResponse.json({ error: 'Client and reporting period are required' }, { status: 400 })
  const db = serviceRole()
  const [{ data: client }, { data: project }] = await Promise.all([db.from('clients').select('id, company_name, email, contact_person').eq('id', clientId).single(), projectId ? db.from('projects').select('id,name').eq('id', projectId).single() : Promise.resolve({ data: null })])
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  try {
    const data = await getCampaignReportData(db, { clientId, projectId, start, end, provider, campaign, compare: true })
    const pdf = await renderCampaignReportPdf({ clientName: client.company_name, projectName: project?.name, start, end, timezone, commentary, data, baseUrl: process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin })
    const reportId = crypto.randomUUID(), path = `${clientId}/${reportId}.pdf`
    const { error: uploadError } = await db.storage.from('campaign-reports').upload(path, pdf, { contentType: 'application/pdf', upsert: false }); if (uploadError) throw uploadError
    let audioPath: string | null = null; const audio = form.get('audio')
    if (audio instanceof File && audio.size) { audioPath = `${clientId}/${reportId}.${audio.type.includes('mp4') ? 'm4a' : 'webm'}`; const { error } = await db.storage.from('campaign-reports').upload(audioPath, audio, { contentType: audio.type }); if (error) throw error }
    const to = recipient || client.email || ''
    const shouldSend = send && Boolean(to)
    const { data: report, error } = await db.from('campaign_reports').insert({ id: reportId, client_id: clientId, project_id: projectId, title: `${client.company_name} Campaign Report`, period_start: start, period_end: end, timezone, filters: { provider, campaign }, commentary, pdf_storage_path: path, audio_storage_path: audioPath, status: 'ready', created_by: auth.user.id }).select().single(); if (error) throw error
    if (shouldSend) {
      if (!process.env.RESEND_API_KEY) throw new Error('Email delivery is not configured')
      const resend = new Resend(process.env.RESEND_API_KEY)
      const attachments: any[] = [{ filename: `Campaign-Report-${start}-to-${end}.pdf`, content: pdf }]
      if (audio instanceof File && audio.size && audio.size < 15_000_000) attachments.push({ filename: `Voice-Note.${audio.type.includes('mp4') ? 'm4a' : 'webm'}`, content: Buffer.from(await audio.arrayBuffer()) })
      const { error: emailError } = await resend.emails.send({ from: `MeshMedia <${process.env.RESEND_FROM_EMAIL ?? 'hello@m3m.ae'}>`, to, subject: `${client.company_name} campaign performance report · ${start} to ${end}`, html: `<p>Dear ${client.contact_person ?? client.company_name},</p><p>Please find your detailed campaign performance report attached for ${start} to ${end}.</p>${audioPath ? '<p>A voice note from your account team is also attached.</p>' : ''}<p>Kind regards,<br>${COMPANY.name}</p>`, attachments }); if (emailError) throw emailError
      await db.from('campaign_reports').update({ status: 'sent', sent_to: to, sent_at: new Date().toISOString() }).eq('id', report.id)
    }
    return new NextResponse(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Campaign-Report-${start}-to-${end}.pdf"`, 'X-Report-Id': report.id } })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not generate report' }, { status: 400 }) }
}
