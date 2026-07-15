'use client'

import { useEffect, useMemo, useState, useCallback, type ReactNode } from 'react'
import { Plus, BookOpen, Search, Trash2, Pencil, Eye, Send, ArrowLeft } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

// Minimal, dependency-free renderer for staff-authored SOP content. Never
// uses dangerouslySetInnerHTML — everything stays plain React text nodes,
// so there's no HTML-injection surface even though authors aren't limited
// to plain prose (## headings, - bullets, blank-line paragraphs).
function renderContent(content: string): ReactNode {
  const lines = content.split('\n')
  const blocks: ReactNode[] = []
  let listBuffer: string[] = []

  const flushList = (key: string) => {
    if (listBuffer.length === 0) return
    blocks.push(
      <ul key={key} className="list-disc pl-5 space-y-1 my-2">
        {listBuffer.map((item, i) => <li key={i} className="text-sm text-gray-700">{item}</li>)}
      </ul>
    )
    listBuffer = []
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('- ')) {
      listBuffer.push(trimmed.slice(2))
      return
    }
    flushList(`list-${i}`)
    if (trimmed.startsWith('## ')) {
      blocks.push(<h3 key={i} className="text-base font-semibold text-ink mt-4 mb-1.5" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{trimmed.slice(3)}</h3>)
    } else if (trimmed.startsWith('# ')) {
      blocks.push(<h2 key={i} className="text-lg font-semibold text-ink mt-4 mb-2" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{trimmed.slice(2)}</h2>)
    } else if (trimmed) {
      blocks.push(<p key={i} className="text-sm text-gray-700 leading-relaxed my-1.5">{trimmed}</p>)
    }
  })
  flushList('list-end')
  return blocks
}

const emptyForm = { title: '', category: 'General', content: '', status: 'draft' as 'draft' | 'published' }

function ArticleEditor({ initial, onSuccess }: { initial?: any; onSuccess: () => void }) {
  const [form, setForm] = useState(initial ? { title: initial.title, category: initial.category, content: initial.content, status: initial.status } : emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async (status?: 'draft' | 'published') => {
    setSaving(true); setError('')
    const payload = status ? { ...form, status } : form
    const isEdit = !!initial?.id
    const res = await fetch(isEdit ? `/api/kb/${initial.id}` : '/api/kb', {
      method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
    onSuccess()
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Title *</label>
        <input className={inputClass} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
      </div>
      <div>
        <label className={labelClass}>Category</label>
        <input className={inputClass} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Client Ops, Finance, Brand, HR" />
      </div>
      <div>
        <label className={labelClass}>Content</label>
        <textarea className={inputClass} rows={12} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          placeholder={'# Heading\n## Subheading\n- Bullet point\n\nPlain paragraph text.'} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }} />
        <p className="text-[11px] text-gray-400 mt-1">Simple formatting: "# " and "## " for headings, "- " for bullets, blank lines between paragraphs.</p>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => save('draft')} className="btn-secondary flex-1 justify-center" disabled={saving || !form.title.trim()}>
          Save as draft
        </button>
        <button onClick={() => save('published')} className="btn-primary flex-1 justify-center" disabled={saving || !form.title.trim()}>
          <Send className="w-3.5 h-3.5" /> {form.status === 'published' ? 'Save & keep published' : 'Publish'}
        </button>
      </div>
    </div>
  )
}

export default function KnowledgeBasePage() {
  const [articles, setArticles] = useState<any[]>([])
  const [canWrite, setCanWrite] = useState(false)
  const [myId, setMyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [reading, setReading] = useState<any | null>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    const [aRes, meRes] = await Promise.all([fetch('/api/kb'), fetch('/api/profiles/me')])
    const [a, me] = await Promise.all([aRes.json(), meRes.json()])
    setArticles(Array.isArray(a) ? a : [])
    setCanWrite(!!me?.permissions?.includes('kb.write'))
    setMyId(me?.id ?? '')
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const categories = useMemo(() => Array.from(new Set(articles.map(a => a.category))).sort(), [articles])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return articles.filter(a => {
      if (categoryFilter && a.category !== categoryFilter) return false
      if (!q) return true
      return a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q)
    })
  }, [articles, query, categoryFilter])

  const remove = async (id: string) => {
    if (!confirm('Delete this article? This cannot be undone.')) return
    const res = await fetch(`/api/kb/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Article deleted'); setReading(null); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed to delete') }
  }

  const canEdit = (a: any) => canWrite || a.created_by === myId

  if (reading) {
    return (
      <div className="max-w-3xl">
        <button onClick={() => setReading(null)} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Knowledge Base
        </button>
        <div className="card p-6">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h1 className="mb-0">{reading.title}</h1>
            {reading.status === 'draft' && <span className="badge bg-yellow-100 text-yellow-700 flex-shrink-0">Draft</span>}
          </div>
          <p className="text-xs text-gray-400 mb-4">
            {reading.category} · updated {formatDate(reading.updated_at)} by {reading.updater?.full_name ?? reading.creator?.full_name ?? 'someone'}
          </p>
          {reading.content?.trim() ? renderContent(reading.content) : <p className="text-sm text-gray-400">No content yet.</p>}
          {canEdit(reading) && (
            <div className="flex gap-2 mt-6 pt-4 border-t border-gray-100">
              <button onClick={() => { setEditing(reading); setShowEditor(true) }} className="btn-secondary btn-sm">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
              <button onClick={() => remove(reading.id)} className="btn-secondary btn-sm text-red-600">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
        <Modal isOpen={showEditor} onClose={() => setShowEditor(false)} title="Edit Article" size="xl">
          <ArticleEditor initial={editing} onSuccess={async () => { setShowEditor(false); await load(); setReading(null) }} />
        </Modal>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Knowledge Base</h1>
          <p className="text-gray-500 text-sm mt-0.5">Internal SOPs and how-tos — published articles are searchable by Aether too</p>
        </div>
        {canWrite && (
          <button className="btn-primary" onClick={() => { setEditing(null); setShowEditor(true) }}>
            <Plus className="w-4 h-4" /> New Article
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-gray-400" />
            <input className="flex-1 text-sm focus:outline-none bg-transparent placeholder:text-gray-400" placeholder="Search articles…"
              value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          {categories.length > 0 && (
            <select className={`${inputClass} w-auto`} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>

        {loading ? (
          <div className="px-5 py-16 text-center text-gray-400 text-sm">Loading…</div>
        ) : filtered.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {filtered.map(a => (
              <button key={a.id} onClick={() => setReading(a)} className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <p className="text-sm font-medium text-gray-900 truncate">{a.title}</p>
                    {a.status === 'draft' && <span className="badge bg-yellow-100 text-yellow-700 flex-shrink-0">Draft</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{a.category} · updated {formatDate(a.updated_at)}</p>
                </div>
                <Eye className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-1" />
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={BookOpen}
            title={articles.length === 0 ? 'No articles yet' : 'No articles match your search'}
            helper={articles.length === 0 ? 'Write your first SOP or how-to for the team.' : 'Try a different search term or category.'}
            action={canWrite && articles.length === 0 ? <button className="btn-primary btn-sm inline-flex" onClick={() => { setEditing(null); setShowEditor(true) }}><Plus className="w-3 h-3" /> New Article</button> : undefined}
          />
        )}
      </div>

      <Modal isOpen={showEditor} onClose={() => setShowEditor(false)} title={editing ? 'Edit Article' : 'New Article'} size="xl">
        <ArticleEditor initial={editing} onSuccess={() => { setShowEditor(false); setEditing(null); load() }} />
      </Modal>
    </div>
  )
}
