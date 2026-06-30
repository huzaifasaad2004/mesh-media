'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import TaskForm from '@/components/forms/TaskForm'
import { formatDate, statusColor, statusLabel, getInitials } from '@/lib/utils'

const priorityDot: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-gray-300',
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([])
  const [profiles, setProfiles] = useState<{ id: string; full_name: string | null; email: string | null }[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    const res = await fetch('/api/tasks')
    const data = await res.json()
    setTasks(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTasks()
    fetch('/api/clients').then((r) => r.json()).then((d) => setClients(Array.isArray(d) ? d : []))
    fetch('/api/profiles').then((r) => r.json()).then((d) => setProfiles(Array.isArray(d) ? d : [])).catch(() => {
      // profiles endpoint may not exist yet, try supabase directly
    })
  }, [fetchTasks])

  const deleteTask = async (id: string) => {
    if (!confirm('Delete this task?')) return
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    fetchTasks()
  }

  const openEdit = (task: any) => {
    setEditingTask(task)
    setShowModal(true)
  }

  const handleClose = () => {
    setShowModal(false)
    setEditingTask(null)
  }

  const handleSuccess = () => {
    handleClose()
    fetchTasks()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tasks</h1>
          <p className="text-gray-500 text-sm mt-0.5">{tasks.length} total tasks</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditingTask(null); setShowModal(true) }}>
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="px-5 py-16 text-center text-gray-400 text-sm">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Task</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Client</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Assigned To</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Priority</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Due Date</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tasks.length > 0 ? tasks.map((task) => (
                <tr key={task.id} className="table-row">
                  <td className="px-5 py-3 font-medium text-gray-900">{task.title}</td>
                  <td className="px-5 py-3 text-gray-500">{task.client?.company_name ?? '—'}</td>
                  <td className="px-5 py-3">
                    {task.assignee ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-xs font-bold">
                          {getInitials(task.assignee.full_name)}
                        </div>
                        <span className="text-gray-700">{task.assignee.full_name}</span>
                      </div>
                    ) : <span className="text-gray-400">Unassigned</span>}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${priorityDot[task.priority] ?? 'bg-gray-300'}`} />
                      <span className={`badge ${statusColor(task.priority)}`}>{statusLabel(task.priority)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(task.due_date)}</td>
                  <td className="px-5 py-3"><span className={`badge ${statusColor(task.status)}`}>{statusLabel(task.status)}</span></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(task)} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteTask(task.id)} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-gray-400 text-sm">No tasks yet</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

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
