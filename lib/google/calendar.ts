import { google } from 'googleapis'

/**
 * Auto-generated Google Meet links require a real Google Calendar event —
 * there's no standalone "mint a Meet link" endpoint. This uses a service
 * account with domain-wide delegation to impersonate a real mailbox in the
 * Workspace domain (GOOGLE_CALENDAR_IMPERSONATE_EMAIL) and create events on
 * its calendar. Setup (one-time, in Google Cloud + Workspace admin):
 *
 * 1. Google Cloud Console → new (or existing) project → enable "Google Calendar API".
 * 2. IAM & Admin → Service Accounts → Create service account → Create key (JSON).
 * 3. Google Workspace Admin console → Security → API Controls → Domain-wide
 *    Delegation → Add new: Client ID = the service account's "unique ID"
 *    (from its Cloud Console details page, not the email), OAuth scope:
 *    https://www.googleapis.com/auth/calendar
 * 4. Set env vars (Vercel + .env.local):
 *    GOOGLE_SERVICE_ACCOUNT_EMAIL       = the service account's email
 *    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = the JSON key's private_key, with
 *                                          real newlines escaped as \n
 *    GOOGLE_CALENDAR_IMPERSONATE_EMAIL  = a real mailbox in your Workspace
 *                                          domain whose calendar events get
 *                                          created on (e.g. hello@m3m.ae)
 *
 * Until these are set, isGoogleCalendarConfigured() returns false and every
 * meeting falls back to a manually-pasted Meet link — nothing breaks.
 */

export function isGoogleCalendarConfigured() {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
    process.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL
  )
}

function getAuth() {
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n')
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/calendar'],
    subject: process.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL,
  })
}

function calendarClient() {
  return google.calendar({ version: 'v3', auth: getAuth() })
}

export interface MeetEventInput {
  title: string
  description?: string | null
  startTime: string // ISO
  endTime: string // ISO
  attendeeEmails: string[]
}

export interface MeetEventResult {
  eventId: string
  meetLink: string | null
}

/** Creates a real Calendar event with an auto-generated Meet link.
 *  sendUpdates: 'none' — we email attendees ourselves via Resend with the
 *  branded template, so Google's own invite email would just be a duplicate. */
export async function createMeetEvent(input: MeetEventInput): Promise<MeetEventResult> {
  const calendar = calendarClient()
  const requestId = `mm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const { data } = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    sendUpdates: 'none',
    requestBody: {
      summary: input.title,
      description: input.description ?? undefined,
      start: { dateTime: input.startTime },
      end: { dateTime: input.endTime },
      attendees: input.attendeeEmails.map((email) => ({ email })),
      conferenceData: {
        createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } },
      },
    },
  })
  return {
    eventId: data.id ?? '',
    meetLink: data.hangoutLink ?? data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ?? null,
  }
}

export async function updateMeetEvent(eventId: string, input: Omit<MeetEventInput, 'attendeeEmails'> & { attendeeEmails?: string[] }) {
  const calendar = calendarClient()
  await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    sendUpdates: 'none',
    requestBody: {
      summary: input.title,
      description: input.description ?? undefined,
      start: { dateTime: input.startTime },
      end: { dateTime: input.endTime },
      ...(input.attendeeEmails ? { attendees: input.attendeeEmails.map((email) => ({ email })) } : {}),
    },
  })
}

export async function cancelMeetEvent(eventId: string) {
  const calendar = calendarClient()
  await calendar.events.delete({ calendarId: 'primary', eventId, sendUpdates: 'none' })
}
