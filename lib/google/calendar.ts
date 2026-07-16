import { google } from 'googleapis'
import { getGoogleAuth, type OAuth2Client } from '@/lib/google/oauth'

/**
 * Auto-generated Google Meet links require a real Google Calendar event —
 * there's no standalone "mint a Meet link" endpoint. Authenticates as
 * whichever Google account was connected via the in-app "Connect Google
 * Calendar" flow (Settings → Integrations), reusing the same GOOGLE_CLIENT_ID/
 * GOOGLE_CLIENT_SECRET already registered for Celine's own Calendar/Gmail
 * integration — see SETUP.md Step 7 for the one-time setup (just adding this
 * app's redirect URI to that existing OAuth client, then clicking Connect).
 */

export async function isGoogleCalendarConnected(): Promise<boolean> {
  const client = await getGoogleAuth()
  return !!client
}

function calendarClient(auth: OAuth2Client) {
  return google.calendar({ version: 'v3', auth })
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

/** Creates a real Calendar event with an auto-generated Meet link on the
 *  connected account's primary calendar. sendUpdates: 'none' — we email
 *  attendees ourselves via Resend with the branded template, so Google's own
 *  invite email would just be a duplicate. Throws if Google isn't connected;
 *  callers already check isGoogleCalendarConnected() first and degrade
 *  gracefully to a manual link. */
export async function createMeetEvent(input: MeetEventInput): Promise<MeetEventResult> {
  const auth = await getGoogleAuth()
  if (!auth) throw new Error('Google Calendar is not connected')
  const calendar = calendarClient(auth)
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
  const auth = await getGoogleAuth()
  if (!auth) throw new Error('Google Calendar is not connected')
  const calendar = calendarClient(auth)
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
  const auth = await getGoogleAuth()
  if (!auth) throw new Error('Google Calendar is not connected')
  const calendar = calendarClient(auth)
  await calendar.events.delete({ calendarId: 'primary', eventId, sendUpdates: 'none' })
}
