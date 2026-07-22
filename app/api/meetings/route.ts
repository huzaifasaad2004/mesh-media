import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireMeetingsWrite, serviceRole, stripProtected } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { notifyUsers } from '@/lib/notify'
import { createMeetEvent, isGoogleCalendarConnected } from '@/lib/google/calendar'
import { sendMeetingEmail, scheduleAttendeeReminders } from '@/lib/meetingEmail'

const ATTENDEE_ROLES = ['staff', 'contractor', 'client', 'other']

// RLS-scoped: managers+ see every meeting; anyone else only sees meetings
// they're actually invited to (or tagged to their own client, for a
// client-portal user).
export async function GET() {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const { data, error } = await auth.db
    .from('meetings')
    .select('*, client:clients(company_name), organizer:profiles!meetings_organizer_id_fkey(full_name), attendees:meeting_attendees(id, user_id, name, email, role, response_status)')
    .order('start_time', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// Body: { title, description?, client_id?, start_time, end_time, meet_link?,
//         attendees: [{ name, email, role, user_id? }] }
export async function POST(req: NextRequest) {
  const auth = await requireMeetingsWrite()
  if ('res' in auth) return auth.res
  const body = stripProtected(await req.json())
  const { title, start_time, end_time, attendees } = body as {
    title?: string; start_time?: string; end_time?: string
    attendees?: { name: string; email: string; role?: string; user_id?: string }[]
  }
  if (!title?.trim() || !start_time || !end_time) {
    return NextResponse.json({ error: 'title, start_time, and end_time are required' }, { status: 400 })
  }
  if (new Date(end_time) <= new Date(start_time)) {
    return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 })
  }
  if (!Array.isArray(attendees) || attendees.length === 0) {
    return NextResponse.json({ error: 'At least one attendee is required' }, { status: 400 })
  }
  for (const a of attendees) {
    if (!a.name?.trim() || !a.email?.trim()) {
      return NextResponse.json({ error: 'Every attendee needs a name and email' }, { status: 400 })
    }
  }

  const db = serviceRole()
  const { data: organizer } = await db.from('profiles').select('full_name').eq('id', auth.user.id).single()

  // Try to mint a real Google Meet link. Never let a Calendar failure block
  // scheduling — the meeting still gets created, just with meet_link null
  // (or whatever manual link the organizer pasted) and a recorded error.
  let meetLink: string | null = body.meet_link || null
  let calendarEventId: string | null = null
  let calendarSyncError: string | null = null
  if (await isGoogleCalendarConnected()) {
    try {
      const result = await createMeetEvent({
        title: title.trim(),
        description: body.description || null,
        startTime: start_time,
        endTime: end_time,
        attendeeEmails: attendees.map((a) => a.email.trim()),
      })
      calendarEventId = result.eventId
      meetLink = result.meetLink ?? meetLink
    } catch (e: any) {
      calendarSyncError = e.message ?? 'Google Calendar sync failed'
    }
  } else if (!meetLink) {
    calendarSyncError = 'Google Calendar is not connected — paste a Meet link manually or ask an admin to finish the Google setup.'
  }

  const { data: meeting, error } = await db.from('meetings').insert({
    title: title.trim(),
    description: body.description || null,
    client_id: body.client_id || null,
    organizer_id: auth.user.id,
    start_time, end_time,
    meet_link: meetLink,
    calendar_event_id: calendarEventId,
    calendar_sync_error: calendarSyncError,
  }).select('*, client:clients(company_name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: createdAttendees, error: attErr } = await db.from('meeting_attendees').insert(
    attendees.map((a) => ({
      meeting_id: meeting.id,
      user_id: a.user_id || null,
      name: a.name.trim(),
      email: a.email.trim(),
      role: ATTENDEE_ROLES.includes(a.role ?? '') ? a.role : 'other',
    }))
  ).select('*')
  if (attErr) return NextResponse.json({ error: attErr.message }, { status: 400 })

  await logActivity(auth.user, 'create', 'meeting', meeting.id, `${title} · ${createdAttendees.length} attendee(s)`)

  // Email every attendee (best-effort, failures don't block the response),
  // and notify anyone with an account in-app too. Reminders are scheduled
  // right now via Resend's native scheduledAt — exact to the minute,
  // no polling cron required.
  const emailResults = await Promise.all(createdAttendees.map(async (a) => {
    const inviteResult = await sendMeetingEmail(a.email, 'invite', {
      attendeeName: a.name, title: meeting.title, description: meeting.description,
      startTime: meeting.start_time, endTime: meeting.end_time, meetLink: meeting.meet_link,
      organizerName: organizer?.full_name ?? 'Your team',
    })
    const reminders = await scheduleAttendeeReminders(a, meeting, organizer?.full_name ?? 'Your team')
    await db.from('meeting_attendees').update(reminders).eq('id', a.id)
    return { email: a.email, ...inviteResult }
  }))

  const notifyIds = createdAttendees.map((a) => a.user_id).filter((id): id is string => !!id && id !== auth.user.id)
  if (notifyIds.length) {
    await notifyUsers(db, {
      userIds: notifyIds,
      title: 'New meeting scheduled',
      body: `${meeting.title} · ${new Date(meeting.start_time).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' })}`,
      href: '/meetings',
      category: 'meeting',
    })
  }

  return NextResponse.json({ ...meeting, attendees: createdAttendees, emailResults })
}
