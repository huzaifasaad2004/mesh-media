'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, FolderKanban } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import ProjectForm from '@/components/forms/ProjectForm'
import { statusColor, statusLabel, formatDate } from '@/lib/utils'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<string>('all')

  const fetchData = useCallback(async () => {
    try {
      const [pRes, cRes] = await Promise.all([fetch('/api/projects'), fetch('/api/clients')])
      const [pData, cData] = await Promise.all([pRes.json(), cRes.json()])
      if (!pRes.ok) throw new Error(pData.error ?? 'Failed to load projects')
      setProjects(Array.isArray(pData) ? pData : [])
      setClients(Array.isArray(cData) ? cData : [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = filter === 'all' ? projects : projects.filter(p => p.status === filter)

  const progressOf = (p: any) => {
    const tasks = p.tasks ?? []
    if (tasks.length === 0) return null
    return Math.round((tasks.filter((t: any) => t.status === 'done').length / tasks.length) * 100)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p className="text-taupe-600 text-sm mt-0.5">{projects.length} total · {projects.filter(p => p.status === 'active').length} active</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'active', 'paused', 'completed', 'cancelled'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              filter === s ? 'bg-brand-600 text-paper-100' : 'bg-paper-100 text-umber-700 hover:bg-paper-200'
            }`}>
            {s}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 px-4 py-2.5 rounded-lg text-sm" style={{ color: 'var(--danger)', background: 'var(--danger-bg)' }}>{error}</div>}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="card h-40 animate-pulse bg-paper-100" />)}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => {
            const progress = progressOf(p)
            const openTasks = (p.tasks ?? []).filter((t: any) => t.status !== 'done').length
            return (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <div className="card p-5 hover:shadow-md transition-shadow cursor-pointer h-full">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-ink leading-snug">{p.name}</h3>
                    <span className={`badge ${statusColor(p.status)} flex-shrink-0`}>{statusLabel(p.status)}</span>
                  </div>
                  <p className="text-sm text-taupe-600 mb-3">{p.client?.company_name ?? 'Internal'}</p>
                  {progress !== null ? (
                    <>
                      <div className="flex justify-between text-xs text-taupe-600 mb-1.5">
                        <span>{openTasks} open task{openTasks === 1 ? '' : 's'}</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-paper-200 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-taupe-500">No tasks yet</p>
                  )}
                  {p.end_date && (
                    <p className="text-xs text-taupe-500 mt-3">Due {formatDate(p.end_date)}</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="card px-6 py-16 text-center">
          <FolderKanban className="w-10 h-10 mx-auto mb-3 text-sand-400" />
          <p className="font-semibold text-ink mb-1" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 20 }}>No projects yet</p>
          <p className="text-sm text-taupe-600 mb-4">Projects link your clients, tasks, invoices and files together.</p>
          <button className="btn-primary inline-flex" onClick={() => { setEditing(null); setShowModal(true) }}>
            <Plus className="w-4 h-4" /> Create your first project
          </button>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditing(null) }} title={editing ? `Edit ${editing.name}` : 'New Project'}>
        <ProjectForm
          key={editing?.id ?? 'new'}
          onSuccess={() => { setShowModal(false); setEditing(null); fetchData() }}
          clients={clients}
          initialData={editing ?? undefined}
        />
      </Modal>
    </div>
  )
}
