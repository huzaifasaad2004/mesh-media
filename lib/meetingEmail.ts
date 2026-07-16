import { Resend } from 'resend'
import { COMPANY } from '@/lib/company'

const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', {
  weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

function shell(heading: string, body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f5f5f5;color:#1a1a1a;}
.wrap{max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);}
.header{background:#6E1318;padding:24px 32px;}
.header h1{color:#fff;margin:0;font-size:18px;}
.body{padding:24px 32px;font-size:14px;line-height:1.6;}
.cta{display:inline-block;background:#6E1318;color:#fff!important;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin:14px 0;}
.meta{background:#faf9f5;border:1px solid #ECE4D6;border-radius:8px;padding:14px 16px;margin:14px 0;font-size:13px;}
.footer{background:#f9f9f9;border-top:1px solid #eee;padding:14px 32px;font-size:11px;color:#999;text-align:center;}
</style></head><body>
<div class="wrap">
  <div class="header"><h1>${heading}</h1></div>
  <div class="body">${body}</div>
  <div class="footer">${COMPANY.name} · ${COMPANY.email} · ${COMPANY.phone}</div>
</div>
</body></html>`
}

interface MeetingEmailInput {
  attendeeName: string
  title: string
  description?: string | null
  startTime: string
  endTime: string
  meetLink: string | null
  organizerName: string
}

export type MeetingEmailKind = 'invite' | 'update' | 'cancel' | 'reminder_24h' | 'reminder_15m'

/** Sends (or, with `scheduledAt`, schedules) the branded meeting email to
 *  one attendee. Failures are swallowed by the caller (same convention as
 *  every other email send in this codebase) — a bad address shouldn't block
 *  scheduling for everyone else. Returns Resend's email `id` so a scheduled
 *  reminder can be cancelled later (reschedule/cancellation) via
 *  `cancelScheduledEmail`. */
export async function sendMeetingEmail(
  to: string, kind: MeetingEmailKind, input: MeetingEmailInput, scheduledAt?: string
): Promise<{ sent: boolean; error?: string; id?: string }> {
  if (!process.env.RESEND_API_KEY) return { sent: false, error: 'RESEND_API_KEY not configured' }
  const resend = new Resend(process.env.RESEND_API_KEY)

  const subject = {
    invite: `Meeting invite: ${input.title}`,
    update: `Updated: ${input.title}`,
    cancel: `Cancelled: ${input.title}`,
    reminder_24h: `Reminder — tomorrow: ${input.title}`,
    reminder_15m: `Starting soon: ${input.title}`,
  }[kind]

  const intro = {
    invite: `<p>Dear ${input.attendeeName},</p><p>${input.organizerName} has scheduled a meeting with you.</p>`,
    update: `<p>Dear ${input.attendeeName},</p><p>This meeting has been updated:</p>`,
    cancel: `<p>Dear ${input.attendeeName},</p><p>This meeting has been cancelled:</p>`,
    reminder_24h: `<p>Dear ${input.attendeeName},</p><p>Reminder — you have a meeting tomorrow:</p>`,
    reminder_15m: `<p>Dear ${input.attendeeName},</p><p>Your meeting is starting in about 15 minutes:</p>`,
  }[kind]

  const meta = `<div class="meta">
    <strong>${input.title}</strong><br>
    ${fmt(input.startTime)} – ${new Date(input.endTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
    ${input.description ? `<br><br>${input.description}` : ''}
  </div>`

  const cta = kind !== 'cancel' && input.meetLink
    ? `<p><a href="${input.meetLink}" class="cta">Join Google Meet →</a></p>`
    : kind !== 'cancel'
      ? `<p style="color:#888;">A meeting link will follow separately.</p>`
      : ''

  const html = shell(COMPANY.name, `${intro}${meta}${cta}`)

  const { data, error } = await resend.emails.send({
    from: `MeshMedia <${process.env.RESEND_FROM_EMAIL ?? 'hello@m3m.ae'}>`,
    to, subject, html,
    ...(scheduledAt ? { scheduledAt } : {}),
  })
  return error ? { sent: false, error: error.message } : { sent: true, id: data?.id }
}

/** Cancels a previously-scheduled reminder that hasn't gone out yet — used
 *  when a meeting is rescheduled (old reminder times are wrong) or
 *  cancelled. Resend errors if the email already sent or doesn't exist;
 *  both are fine outcomes here, so failures are swallowed. */
export async function cancelScheduledEmail(id: string | null | undefined) {
  if (!id || !process.env.RESEND_API_KEY) return
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.cancel(id).catch(() => {})
}

interface AttendeeForReminders { id: string; name: string; email: string }

/** Schedules both reminder emails (24h and 15min before start) for one
 *  attendee via Resend's native `scheduledAt` — no polling cron needed, and
 *  it's exact to the minute regardless of what cron cadence the hosting
 *  plan allows. A reminder whose fire time has already passed (e.g. the
 *  meeting itself is being created less than 24h out) is simply skipped
 *  rather than sent immediately or backdated. Returns the Resend email ids
 *  to store on the attendee row so a later reschedule/cancel can un-fire them. */
export async function scheduleAttendeeReminders(
  attendee: AttendeeForReminders,
  meeting: { title: string; description?: string | null; start_time: string; end_time: string; meet_link: string | null },
  organizerName: string,
): Promise<{ reminder_24h_email_id: string | null; reminder_15m_email_id: string | null }> {
  const start = new Date(meeting.start_time).getTime()
  const in24h = new Date(start - 24 * 60 * 60 * 1000)
  const in15m = new Date(start - 15 * 60 * 1000)
  const now = Date.now()

  const input: MeetingEmailInput = {
    attendeeName: attendee.name, title: meeting.title, description: meeting.description,
    startTime: meeting.start_time, endTime: meeting.end_time, meetLink: meeting.meet_link, organizerName,
  }

  const [r24, r15] = await Promise.all([
    in24h.getTime() > now
      ? sendMeetingEmail(attendee.email, 'reminder_24h', input, in24h.toISOString()).catch(() => ({ sent: false, id: undefined }))
      : Promise.resolve({ sent: false, id: undefined }),
    in15m.getTime() > now
      ? sendMeetingEmail(attendee.email, 'reminder_15m', input, in15m.toISOString()).catch(() => ({ sent: false, id: undefined }))
      : Promise.resolve({ sent: false, id: undefined }),
  ])

  return { reminder_24h_email_id: r24.id ?? null, reminder_15m_email_id: r15.id ?? null }
}
