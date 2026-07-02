'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, Trash2, CheckSquare, FileText, FolderOpen, Eye, Activity } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import ProjectForm from '@/components/forms/ProjectForm'
import { statusColor, statusLabel, formatDate, formatCurrency } from '@/lib/utils'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [project, setProject] = useState<any>(null)
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showEdit, setShowEdit] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [pRes, cRes] = await Promise.all([fetch(`/api/projects/${id}`), fetch('/api/clients')])
      const [pData, cData] = await Promise.all([pRes.json(), cRes.json()])
      if (!pRes.ok) throw new Error(pData.error ?? 'Failed to load project')
      setProject(pData)
      setClients(Array.isArray(cData) ? cData : [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const deleteProject = async () => {
    if (!confirm('Delete this project? Tasks, invoices and files stay but lose the link.')) return
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    router.push('/projects')
  }

  if (loading) return <div className="card h-60 animate-pulse bg-paper-100" />
  if (error || !project) return (
    <div className="card px-6 py-16 text-center">
      <p className="text-sm" style={{ color: 'var(--danger)' }}>{error || 'Project not found'}</p>
      <Link href="/projects" className="btn-secondary btn-sm mt-4 inline-flex">Back to projects</Link>
    </div>
  )

  const tasks = project.tasks ?? []
  const doneCount = tasks.filter((t: any) => t.status === 'done').length
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0

  // Unified activity feed — everything on this project, newest first
  const timeline = [
    ...tasks.map((t: any) => ({
      date: t.created_at, icon: CheckSquare,
      text: `Task "${t.title}" ${t.status === 'done' ? 'completed' : `created (${statusLabel(t.status)})`}`,
    })),
    ...(project.invoices ?? []).map((i: any) => ({
      date: i.issue_date, icon: FileText,
      text: `Invoice ${i.invoice_number} · ${formatCurrency(i.total)} (${statusLabel(i.status)})`,
    })),
    ...(project.files ?? []).map((f: any) => ({
      date: f.created_at, icon: FolderOpen,
      text: `File uploaded: ${f.name}`,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20)

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/projects" className="text-taupe-500 hover:text-umber-700"><ArrowLeft className="w-4 h-4" /></Link>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="truncate">{project.name}</h1>
              <span className={`badge ${statusColor(project.status)}`}>{statusLabel(project.status)}</span>
            </div>
            <p className="text-taupe-600 text-sm mt-0.5">
              {project.client ? <Link href={`/clients/${project.client.id}`} className="hover:text-brand-600">{project.client.company_name}</Link> : 'Internal project'}
              {project.start_date && ` · ${formatDate(project.start_date)}`}
              {project.end_date && ` → ${formatDate(project.end_date)}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary btn-sm" onClick={() => setShowEdit(true)}><Pencil className="w-3 h-3" /> Edit</button>
          <button className="btn-ghost btn-sm text-red-500" onClick={deleteProject}><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>

      {project.description && (
        <div className="card p-5 mb-4">
          <p className="text-sm text-umber-700 whitespace-pre-wrap">{project.description}</p>
        </div>
      )}

      {/* Progress */}
      <div className="card p-5 mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium text-ink">Progress</span>
          <span className="text-taupe-600">{doneCount}/{tasks.length} tasks done · {progress}%</span>
        </div>
        <div className="h-2 bg-paper-200 rounded-full overflow-hidden">
          <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tasks */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-paper-200">
            <h3>Tasks</h3>
            <Link href="/tasks" className="text-xs text-brand-600 hover:underline font-medium">Open board</Link>
          </div>
          <div className="divide-y divide-paper-200 max-h-80 overflow-y-auto">
            {tasks.length > 0 ? tasks.map((t: any) => (
              <div key={t.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${t.status === 'done' ? 'line-through text-taupe-500' : 'text-ink'}`}>{t.title}</p>
                  {t.assignee?.full_name && <p className="text-xs text-taupe-500 mt-0.5">{t.assignee.full_name}</p>}
                </div>
                <span className={`badge ${statusColor(t.status)} flex-shrink-0`}>{statusLabel(t.status)}</span>
              </div>
            )) : <p className="px-5 py-8 text-center text-sm text-taupe-500">No tasks linked yet</p>}
          </div>
        </div>

        {/* Invoices */}
        <div className="card">
          <div className="px-5 py-3.5 border-b border-paper-200"><h3>Invoices</h3></div>
          <div className="divide-y divide-paper-200 max-h-80 overflow-y-auto">
            {(project.invoices ?? []).length > 0 ? project.invoices.map((inv: any) => (
              <div key={inv.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-brand-600">{inv.invoice_number}</p>
                  <p className="text-xs text-taupe-500 mt-0.5">{formatDate(inv.issue_date)}</p>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(inv.total)}</span>
                <span className={`badge ${statusColor(inv.status)}`}>{statusLabel(inv.status)}</span>
                <a href={`/invoice/${inv.id}`} target="_blank" rel="noopener noreferrer"
                  className="w-7 h-7 flex items-center justify-center rounded text-taupe-500 hover:text-brand-600 hover:bg-brand-50">
                  <Eye className="w-3.5 h-3.5" />
                </a>
              </div>
            )) : <p className="px-5 py-8 text-center text-sm text-taupe-500">No invoices linked yet</p>}
          </div>
        </div>

        {/* Files */}
        <div className="card">
          <div className="px-5 py-3.5 border-b border-paper-200"><h3>Files</h3></div>
          <div className="p-5">
            {(project.files ?? []).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {project.files.map((f: any) => (
                  <a key={f.id} href={f.drive_url ?? '#'} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-paper-100 border border-sand-300 rounded-lg px-3 py-2 text-xs text-umber-700 hover:border-brand-300 transition-colors">
                    <FolderOpen className="w-3.5 h-3.5" /> {f.name}
                  </a>
                ))}
              </div>
            ) : <p className="py-4 text-center text-sm text-taupe-500">No files linked yet</p>}
          </div>
        </div>

        {/* Activity feed */}
        <div className="card">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-paper-200">
            <Activity className="w-4 h-4 text-taupe-500" /><h3>Activity</h3>
          </div>
          <div className="divide-y divide-paper-200 max-h-80 overflow-y-auto">
            {timeline.length > 0 ? timeline.map((item, i) => (
              <div key={i} className="px-5 py-3 flex items-start gap-3">
                <item.icon className="w-3.5 h-3.5 text-taupe-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-umber-700">{item.text}</p>
                  <p className="text-xs text-taupe-500 mt-0.5">{formatDate(item.date)}</p>
                </div>
              </div>
            )) : <p className="px-5 py-8 text-center text-sm text-taupe-500">Nothing yet</p>}
          </div>
        </div>
      </div>

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title={`Edit ${project.name}`}>
        <ProjectForm
          onSuccess={() => { setShowEdit(false); fetchData() }}
          clients={clients}
          initialData={project}
        />
      </Modal>
    </div>
  )
}
