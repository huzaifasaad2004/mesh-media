'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, Pencil, Trash2, LayoutGrid, List, Search, SlidersHorizontal, X, Images } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import TaskForm from '@/components/forms/TaskForm'
import TaskComments from '@/components/tasks/TaskComments'
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

const dateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const today = () => dateKey(new Date())

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
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [dueFilter, setDueFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [page, setPage] = useState(1)
  const [canManage, setCanManage] = useState(false)
  const [meId, setMeId] = useState('')
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
    fetch('/api/profiles/me').then(r => r.json()).then(d => {
      setMeId(d.id ?? '')
      setCanManage(['owner', 'admin', 'manager'].includes(d.role))
    }).catch(() => {})
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const todayKey = dateKey(new Date())
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    const nextWeekKey = dateKey(nextWeek)

    return tasks.filter(t => {
      const matchesSearch = !q || t.title?.toLowerCase().includes(q) ||
        t.client?.company_name?.toLowerCase().includes(q) ||
        t.assignee?.full_name?.toLowerCase().includes(q)
      const matchesStatus = !statusFilter ||
        (statusFilter === 'open' ? t.status !== 'done' : t.status === statusFilter)
      const matchesAssignee = !assigneeFilter ||
        (assigneeFilter === 'me' ? t.assigned_to === meId :
          assigneeFilter === 'unassigned' ? !t.assigned_to : t.assigned_to === assigneeFilter)
      const matchesPriority = !priorityFilter || t.priority === priorityFilter
      const matchesClient = !clientFilter || t.client_id === clientFilter
      const matchesDue = !dueFilter ||
        (dueFilter === 'overdue' ? t.due_date && t.due_date < todayKey && t.status !== 'done' :
          dueFilter === 'today' ? t.due_date === todayKey :
            dueFilter === 'next7' ? t.due_date && t.due_date >= todayKey && t.due_date <= nextWeekKey :
              dueFilter === 'no_date' ? !t.due_date : true)
      return matchesSearch && matchesStatus && matchesAssignee && matchesPriority && matchesClient && matchesDue
    })
  }, [tasks, query, statusFilter, assigneeFilter, priorityFilter, dueFilter, clientFilter, meId])

  const activeFilterCount = [statusFilter, assigneeFilter, priorityFilter, dueFilter, clientFilter].filter(Boolean).length
  const clearFilters = () => {
    setQuery(''); setStatusFilter(''); setAssigneeFilter(''); setPriorityFilter(''); setDueFilter(''); setClientFilter(''); setPage(1)
  }
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const listVisible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

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
        {canManage && (
          <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id) }}
            className="opacity-0 group-hover:opacity-100 text-taupe-500 hover:text-red-500 transition-opacity flex-shrink-0">
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
      {task.client?.company_name && (
        <p className="text-xs text-taupe-500 mt-1">{task.client.company_name}</p>
      )}
      {task.attachments?.length > 0 && (
        <div className="flex items-center gap-1 mt-2 text-[11px] text-brand-700">
          <Images className="w-3.5 h-3.5" />
          {task.attachments.length} reference {task.attachments.length === 1 ? 'image' : 'images'}
        </div>
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
          <div className="w-5.5 h-5.5 bg-brand-600 text-paper-100 rounded-full flex items-center justify-center text-[10px] font-bold overflow-hidden"
            style={{ width: 22, height: 22 }} title={task.assignee.full_name}>
            {task.assignee.avatar_url ? <img src={task.assignee.avatar_url} alt="" className="w-full h-full object-cover" /> : getInitials(task.assignee.full_name)}
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
          {canManage && (
            <button className="btn-primary" onClick={() => { setEditingTask(null); setShowModal(true) }}>
              <Plus className="w-4 h-4" /> New Task
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2.5 rounded-lg text-sm" style={{ color: 'var(--danger)', background: 'var(--danger-bg)' }}>
          Couldn&apos;t load tasks: {error}
        </div>
      )}

      {/* Unified filters — these apply to both board and list views. */}
      <div className="card px-4 py-3 mb-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-taupe-500 flex-shrink-0" />
          <input
            className="flex-1 text-sm focus:outline-none bg-transparent placeholder:text-taupe-500"
            placeholder="Search tasks, client, assignee…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
          />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-taupe-500">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Showing <span className="font-semibold text-ink">{filtered.length}</span> of {tasks.length}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
          <select value={assigneeFilter} onChange={e => { setAssigneeFilter(e.target.value); setPage(1) }} className="border border-sand-300 rounded-lg px-2.5 py-2 text-xs text-umber-700 bg-white min-w-0" aria-label="Filter by assignee">
            <option value="">All assignees</option>
            <option value="me">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
            {profiles.filter(p => p.id !== meId).map(p => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="border border-sand-300 rounded-lg px-2.5 py-2 text-xs text-umber-700 bg-white min-w-0" aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="open">Open / Pending</option>
            {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.key === 'done' ? 'Completed' : c.label}</option>)}
          </select>
          <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1) }} className="border border-sand-300 rounded-lg px-2.5 py-2 text-xs text-umber-700 bg-white min-w-0" aria-label="Filter by priority">
            <option value="">All priorities</option>
            <option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
          <select value={dueFilter} onChange={e => { setDueFilter(e.target.value); setPage(1) }} className="border border-sand-300 rounded-lg px-2.5 py-2 text-xs text-umber-700 bg-white min-w-0" aria-label="Filter by due date">
            <option value="">Any due date</option>
            <option value="overdue">Overdue</option><option value="today">Due today</option><option value="next7">Next 7 days</option><option value="no_date">No due date</option>
          </select>
          <select value={clientFilter} onChange={e => { setClientFilter(e.target.value); setPage(1) }} className="border border-sand-300 rounded-lg px-2.5 py-2 text-xs text-umber-700 bg-white min-w-0" aria-label="Filter by client">
            <option value="">All clients</option>
            {clients.map(client => <option key={client.id} value={client.id}>{client.company_name}</option>)}
          </select>
          <button onClick={clearFilters} disabled={!query && activeFilterCount === 0} className="border border-sand-300 rounded-lg px-2.5 py-2 text-xs text-taupe-600 hover:text-brand-600 hover:border-brand-300 disabled:opacity-40 disabled:hover:text-taupe-600 flex items-center justify-center gap-1.5 transition-colors">
            <X className="w-3.5 h-3.5" /> Clear filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="card h-60 animate-pulse bg-paper-100" />)}
        </div>
      ) : view === 'board' ? (
        /* ── Kanban board ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
          {COLUMNS.map(col => {
            const colTasks = filtered.filter(t => t.status === col.key)
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
                    <p className="text-xs text-taupe-500 text-center py-6">{query || activeFilterCount > 0 ? 'No matching tasks' : 'Drop tasks here'}</p>
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
                  <td className="px-5 py-3 font-medium text-ink">
                    <div className="flex items-center gap-2">
                      <span>{task.title}</span>
                      {task.attachments?.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-brand-700 bg-brand-50 rounded-full px-1.5 py-0.5" title={`${task.attachments.length} reference images`}>
                          <Images className="w-3 h-3" /> {task.attachments.length}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-taupe-600">{task.client?.company_name ?? '—'}</td>
                  <td className="px-5 py-3">
                    {task.assignee ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-brand-600 text-paper-100 rounded-full flex items-center justify-center text-[10px] font-bold overflow-hidden">
                          {task.assignee.avatar_url ? <img src={task.assignee.avatar_url} alt="" className="w-full h-full object-cover" /> : getInitials(task.assignee.full_name)}
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
                      {canManage && (
                        <button onClick={() => deleteTask(task.id)} className="w-7 h-7 flex items-center justify-center rounded text-taupe-500 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <EmptyState
                  colSpan={7}
                  title={tasks.length === 0 ? 'No tasks yet' : 'No tasks match these filters'}
                  helper={tasks.length === 0 ? (canManage ? 'Create a task to start tracking work.' : 'No tasks are assigned to you yet.') : 'Clear or adjust a filter to see more tasks.'}
                  action={tasks.length === 0 && canManage ? <button className="btn-primary btn-sm inline-flex" onClick={() => { setEditingTask(null); setShowModal(true) }}><Plus className="w-3 h-3" /> New Task</button> : undefined}
                />
              )}
            </tbody>
          </table>
          <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={handleClose}
        title={editingTask ? 'Edit Task' : 'New Task'}
        size="lg"
      >
        <TaskForm
          key={editingTask?.id ?? 'new'}
          onSuccess={handleSuccess}
          clients={clients}
          profiles={profiles}
          initialData={editingTask ?? undefined}
          statusOnly={!canManage}
        />
        {editingTask?.id && <TaskComments taskId={editingTask.id} />}
      </Modal>
    </div>
  )
}
