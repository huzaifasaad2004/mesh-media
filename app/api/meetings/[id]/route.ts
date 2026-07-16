import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireMeetingsWrite, serviceRole, stripProtected } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { notifyUsers } from '@/lib/notify'
import { updateMeetEvent, cancelMeetEvent, isGoogleCalendarConnected } from '@/lib/google/calendar'
import { sendMeetingEmail, scheduleAttendeeReminders, cancelScheduledEmail } from '@/lib/meetingEmail'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const { data, error } = await auth.db
    .from('meetings')
    .select('*, client:clients(company_name), organizer:profiles!meetings_organizer_id_fkey(full_name), attendees:meeting_attendees(id, user_id, name, email, role, response_status)')
    .eq('id', params.id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

// Body: { title?, description?, client_id?, start_time?, end_time?, meet_link? }
// Reschedules/edits — attendee list itself isn't editable here (cancel + reschedule
// with a fresh attendee list keeps this simple and avoids partial-notify bugs).
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireMeetingsWrite()
  if ('res' in auth) return auth.res
  const body = stripProtected(await req.json())

  const db = serviceRole()
  const { data: existing } = await db.from('meetings').select('*, attendees:meeting_attendees(id, name, email, reminder_24h_email_id, reminder_15m_email_id)').eq('id', params.id).single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status === 'cancelled') return NextResponse.json({ error: 'This meeting is cancelled' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim()
  if (body.description !== undefined) patch.description = body.description || null
  if (body.client_id !== undefined) patch.client_id = body.client_id || null
  if (body.start_time) patch.start_time = body.start_time
  if (body.end_time) patch.end_time = body.end_time
  if (body.meet_link !== undefined) patch.meet_link = body.meet_link || null

  const rescheduled = !!(body.start_time || body.end_time)
  if (rescheduled && new Date(patch.end_time as string ?? existing.end_time) <= new Date(patch.start_time as string ?? existing.start_time)) {
    return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 })
  }

  if (existing.calendar_event_id && (patch.title || patch.description !== undefined || rescheduled) && await isGoogleCalendarConnected()) {
    try {
      await updateMeetEvent(existing.calendar_event_id, {
        title: (patch.title as string) ?? existing.title,
        description: (patch.description as string | null) ?? existing.description,
        startTime: (patch.start_time as string) ?? existing.start_time,
        endTime: (patch.end_time as string) ?? existing.end_time,
      })
    } catch (e: any) {
      patch.calendar_sync_error = e.message ?? 'Google Calendar sync failed'
    }
  }

  const { data: meeting, error } = await db.from('meetings').update(patch).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'update', 'meeting', params.id, meeting.title)

  const { data: attendees } = await db.from('meeting_attendees').select('*').eq('meeting_id', params.id)
  const { data: organizer } = await db.from('profiles').select('full_name').eq('id', meeting.organizer_id).single()

  await Promise.all((attendees ?? []).map(async (a) => {
    await sendMeetingEmail(a.email, 'update', {
      attendeeName: a.name, title: meeting.title, description: meeting.description,
      startTime: meeting.start_time, endTime: meeting.end_time, meetLink: meeting.meet_link,
      organizerName: organizer?.full_name ?? 'Your team',
    }).catch(() => {})
    // The old reminders reference stale content/times — cancel them and
    // schedule fresh ones against the updated meeting.
    await Promise.all([cancelScheduledEmail(a.reminder_24h_email_id), cancelScheduledEmail(a.reminder_15m_email_id)])
    const reminders = await scheduleAttendeeReminders(a, meeting, organizer?.full_name ?? 'Your team')
    await db.from('meeting_attendees').update(reminders).eq('id', a.id)
  }))
  const notifyIds = (attendees ?? []).map((a) => a.user_id).filter((id): id is string => !!id && id !== auth.user.id)
  if (notifyIds.length) {
    await notifyUsers(db, {
      userIds: notifyIds,
      title: 'Meeting updated',
      body: meeting.title,
      href: '/meetings',
      category: 'meeting',
    })
  }

  return NextResponse.json(meeting)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireMeetingsWrite()
  if ('res' in auth) return auth.res
  const db = serviceRole()

  const { data: existing } = await db.from('meetings').select('*').eq('id', params.id).single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (existing.calendar_event_id && await isGoogleCalendarConnected()) {
    try { await cancelMeetEvent(existing.calendar_event_id) } catch { /* best-effort — the meeting is cancelled in our system regardless */ }
  }

  const { data: meeting, error } = await db.from('meetings').update({ status: 'cancelled' }).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'update', 'meeting', params.id, `${meeting.title} → cancelled`)

  const { data: attendees } = await db.from('meeting_attendees').select('*').eq('meeting_id', params.id)
  const { data: organizer } = await db.from('profiles').select('full_name').eq('id', meeting.organizer_id).single()
  await Promise.all((attendees ?? []).map((a) => Promise.all([
    sendMeetingEmail(a.email, 'cancel', {
      attendeeName: a.name, title: meeting.title, description: meeting.description,
      startTime: meeting.start_time, endTime: meeting.end_time, meetLink: meeting.meet_link,
      organizerName: organizer?.full_name ?? 'Your team',
    }).catch(() => {}),
    cancelScheduledEmail(a.reminder_24h_email_id),
    cancelScheduledEmail(a.reminder_15m_email_id),
  ])))
  const notifyIds = (attendees ?? []).map((a) => a.user_id).filter((id): id is string => !!id && id !== auth.user.id)
  if (notifyIds.length) {
    await notifyUsers(db, { userIds: notifyIds, title: 'Meeting cancelled', body: meeting.title, href: '/meetings', category: 'meeting' })
  }

  return NextResponse.json({ success: true })
}
