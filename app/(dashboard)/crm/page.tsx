'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, LayoutGrid, List, Search, Trophy, XCircle, ArrowRight, Phone, Users2, Mail, MessageCircle, StickyNote, CalendarClock } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Pagination from '@/components/ui/Pagination'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { formatDate, formatCurrency, getInitials } from '@/lib/utils'
import { LEAD_SOURCES } from '@/lib/leads'

const PAGE_SIZE = 10
const today = () => new Date().toISOString().split('T')[0]

const activityIcon: Record<string, any> = {
  note: StickyNote, call: Phone, meeting: Users2, email: Mail, whatsapp: MessageCircle,
  stage_change: ArrowRight, status_change: Trophy,
}

const sourceLabel = (v: string) => LEAD_SOURCES.find(s => s.value === v)?.label ?? v

export default function CrmPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [stages, setStages] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<'board' | 'list'>('board')
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const toast = useToast()

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load leads')
      setLeads(Array.isArray(data) ? data : [])
      setError('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
    fetch('/api/pipeline-stages').then(r => r.json()).then(d => setStages(Array.isArray(d) ? d : [])).catch(() => {})
    fetch('/api/profiles').then(r => r.json()).then(d => setProfiles(Array.isArray(d) ? d : [])).catch(() => {})
  }, [fetchLeads])

  const patchLead = async (id: string, body: Record<string, unknown>, errMsg: string) => {
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (!res.ok) { toast.error(errMsg); fetchLeads(); return null }
    const updated = await res.json()
    setLeads(p => p.map(l => l.id === id ? updated : l))
    return updated
  }

  const moveLead = (id: string, stage_id: string) => {
    setLeads(p => p.map(l => l.id === id ? { ...l, stage_id, stage: stages.find(s => s.id === stage_id) ?? l.stage } : l))
    patchLead(id, { stage_id }, 'Failed to move lead')
  }

  const deleteLead = async (id: string) => {
    if (!confirm('Delete this lead? Its activity history goes with it.')) return
    const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Lead deleted'); setShowModal(false); setEditing(null) }
    else toast.error('Failed to delete lead')
    fetchLeads()
  }

  const openLeads = useMemo(() => leads.filter(l => l.status === 'open'), [leads])
  const pipelineValue = useMemo(
    () => openLeads.reduce((s, l) => s + (Number(l.estimated_value) || 0), 0),
    [openLeads]
  )
  const followUpsDue = useMemo(
    () => openLeads.filter(l => l.next_follow_up && l.next_follow_up <= today()).length,
    [openLeads]
  )

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return leads
    return leads.filter(l =>
      l.company_name?.toLowerCase().includes(q) ||
      l.contact_name?.toLowerCase().includes(q) ||
      l.assignee?.full_name?.toLowerCase().includes(q)
    )
  }, [leads, query])

  const listFiltered = useMemo(
    () => statusFilter ? searched.filter(l => l.status === statusFilter) : searched,
    [searched, statusFilter]
  )
  const pageCount = Math.max(1, Math.ceil(listFiltered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const listVisible = listFiltered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const openEdit = (lead: any) => { setEditing(lead); setShowModal(true) }

  const followUpOverdue = (l: any) => l.status === 'open' && l.next_follow_up && l.next_follow_up <= today()

  const LeadCard = ({ lead }: { lead: any }) => (
    <div
      draggable
      onDragStart={() => setDragId(lead.id)}
      onDragEnd={() => { setDragId(null); setDragOver(null) }}
      onClick={() => openEdit(lead)}
      className={`card p-3.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group ${dragId === lead.id ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug text-ink">{lead.company_name}</p>
        <button onClick={(e) => { e.stopPropagation(); deleteLead(lead.id) }}
          className="opacity-0 group-hover:opacity-100 text-taupe-500 hover:text-red-500 transition-opacity flex-shrink-0">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      {lead.contact_name && <p className="text-xs text-taupe-500 mt-0.5">{lead.contact_name}</p>}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <span className="badge bg-paper-200 text-umber-700">{sourceLabel(lead.source)}</span>
        {lead.estimated_value != null && (
          <span className="text-xs font-semibold text-umber-800 tabular-nums">{formatCurrency(Number(lead.estimated_value), lead.currency)}</span>
        )}
      </div>
      <div className="flex items-center justify-between mt-2.5">
        {lead.next_follow_up ? (
          <span className={`text-xs flex items-center gap-1 ${followUpOverdue(lead) ? 'font-semibold' : 'text-taupe-500'}`}
            style={followUpOverdue(lead) ? { color: 'var(--danger)' } : {}}>
            <CalendarClock className="w-3 h-3" /> {formatDate(lead.next_follow_up)}
          </span>
        ) : <span />}
        {lead.assignee && (
          <div className="bg-brand-600 text-paper-100 rounded-full flex items-center justify-center text-[10px] font-bold overflow-hidden"
            style={{ width: 22, height: 22 }} title={lead.assignee.full_name}>
            {lead.assignee.avatar_url ? <img src={lead.assignee.avatar_url} alt="" className="w-full h-full object-cover" /> : getInitials(lead.assignee.full_name)}
          </div>
        )}
      </div>
    </div>
  )

  const statusBadge = (s: string) =>
    s === 'won' ? <span className="badge" style={{ color: 'var(--success)', background: 'var(--success-bg)' }}>Won</span>
    : s === 'lost' ? <span className="badge" style={{ color: 'var(--danger)', background: 'var(--danger-bg)' }}>Lost</span>
    : <span className="badge" style={{ color: 'var(--info)', background: 'var(--info-bg)' }}>Open</span>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>CRM</h1>
          <p className="text-taupe-600 text-sm mt-0.5">
            {openLeads.length} open · {formatCurrency(pipelineValue)} in pipeline
            {followUpsDue > 0 && <span style={{ color: 'var(--danger)' }} className="font-semibold"> · {followUpsDue} follow-up{followUpsDue > 1 ? 's' : ''} due</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-paper-100 rounded-lg p-0.5">
            <button onClick={() => setView('board')}
              className={`px-2.5 py-1.5 rounded-md transition-colors ${view === 'board' ? 'bg-white shadow-sm text-ink' : 'text-taupe-500'}`}
              title="Pipeline view">
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setView('list')}
              className={`px-2.5 py-1.5 rounded-md transition-colors ${view === 'list' ? 'bg-white shadow-sm text-ink' : 'text-taupe-500'}`}
              title="List view">
              <List className="w-4 h-4" />
            </button>
          </div>
          <button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
            <Plus className="w-4 h-4" /> New Lead
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2.5 rounded-lg text-sm" style={{ color: 'var(--danger)', background: 'var(--danger-bg)' }}>
          Couldn&apos;t load leads: {error}
        </div>
      )}

      <div className="card px-4 py-3 mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-4 h-4 text-taupe-500 flex-shrink-0" />
          <input
            className="flex-1 text-sm focus:outline-none bg-transparent placeholder:text-taupe-500"
            placeholder="Search leads, contact, assignee…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
          />
        </div>
        {view === 'list' && (
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="border border-sand-300 rounded-lg px-2 py-1.5 text-xs text-umber-700 bg-white"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="card h-60 animate-pulse bg-paper-100" />)}
        </div>
      ) : view === 'board' ? (
        <div className="flex gap-3 items-start overflow-x-auto pb-2">
          {stages.map(col => {
            const colLeads = searched.filter(l => l.status === 'open' && l.stage_id === col.id)
            const colValue = colLeads.reduce((s, l) => s + (Number(l.estimated_value) || 0), 0)
            return (
              <div key={col.id}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col.id) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => { if (dragId) moveLead(dragId, col.id); setDragId(null); setDragOver(null) }}
                className={`rounded-xl p-2.5 transition-colors min-h-[200px] w-64 flex-shrink-0 ${dragOver === col.id ? 'bg-brand-50 ring-2 ring-rose' : 'bg-paper-100'}`}>
                <div className="flex items-center justify-between px-1.5 pb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-taupe-600">{col.name}</span>
                  <span className="text-xs font-semibold text-taupe-500 bg-paper-200 rounded-full px-2 py-0.5">{colLeads.length}</span>
                </div>
                <p className="px-1.5 pb-2 text-[11px] text-taupe-500 tabular-nums">{colValue > 0 ? formatCurrency(colValue) : '—'}</p>
                <div className="space-y-2">
                  {colLeads.map(lead => <LeadCard key={lead.id} lead={lead} />)}
                  {colLeads.length === 0 && <p className="text-xs text-taupe-500 text-center py-6">Drop leads here</p>}
                </div>
              </div>
            )
          })}
          {stages.length === 0 && (
            <div className="card flex-1">
              <EmptyState icon={LayoutGrid} title="Pipeline not set up"
                helper="Run the phase39 migration in Supabase to create the pipeline stages." />
            </div>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper-50">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-taupe-600">Company</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-taupe-600">Contact</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-taupe-600">Stage</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-taupe-600">Source</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-taupe-600">Est. Value</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-taupe-600">Follow-up</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-taupe-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-200">
                {listVisible.length > 0 ? listVisible.map((lead) => (
                  <tr key={lead.id} className="hover:bg-paper-50 transition-colors cursor-pointer" onClick={() => openEdit(lead)}>
                    <td className="px-5 py-3 font-medium text-ink">{lead.company_name}</td>
                    <td className="px-5 py-3 text-taupe-600">{lead.contact_name ?? '—'}</td>
                    <td className="px-5 py-3 text-taupe-600">{lead.stage?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-taupe-600">{sourceLabel(lead.source)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-umber-800">
                      {lead.estimated_value != null ? formatCurrency(Number(lead.estimated_value), lead.currency) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={followUpOverdue(lead) ? 'font-semibold' : 'text-taupe-600'}
                        style={followUpOverdue(lead) ? { color: 'var(--danger)' } : {}}>
                        {formatDate(lead.next_follow_up)}
                      </span>
                    </td>
                    <td className="px-5 py-3">{statusBadge(lead.status)}</td>
                  </tr>
                )) : (
                  <EmptyState
                    colSpan={7}
                    title={leads.length === 0 ? 'No leads yet' : 'No leads match your filters'}
                    helper={leads.length === 0 ? 'Add your first prospect to start tracking the pipeline.' : 'Try a different search term or status filter.'}
                    action={leads.length === 0 ? <button className="btn-primary btn-sm inline-flex" onClick={() => { setEditing(null); setShowModal(true) }}><Plus className="w-3 h-3" /> New Lead</button> : undefined}
                  />
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={currentPage} pageCount={pageCount} total={listFiltered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditing(null) }}
        title={editing ? editing.company_name : 'New Lead'}
        size="xl"
      >
        <LeadEditor
          key={editing?.id ?? 'new'}
          lead={editing}
          stages={stages}
          profiles={profiles}
          onSaved={(lead: any) => {
            setLeads(p => editing ? p.map(l => l.id === lead.id ? lead : l) : [lead, ...p])
            setShowModal(false); setEditing(null)
          }}
          onChanged={fetchLeads}
          onClose={() => { setShowModal(false); setEditing(null) }}
          patchLead={patchLead}
          deleteLead={deleteLead}
        />
      </Modal>
    </div>
  )
}

/* ── Lead form + activity timeline + won/lost/convert actions ── */
function LeadEditor({ lead, stages, profiles, onSaved, onChanged, onClose, patchLead, deleteLead }: any) {
  const toast = useToast()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    company_name: lead?.company_name ?? '',
    contact_name: lead?.contact_name ?? '',
    email: lead?.email ?? '',
    phone: lead?.phone ?? '',
    website: lead?.website ?? '',
    source: lead?.source ?? 'other',
    stage_id: lead?.stage_id ?? stages[0]?.id ?? '',
    estimated_value: lead?.estimated_value ?? '',
    next_follow_up: lead?.next_follow_up ?? '',
    assigned_to: lead?.assigned_to ?? '',
    notes: lead?.notes ?? '',
  })
  const [activities, setActivities] = useState<any[]>([])
  const [newActivity, setNewActivity] = useState({ type: 'note', note: '' })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!lead) return
    fetch(`/api/leads/${lead.id}/activities`).then(r => r.json())
      .then(d => setActivities(Array.isArray(d) ? d : [])).catch(() => {})
  }, [lead])

  const save = async () => {
    if (!form.company_name.trim()) { toast.error('Company name is required'); return }
    setSaving(true)
    const body = { ...form, estimated_value: form.estimated_value === '' ? null : Number(form.estimated_value) }
    const res = await fetch(lead ? `/api/leads/${lead.id}` : '/api/leads', {
      method: lead ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { toast.error(data.error ?? 'Failed to save lead'); return }
    toast.success(lead ? 'Lead updated' : 'Lead added')
    onSaved(data)
  }

  const markLost = async () => {
    const reason = prompt('Why was this lead lost? (optional)') ?? ''
    const updated = await patchLead(lead.id, { status: 'lost', lost_reason: reason }, 'Failed to update lead')
    if (updated) { toast.success('Marked as lost'); onClose() }
  }

  const reopen = async () => {
    const updated = await patchLead(lead.id, { status: 'open' }, 'Failed to update lead')
    if (updated) { toast.success('Lead reopened'); onClose() }
  }

  const convert = async () => {
    if (!confirm(`Convert ${lead.company_name} into a client?`)) return
    const res = await fetch(`/api/leads/${lead.id}/convert`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Failed to convert lead'); return }
    toast.success('Converted to client 🎉')
    onChanged()
    router.push(`/clients/${data.clientId}`)
  }

  const addActivity = async () => {
    if (!newActivity.note.trim()) return
    const res = await fetch(`/api/leads/${lead.id}/activities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newActivity),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Failed to log activity'); return }
    setActivities(a => [data, ...a])
    setNewActivity({ type: 'note', note: '' })
  }

  const input = 'w-full border border-sand-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose'
  const label = 'block text-xs font-semibold text-taupe-600 mb-1'

  return (
    <div className="space-y-5">
      {lead && lead.status !== 'open' && (
        <div className="px-4 py-2.5 rounded-lg text-sm flex items-center justify-between"
          style={lead.status === 'won'
            ? { color: 'var(--success)', background: 'var(--success-bg)' }
            : { color: 'var(--danger)', background: 'var(--danger-bg)' }}>
          <span>
            {lead.status === 'won' ? 'This lead was won.' : `This lead was lost.${lead.lost_reason ? ` Reason: ${lead.lost_reason}` : ''}`}
          </span>
          {!lead.converted_client_id && <button className="underline font-medium" onClick={reopen}>Reopen</button>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className={label}>Company *</label>
          <input className={input} value={form.company_name} onChange={e => set('company_name', e.target.value)} />
        </div>
        <div>
          <label className={label}>Contact person</label>
          <input className={input} value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
        </div>
        <div>
          <label className={label}>Source</label>
          <select className={input} value={form.source} onChange={e => set('source', e.target.value)}>
            {LEAD_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Email</label>
          <input className={input} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div>
          <label className={label}>Phone</label>
          <input className={input} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>
        <div>
          <label className={label}>Website</label>
          <input className={input} value={form.website} onChange={e => set('website', e.target.value)} />
        </div>
        <div>
          <label className={label}>Stage</label>
          <select className={input} value={form.stage_id} onChange={e => set('stage_id', e.target.value)}>
            {stages.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Estimated value (AED)</label>
          <input className={input} inputMode="decimal" value={form.estimated_value}
            onChange={e => set('estimated_value', e.target.value)} />
        </div>
        <div>
          <label className={label}>Next follow-up</label>
          <input className={input} type="date" value={form.next_follow_up ?? ''} onChange={e => set('next_follow_up', e.target.value)} />
        </div>
        <div>
          <label className={label}>Assigned to</label>
          <select className={input} value={form.assigned_to ?? ''} onChange={e => set('assigned_to', e.target.value)}>
            <option value="">Unassigned</option>
            {profiles.map((p: any) => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Notes</label>
          <textarea className={input} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : lead ? 'Save Changes' : 'Add Lead'}
        </button>
        {lead && lead.status === 'open' && (
          <>
            <button onClick={convert}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ color: 'var(--success)', background: 'var(--success-bg)' }}>
              <Trophy className="w-4 h-4" /> Won → Convert to Client
            </button>
            <button onClick={markLost}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ color: 'var(--danger)', background: 'var(--danger-bg)' }}>
              <XCircle className="w-4 h-4" /> Mark Lost
            </button>
          </>
        )}
        {lead?.converted_client_id && (
          <button onClick={() => router.push(`/clients/${lead.converted_client_id}`)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-umber-700 border border-sand-300">
            <ArrowRight className="w-4 h-4" /> View Client
          </button>
        )}
        {lead && (
          <button onClick={() => deleteLead(lead.id)} className="ml-auto text-taupe-500 hover:text-red-500 p-2" title="Delete lead">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {lead && (
        <div className="border-t border-sand-300 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-taupe-600 mb-2.5">Activity</p>
          <div className="flex gap-2 mb-3">
            <select className="border border-sand-300 rounded-lg px-2 py-1.5 text-xs bg-white"
              value={newActivity.type} onChange={e => setNewActivity(a => ({ ...a, type: e.target.value }))}>
              <option value="note">Note</option>
              <option value="call">Call</option>
              <option value="meeting">Meeting</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
            <input className="flex-1 border border-sand-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose"
              placeholder="Log a call, meeting, or note…"
              value={newActivity.note}
              onChange={e => setNewActivity(a => ({ ...a, note: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') addActivity() }} />
            <button className="btn-primary btn-sm" onClick={addActivity}>Log</button>
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {activities.map((a: any) => {
              const Icon = activityIcon[a.type] ?? StickyNote
              return (
                <div key={a.id} className="flex items-start gap-2.5 text-sm">
                  <div className="w-6 h-6 rounded-full bg-paper-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-3 h-3 text-taupe-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-umber-800">{a.note}</p>
                    <p className="text-xs text-taupe-500">{a.author?.full_name ?? 'System'} · {formatDate(a.created_at)}</p>
                  </div>
                </div>
              )
            })}
            {activities.length === 0 && <p className="text-xs text-taupe-500">No activity logged yet.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
