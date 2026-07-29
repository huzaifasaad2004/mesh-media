import { NextRequest, NextResponse } from 'next/server'
import { MANAGERS, requireRoles, serviceRole } from '@/lib/apiAuth'
import { generateCampaignReport } from '@/lib/campaignReportService'

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
  const commentary = String(form.get('commentary') ?? ''), internalNotes = String(form.get('internalNotes') ?? ''), send = form.get('send') === 'true', recipient = String(form.get('recipient') ?? '')
  const language = String(form.get('language') ?? 'en') as 'en'|'ar'|'bilingual'; let summary:any={}; try{summary=JSON.parse(String(form.get('summary')??'{}'))}catch{}
  if (!clientId || !start || !end) return NextResponse.json({ error: 'Client and reporting period are required' }, { status: 400 })
  try {
    const audioFile=form.get('audio'); const audio=audioFile instanceof File&&audioFile.size?{bytes:Buffer.from(await audioFile.arrayBuffer()),mime:audioFile.type}:null
    const {report,pdf}=await generateCampaignReport(serviceRole(),{clientId,projectId,start,end,timezone,provider,campaign,commentary,internalNotes,language,summary,createdBy:auth.user.id,status:send?'approved':'review',recipients:recipient.split(',').map(x=>x.trim()).filter(Boolean),send,baseUrl:process.env.NEXT_PUBLIC_APP_URL??req.nextUrl.origin,audio})
    return new NextResponse(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Campaign-Report-${start}-to-${end}.pdf"`, 'X-Report-Id': report.id, 'X-Report-Token':report.public_token } })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not generate report' }, { status: 400 }) }
}
