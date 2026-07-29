import { NextRequest, NextResponse } from 'next/server'
import { MANAGERS, requireRoles, serviceRole } from '@/lib/apiAuth'
import { getCampaignReportData } from '@/lib/campaignReportData'
import { generateCampaignInsights } from '@/lib/campaignInsights'

export async function POST(req: NextRequest) {
  const auth = await requireRoles(MANAGERS); if ('res' in auth) return auth.res
  const { clientId, projectId, start, end, provider, campaign, language = 'en' } = await req.json()
  if (!clientId || !start || !end) return NextResponse.json({ error: 'Client and period are required' }, { status: 400 })
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: 'AI reporting is not configured' }, { status: 503 })
  const db = serviceRole()
  const [{ data: client }, data] = await Promise.all([
    db.from('clients').select('company_name').eq('id', clientId).single(),
    getCampaignReportData(db, { clientId, projectId, start, end, provider, campaign, compare: true }),
  ])
  try {
    return NextResponse.json(await generateCampaignInsights({ clientName:client?.company_name ?? 'the client', start, end, language, data }))
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'AI analysis failed' }, { status: 400 }) }
}
