'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { Plus, Video, Users as UsersIcon, X, Trash2, Pencil, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

interface AttendeeDraft { name: string; email: string; role: 'staff' | 'contractor' | 'client' | 'other'; user_id?: string }

function toLocalInput(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function MeetingForm({ clients, people, initial, onSuccess }: {
  clients: { id: string; company_name: string }[]
  people: { id: string; full_name: string | null; email: string | null; role: string }[]
  initial?: any
  onSuccess: () => void
}) {
  const isEdit = !!initial?.id
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [clientId, setClientId] = useState(initial?.client_id ?? '')
  const [start, setStart] = useState(toLocalInput(initial?.start_time))
  const [end, setEnd] = useState(toLocalInput(initial?.end_time) || (() => {
    if (!initial?.start_time) return ''
    return toLocalInput(new Date(new Date(initial.start_time).getTime() + 30 * 60000).toISOString())
  })())
  const [meetLink, setMeetLink] = useState(initial?.meet_link ?? '')
  const [attendees, setAttendees] = useState<AttendeeDraft[]>(
    initial?.attendees?.map((a: any) => ({ name: a.name, email: a.email, role: a.role, user_id: a.user_id })) ?? []
  )
  const [personPick, setPersonPick] = useState('')
  const [manual, setManual] = useState({ name: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const addPerson = () => {
    const p = people.find((x) => x.id === personPick)
    if (!p || attendees.some((a) => a.user_id === p.id)) return
    setAttendees((a) => [...a, { name: p.full_name ?? p.email ?? 'Unnamed', email: p.email ?? '', role: p.role === 'contractor' ? 'contractor' : 'staff', user_id: p.id }])
    setPersonPick('')
  }
  const addManual = () => {
    if (!manual.name.trim() || !manual.email.trim()) return
    setAttendees((a) => [...a, { name: manual.name.trim(), email: manual.email.trim(), role: 'other' }])
    setManual({ name: '', email: '' })
  }
  const removeAttendee = (i: number) => setAttendees((a) => a.filter((_, idx) => idx !== i))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!title.trim() || !start || !end) { setError('Title, start, and end time are required'); return }
    if (attendees.length === 0) { setError('Add at least one attendee'); return }
    setSaving(true)
    const payload = {
      title: title.trim(), description: description.trim() || null, client_id: clientId || null,
      start_time: new Date(start).toISOString(), end_time: new Date(end).toISOString(),
      meet_link: meetLink.trim() || undefined,
      ...(isEdit ? {} : { attendees }),
    }
    const res = await fetch(isEdit ? `/api/meetings/${initial.id}` : '/api/meetings', {
      method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
    onSuccess()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={labelClass}>Title *</label>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Starts *</label>
          <input type="datetime-local" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>Ends *</label>
          <input type="datetime-local" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>Client (optional)</label>
        <select className={inputClass} value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">No specific client</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>
      </div>

      {!isEdit && (
        <div>
          <label className={labelClass}>Attendees *</label>
          <div className="flex gap-2 mb-2">
            <select className={inputClass} value={personPick} onChange={(e) => setPersonPick(e.target.value)}>
              <option value="">Select staff/contractor…</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.full_name ?? p.email} ({p.role})</option>)}
            </select>
            <button type="button" onClick={addPerson} className="btn-secondary btn-sm flex-shrink-0">Add</button>
          </div>
          <div className="flex gap-2 mb-2">
            <input className={inputClass} placeholder="Name (client/other)" value={manual.name} onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))} />
            <input className={inputClass} placeholder="Email" value={manual.email} onChange={(e) => setManual((m) => ({ ...m, email: e.target.value }))} />
            <button type="button" onClick={addManual} className="btn-secondary btn-sm flex-shrink-0">Add</button>
          </div>
          <div className="space-y-1.5">
            {attendees.map((a, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5 text-sm">
                <span>{a.name} <span className="text-gray-400 text-xs">({a.email})</span></span>
                <button type="button" onClick={() => removeAttendee(i)} className="text-gray-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            {attendees.length === 0 && <p className="text-xs text-gray-400">No attendees added yet</p>}
          </div>
        </div>
      )}

      <div>
        <label className={labelClass}>Google Meet link {isEdit ? '' : '(only needed if Google Calendar isn\'t connected)'}</label>
        <input className={inputClass} type="url" placeholder="https://meet.google.com/…" value={meetLink} onChange={(e) => setMeetLink(e.target.value)} />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
        {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Schedule Meeting'}
      </button>
    </form>
  )
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<any[]>([])
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([])
  const [people, setPeople] = useState<{ id: string; full_name: string | null; email: string | null; role: string }[]>([])
  const [myId, setMyId] = useState('')
  const [canWrite, setCanWrite] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    const [mRes, cRes, pRes, meRes] = await Promise.all([
      fetch('/api/meetings'), fetch('/api/clients'), fetch('/api/profiles'), fetch('/api/profiles/me'),
    ])
    const [m, c, p, me] = await Promise.all([mRes.json(), cRes.json(), pRes.json(), meRes.json()])
    setMeetings(Array.isArray(m) ? m : [])
    setClients(Array.isArray(c) ? c : [])
    setPeople(Array.isArray(p) ? p : [])
    setMyId(me?.id ?? '')
    setCanWrite(!!me?.permissions?.includes('meetings.write'))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const { upcoming, past } = useMemo(() => {
    const now = Date.now()
    const active = meetings.filter((m) => m.status !== 'cancelled' || new Date(m.start_time).getTime() > now)
    return {
      upcoming: active.filter((m) => new Date(m.end_time).getTime() >= now).sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time)),
      past: active.filter((m) => new Date(m.end_time).getTime() < now).sort((a, b) => +new Date(b.start_time) - +new Date(a.start_time)),
    }
  }, [meetings])

  const cancel = async (id: string) => {
    if (!confirm('Cancel this meeting? Every attendee will be emailed.')) return
    const res = await fetch(`/api/meetings/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Meeting cancelled'); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed to cancel') }
  }

  const respond = async (meetingId: string, response: 'accepted' | 'declined') => {
    const res = await fetch(`/api/meetings/${meetingId}/respond`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response }),
    })
    if (res.ok) { toast.success(response === 'accepted' ? 'Accepted' : 'Declined'); load() }
    else toast.error('Failed to respond')
  }

  const MeetingCard = ({ m }: { m: any }) => {
    const myAttendee = m.attendees?.find((a: any) => a.user_id === myId)
    const cancelled = m.status === 'cancelled'
    return (
      <div className={`card p-4 ${cancelled ? 'opacity-60' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900">{m.title}</p>
              {cancelled && <span className="badge bg-red-100 text-red-700">Cancelled</span>}
              {m.client?.company_name && <span className="badge bg-brand-50 text-brand-700">{m.client.company_name}</span>}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {formatDate(m.start_time)} · {new Date(m.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}–{new Date(m.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </p>
            {m.description && <p className="text-sm text-gray-600 mt-1.5">{m.description}</p>}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <UsersIcon className="w-3.5 h-3.5 text-gray-400" />
              {(m.attendees ?? []).map((a: any) => (
                <span key={a.id} className={`text-xs px-2 py-0.5 rounded-full ${a.response_status === 'accepted' ? 'bg-green-50 text-green-700' : a.response_status === 'declined' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                  {a.name}
                </span>
              ))}
            </div>
            {m.calendar_sync_error && !cancelled && (
              <p className="text-xs text-orange-600 mt-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {m.calendar_sync_error}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {!cancelled && m.meet_link && (
              <a href={m.meet_link} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm">
                <Video className="w-3.5 h-3.5" /> Join
              </a>
            )}
            {!cancelled && canWrite && (
              <div className="flex gap-1">
                <button onClick={() => { setEditing(m); setShowModal(true) }} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => cancel(m.id)} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            )}
            {!cancelled && myAttendee && myAttendee.response_status === 'pending' && (
              <div className="flex gap-1">
                <button onClick={() => respond(m.id, 'accepted')} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-green-600 hover:bg-green-50" title="Accept"><CheckCircle2 className="w-4 h-4" /></button>
                <button onClick={() => respond(m.id, 'declined')} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50" title="Decline"><XCircle className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Meetings</h1>
          <p className="text-gray-500 text-sm mt-0.5">Schedule with your team, contractors, or clients — everyone gets a Meet link by email</p>
        </div>
        {canWrite && (
          <button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
            <Plus className="w-4 h-4" /> Schedule Meeting
          </button>
        )}
      </div>

      {loading ? (
        <div className="card h-40 animate-pulse bg-gray-50" />
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="mb-3">Upcoming</h3>
            {upcoming.length > 0 ? (
              <div className="space-y-3">{upcoming.map((m) => <MeetingCard key={m.id} m={m} />)}</div>
            ) : (
              <div className="card">
                <EmptyState
                  icon={Video}
                  title="No upcoming meetings"
                  helper="Schedule one with your team, contractors, or a client."
                  action={canWrite ? <button className="btn-primary btn-sm inline-flex" onClick={() => { setEditing(null); setShowModal(true) }}><Plus className="w-3 h-3" /> Schedule Meeting</button> : undefined}
                />
              </div>
            )}
          </div>
          {past.length > 0 && (
            <div>
              <h3 className="mb-3">Past</h3>
              <div className="space-y-3">{past.slice(0, 10).map((m) => <MeetingCard key={m.id} m={m} />)}</div>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditing(null) }} title={editing ? 'Edit Meeting' : 'Schedule Meeting'} size="lg">
        <MeetingForm clients={clients} people={people} initial={editing} onSuccess={() => { setShowModal(false); setEditing(null); load() }} />
      </Modal>
    </div>
  )
}
