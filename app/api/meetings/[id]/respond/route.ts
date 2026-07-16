import { NextRequest, NextResponse } from 'next/server'
import { requireUser, serviceRole } from '@/lib/apiAuth'

// Body: { response: 'accepted' | 'declined' }
// Any invited attendee (staff/contractor/client-portal user) can respond to
// their own invite — RLS's "meeting attendees self respond" policy backs this.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const { response } = await req.json()
  if (!['accepted', 'declined'].includes(response)) {
    return NextResponse.json({ error: 'response must be accepted or declined' }, { status: 400 })
  }

  const { data, error } = await auth.db
    .from('meeting_attendees')
    .update({ response_status: response })
    .eq('meeting_id', params.id)
    .eq('user_id', auth.user.id)
    .select()
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: 'You are not an attendee of this meeting' }, { status: 404 })

  return NextResponse.json(data)
}
