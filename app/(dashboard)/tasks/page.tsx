'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, Pencil, Trash2, LayoutGrid, List, Search } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import TaskForm from '@/components/forms/TaskForm'
import Pagination from '@/components/ui/Pagination'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { formatDate, statusColor, statusLabel, getInitials } from '@/lib/utils'

const PAGE_SIZE = 10

const COLUMNS = [
  { key: 'todo',        label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review',      label: 'Review' },
  { key: 'done',        label: 'Done' },
]

const priorityDot: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-gray-300',
}

const today = () => new Date().toISOString().split('T')[0]

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([])
  const [profiles, setProfiles] = useState<{ id: string; full_name: string | null; email: string | null }[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<'board' | 'list'>('board')
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const toast = useToast()

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load tasks')
      setTasks(Array.isArray(data) ? data : [])
      setError('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
    fetch('/api/clients').then(r => r.json()).then(d => setClients(Array.isArray(d) ? d : []))
    fetch('/api/profiles').then(r => r.json()).then(d => setProfiles(Array.isArray(d) ? d : [])).catch(() => {})
  }, [fetchTasks])

  const moveTask = async (taskId: string, status: string) => {
    // Optimistic update so the board feels instant
    setTasks(p => p.map(t => t.id === taskId ? { ...t, status } : t))
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) { toast.error('Failed to move task'); fetchTasks() }
  }

  const deleteTask = async (id: string) => {
    if (!confirm('Delete this task?')) return
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (res.ok) toast.success('Task deleted')
    else toast.error('Failed to delete task')
    fetchTasks()
  }

  const openEdit = (task: any) => { setEditingTask(task); setShowModal(true) }
  const handleClose = () => { setShowModal(false); setEditingTask(null) }
  const handleSuccess = () => { handleClose(); fetchTasks() }

  const isOverdue = (t: any) => t.due_date && t.due_date < today() && t.status !== 'done'

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tasks
    return tasks.filter(t =>
      t.title?.toLowerCase().includes(q) ||
      t.client?.company_name?.toLowerCase().includes(q) ||
      t.assignee?.full_name?.toLowerCase().includes(q)
    )
  }, [tasks, query])

  const listFiltered = useMemo(
    () => statusFilter ? searched.filter(t => t.status === statusFilter) : searched,
    [searched, statusFilter]
  )
  const pageCount = Math.max(1, Math.ceil(listFiltered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const listVisible = listFiltered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const TaskCard = ({ task }: { task: any }) => (
    <div
      draggable
      onDragStart={() => setDragId(task.id)}
      onDragEnd={() => { setDragId(null); setDragOver(null) }}
      onClick={() => openEdit(task)}
      className={`card p-3.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group ${dragId === task.id ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-medium leading-snug ${task.status === 'done' ? 'line-through text-taupe-500' : 'text-ink'}`}>
          {task.title}
        </p>
        <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id) }}
          className="opacity-0 group-hover:opacity-100 text-taupe-500 hover:text-red-500 transition-opacity flex-shrink-0">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      {task.client?.company_name && (
        <p className="text-xs text-taupe-500 mt-1">{task.client.company_name}</p>
      )}
      <div className="flex items-center justify-between mt-2.5">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${priorityDot[task.priority] ?? 'bg-gray-300'}`} title={task.priority} />
          {task.due_date && (
            <span className={`text-xs ${isOverdue(task) ? 'font-semibold' : 'text-taupe-500'}`}
              style={isOverdue(task) ? { color: 'var(--danger)' } : {}}>
              {formatDate(task.due_date)}
            </span>
          )}
        </div>
        {task.assignee && (
          <div className="w-5.5 h-5.5 bg-brand-600 text-paper-100 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ width: 22, height: 22 }} title={task.assignee.full_name}>
            {getInitials(task.assignee.full_name)}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tasks</h1>
          <p className="text-taupe-600 text-sm mt-0.5">
            {tasks.filter(t => t.status !== 'done').length} open · {tasks.filter(isOverdue).length} overdue
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-paper-100 rounded-lg p-0.5">
            <button onClick={() => setView('board')}
              className={`px-2.5 py-1.5 rounded-md transition-colors ${view === 'board' ? 'bg-white shadow-sm text-ink' : 'text-taupe-500'}`}
              title="Board view">
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setView('list')}
              className={`px-2.5 py-1.5 rounded-md transition-colors ${view === 'list' ? 'bg-white shadow-sm text-ink' : 'text-taupe-500'}`}
              title="List view">
              <List className="w-4 h-4" />
            </button>
          </div>
          <button className="btn-primary" onClick={() => { setEditingTask(null); setShowModal(true) }}>
            <Plus className="w-4 h-4" /> New Task
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2.5 rounded-lg text-sm" style={{ color: 'var(--danger)', background: 'var(--danger-bg)' }}>
          Couldn&apos;t load tasks: {error}
        </div>
      )}

      {/* Search + status filter */}
      <div className="card px-4 py-3 mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-4 h-4 text-taupe-500 flex-shrink-0" />
          <input
            className="flex-1 text-sm focus:outline-none bg-transparent placeholder:text-taupe-500"
            placeholder="Search tasks, client, assignee…"
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
            {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="card h-60 animate-pulse bg-paper-100" />)}
        </div>
      ) : view === 'board' ? (
        /* ── Kanban board ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
          {COLUMNS.map(col => {
            const colTasks = searched.filter(t => t.status === col.key)
            return (
              <div key={col.key}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col.key) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => { if (dragId) moveTask(dragId, col.key); setDragId(null); setDragOver(null) }}
                className={`rounded-xl p-2.5 transition-colors min-h-[200px] ${dragOver === col.key ? 'bg-brand-50 ring-2 ring-rose' : 'bg-paper-100'}`}>
                <div className="flex items-center justify-between px-1.5 pb-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-taupe-600">{col.label}</span>
                  <span className="text-xs font-semibold text-taupe-500 bg-paper-200 rounded-full px-2 py-0.5">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.map(task => <TaskCard key={task.id} task={task} />)}
                  {colTasks.length === 0 && (
                    <p className="text-xs text-taupe-500 text-center py-6">Drop tasks here</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── List view ── */
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper-50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-taupe-600">Task</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-taupe-600">Client</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-taupe-600">Assigned To</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-taupe-600">Priority</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-taupe-600">Due Date</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-taupe-600">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-200">
              {listVisible.length > 0 ? listVisible.map((task) => (
                <tr key={task.id} className="hover:bg-paper-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-ink">{task.title}</td>
                  <td className="px-5 py-3 text-taupe-600">{task.client?.company_name ?? '—'}</td>
                  <td className="px-5 py-3">
                    {task.assignee ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-brand-600 text-paper-100 rounded-full flex items-center justify-center text-[10px] font-bold">
                          {getInitials(task.assignee.full_name)}
                        </div>
                        <span className="text-umber-700">{task.assignee.full_name}</span>
                      </div>
                    ) : <span className="text-taupe-500">Unassigned</span>}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${priorityDot[task.priority] ?? 'bg-gray-300'}`} />
                      <span className={`badge ${statusColor(task.priority)}`}>{statusLabel(task.priority)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={isOverdue(task) ? 'font-semibold' : 'text-taupe-600'}
                      style={isOverdue(task) ? { color: 'var(--danger)' } : {}}>
                      {formatDate(task.due_date)}
                    </span>
                  </td>
                  <td className="px-5 py-3"><span className={`badge ${statusColor(task.status)}`}>{statusLabel(task.status)}</span></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(task)} className="w-7 h-7 flex items-center justify-center rounded text-taupe-500 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteTask(task.id)} className="w-7 h-7 flex items-center justify-center rounded text-taupe-500 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <EmptyState
                  colSpan={7}
                  title={tasks.length === 0 ? 'No tasks yet' : 'No tasks match your search'}
                  helper={tasks.length === 0 ? 'Create a task to start tracking work.' : 'Try a different search term or status filter.'}
                  action={tasks.length === 0 ? <button className="btn-primary btn-sm inline-flex" onClick={() => { setEditingTask(null); setShowModal(true) }}><Plus className="w-3 h-3" /> New Task</button> : undefined}
                />
              )}
            </tbody>
          </table>
          <Pagination page={currentPage} pageCount={pageCount} total={listFiltered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={handleClose}
        title={editingTask ? 'Edit Task' : 'New Task'}
        size="lg"
      >
        <TaskForm
          onSuccess={handleSuccess}
          clients={clients}
          profiles={profiles}
          initialData={editingTask ?? undefined}
        />
      </Modal>
    </div>
  )
}
