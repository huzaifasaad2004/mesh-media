import { NextRequest, NextResponse } from 'next/server'
import { serviceRole } from '@/lib/apiAuth'
import { requireCronOrManager } from '@/lib/cron'
import { sendMeetingEmail } from '@/lib/meetingEmail'

export const runtime = 'nodejs'

// Vercel Hobby plan only allows daily-or-coarser cron schedules (see
// vercel.json — every other cron in this project is daily/monthly for the
// same reason), so a precise "15 minutes before" reminder isn't achievable
// without a Pro upgrade. This runs once a day and reminds every attendee of
// any meeting happening in the next 24 hours, once (reminder_24h_sent_at
// guards against re-sending on the next day's run for a meeting that's
// still >24h out). reminder_15m_sent_at is left unused for now — wiring up
// a tighter reminder is a fast follow if the plan is ever upgraded to Pro.
async function run(req: NextRequest) {
  const auth = await requireCronOrManager(req)
  if ('res' in auth) return auth.res

  const db = serviceRole()
  const now = new Date()
  const results = { reminded: 0, meetings: 0, errors: [] as string[] }

  const { data: upcoming } = await db
    .from('meetings')
    .select('*, attendees:meeting_attendees(name, email), organizer:profiles!meetings_organizer_id_fkey(full_name)')
    .eq('status', 'scheduled')
    .is('reminder_24h_sent_at', null)
    .gte('start_time', now.toISOString())
    .lte('start_time', new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString())

  for (const m of upcoming ?? []) {
    const organizerName = (m as any).organizer?.full_name ?? 'Your team'
    try {
      await Promise.all(((m as any).attendees ?? []).map((a: any) =>
        sendMeetingEmail(a.email, 'reminder_24h', {
          attendeeName: a.name, title: m.title, description: m.description,
          startTime: m.start_time, endTime: m.end_time, meetLink: m.meet_link, organizerName,
        }).catch(() => {})
      ))
      await db.from('meetings').update({ reminder_24h_sent_at: new Date().toISOString() }).eq('id', m.id)
      results.reminded += ((m as any).attendees ?? []).length
      results.meetings++
    } catch (e: any) {
      results.errors.push(`${m.id}: ${e.message}`)
    }
  }

  return NextResponse.json(results)
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }
