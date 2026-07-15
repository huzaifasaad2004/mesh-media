'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Newspaper, Trash2, Pencil, ExternalLink, TrendingUp, Users as UsersIcon } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'
const PAGE_SIZE = 10

const OUTLET_LABEL: Record<string, string> = { print: 'Print', online: 'Online', tv: 'TV', radio: 'Radio', podcast: 'Podcast', social: 'Social', other: 'Other' }
const PLACEMENT_LABEL: Record<string, string> = { feature: 'Feature', mention: 'Mention', interview: 'Interview', byline: 'Byline', review: 'Review', other: 'Other' }
const SENTIMENT_COLOR: Record<string, string> = { positive: 'bg-green-100 text-green-700', neutral: 'bg-gray-100 text-gray-600', negative: 'bg-red-100 text-red-700' }

const emptyForm = {
  client_id: '', title: '', outlet_name: '', outlet_type: 'online', placement_type: 'mention',
  sentiment: 'neutral', url: '', publish_date: new Date().toISOString().split('T')[0],
  reach: '', ave: '', emv_multiplier: '3', notes: '',
}

function PlacementForm({ clients, initial, onSuccess }: { clients: { id: string; company_name: string }[]; initial?: any; onSuccess: () => void }) {
  const [form, setForm] = useState<any>(initial ?? emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const emvPreview = form.ave && form.emv_multiplier ? Number(form.ave) * Number(form.emv_multiplier) : null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    const isEdit = !!initial?.id
    const res = await fetch(isEdit ? `/api/media-placements/${initial.id}` : '/api/media-placements', {
      method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
    onSuccess()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelClass}>Client *</label>
          <select className={inputClass} value={form.client_id} onChange={e => setForm((f: any) => ({ ...f, client_id: e.target.value }))} required disabled={!!initial?.id}>
            <option value="">Select a client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className={labelClass}>Headline / Title *</label>
          <input className={inputClass} value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} required />
        </div>
        <div>
          <label className={labelClass}>Outlet name *</label>
          <input className={inputClass} value={form.outlet_name} onChange={e => setForm((f: any) => ({ ...f, outlet_name: e.target.value }))} placeholder="e.g. Gulf News" required />
        </div>
        <div>
          <label className={labelClass}>Outlet type</label>
          <select className={inputClass} value={form.outlet_type} onChange={e => setForm((f: any) => ({ ...f, outlet_type: e.target.value }))}>
            {Object.entries(OUTLET_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Placement type</label>
          <select className={inputClass} value={form.placement_type} onChange={e => setForm((f: any) => ({ ...f, placement_type: e.target.value }))}>
            {Object.entries(PLACEMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Sentiment</label>
          <select className={inputClass} value={form.sentiment} onChange={e => setForm((f: any) => ({ ...f, sentiment: e.target.value }))}>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Publish date</label>
          <input type="date" className={inputClass} value={form.publish_date} onChange={e => setForm((f: any) => ({ ...f, publish_date: e.target.value }))} />
        </div>
        <div className="col-span-2">
          <label className={labelClass}>Link to the coverage</label>
          <input type="url" className={inputClass} placeholder="https://…" value={form.url} onChange={e => setForm((f: any) => ({ ...f, url: e.target.value }))} />
        </div>
        <div>
          <label className={labelClass}>Reach (audience/circulation)</label>
          <input type="number" min="0" className={inputClass} value={form.reach} onChange={e => setForm((f: any) => ({ ...f, reach: e.target.value }))} />
        </div>
        <div>
          <label className={labelClass}>Ad Value Equivalent (AED)</label>
          <input type="number" min="0" step="0.01" className={inputClass} value={form.ave} onChange={e => setForm((f: any) => ({ ...f, ave: e.target.value }))} placeholder="What this space would cost as an ad" />
        </div>
        <div className="col-span-2">
          <label className={labelClass}>EMV multiplier</label>
          <input type="number" min="0" step="0.1" className={inputClass} value={form.emv_multiplier} onChange={e => setForm((f: any) => ({ ...f, emv_multiplier: e.target.value }))} />
          <p className="text-[11px] text-gray-400 mt-1">
            Earned Media Value = AVE × multiplier (earned coverage is typically valued 2–10× paid media for credibility).
            {emvPreview != null && <> <strong>EMV: {formatCurrency(emvPreview)}</strong></>}
          </p>
        </div>
        <div className="col-span-2">
          <label className={labelClass}>Notes</label>
          <textarea className={inputClass} rows={2} value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} />
        </div>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
        {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Log Placement'}
      </button>
    </form>
  )
}

export default function MediaPage() {
  const [placements, setPlacements] = useState<any[]>([])
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([])
  const [canWrite, setCanWrite] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const searchParams = useSearchParams()
  const [clientFilter, setClientFilter] = useState(searchParams.get('client') ?? '')
  const [outletFilter, setOutletFilter] = useState('')
  const [sentimentFilter, setSentimentFilter] = useState('')
  const [page, setPage] = useState(1)
  const toast = useToast()

  const load = useCallback(async () => {
    const [pRes, cRes, meRes] = await Promise.all([
      fetch('/api/media-placements'), fetch('/api/clients'), fetch('/api/profiles/me'),
    ])
    const [p, c, me] = await Promise.all([pRes.json(), cRes.json(), meRes.json()])
    setPlacements(Array.isArray(p) ? p : [])
    setClients(Array.isArray(c) ? c : [])
    setCanWrite(!!me?.permissions?.includes('media.write'))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const withEmv = useMemo(() => placements.map(p => ({
    ...p,
    emv: p.ave != null ? Number(p.ave) * Number(p.emv_multiplier ?? 3) : null,
  })), [placements])

  const filtered = useMemo(() => withEmv.filter(p =>
    (!clientFilter || p.client_id === clientFilter) &&
    (!outletFilter || p.outlet_type === outletFilter) &&
    (!sentimentFilter || p.sentiment === sentimentFilter)
  ), [withEmv, clientFilter, outletFilter, sentimentFilter])

  const totals = useMemo(() => filtered.reduce((acc, p) => ({
    emv: acc.emv + (p.emv ?? 0),
    ave: acc.ave + (Number(p.ave) || 0),
    reach: acc.reach + (Number(p.reach) || 0),
  }), { emv: 0, ave: 0, reach: 0 }), [filtered])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const remove = async (id: string) => {
    if (!confirm('Delete this placement? This cannot be undone.')) return
    const res = await fetch(`/api/media-placements/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Placement deleted'); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed to delete') }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Media Coverage</h1>
          <p className="text-gray-500 text-sm mt-0.5">PR placements and their Earned Media Value</p>
        </div>
        {canWrite && (
          <button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
            <Plus className="w-4 h-4" /> Log Placement
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Total EMV</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(totals.emv)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Total AVE</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totals.ave)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><UsersIcon className="w-3 h-3" /> Total Reach</p>
          <p className="text-xl font-bold text-gray-900">{totals.reach.toLocaleString()}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Placements</p>
          <p className="text-xl font-bold text-gray-900">{filtered.length}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
          <select className={`${inputClass} w-auto`} value={clientFilter} onChange={e => { setClientFilter(e.target.value); setPage(1) }}>
            <option value="">All clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
          <select className={`${inputClass} w-auto`} value={outletFilter} onChange={e => { setOutletFilter(e.target.value); setPage(1) }}>
            <option value="">All outlet types</option>
            {Object.entries(OUTLET_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className={`${inputClass} w-auto`} value={sentimentFilter} onChange={e => { setSentimentFilter(e.target.value); setPage(1) }}>
            <option value="">All sentiment</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
        </div>

        {loading ? (
          <div className="px-5 py-16 text-center text-gray-400 text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Placement</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Client</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Outlet</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Date</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Sentiment</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500">Reach</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500">EMV</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visible.length > 0 ? visible.map(p => (
                <tr key={p.id} className="table-row">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{p.title}</p>
                    <p className="text-xs text-gray-400">{PLACEMENT_LABEL[p.placement_type] ?? p.placement_type}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{p.client?.company_name ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {p.outlet_name}
                    <span className="block text-xs text-gray-400">{OUTLET_LABEL[p.outlet_type] ?? p.outlet_type}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(p.publish_date)}</td>
                  <td className="px-5 py-3"><span className={`badge ${SENTIMENT_COLOR[p.sentiment]}`}>{p.sentiment}</span></td>
                  <td className="px-5 py-3 text-right tabular-nums">{p.reach != null ? Number(p.reach).toLocaleString() : '—'}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold text-green-700">{p.emv != null ? formatCurrency(p.emv) : '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {canWrite && (
                        <button onClick={() => { setEditing(p); setShowModal(true) }} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canWrite && (
                        <button onClick={() => remove(p.id)} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <EmptyState
                  colSpan={8}
                  icon={Newspaper}
                  title="No media coverage logged yet"
                  helper="Log a press placement to start tracking its Earned Media Value."
                  action={canWrite ? <button className="btn-primary btn-sm inline-flex" onClick={() => { setEditing(null); setShowModal(true) }}><Plus className="w-3 h-3" /> Log Placement</button> : undefined}
                />
              )}
            </tbody>
          </table></div>
        )}
        <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditing(null) }} title={editing ? 'Edit Placement' : 'Log Placement'} size="xl">
        <PlacementForm clients={clients} initial={editing} onSuccess={() => { setShowModal(false); setEditing(null); load() }} />
      </Modal>
    </div>
  )
}
