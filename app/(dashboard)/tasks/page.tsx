import { createClient } from '@/lib/supabase/server'
import { formatDate, statusColor, statusLabel, getInitials } from '@/lib/utils'
import { Plus } from 'lucide-react'
import type { Task } from '@/types/database'

const COLUMNS: { status: Task['status']; label: string; color: string }[] = [
  { status: 'todo',        label: 'To Do',       color: 'bg-gray-200' },
  { status: 'in_progress', label: 'In Progress',  color: 'bg-blue-400' },
  { status: 'review',      label: 'Review',       color: 'bg-purple-400' },
  { status: 'done',        label: 'Done',         color: 'bg-green-400' },
]

const priorityDot: Record<string, string> = {
  urgent: 'bg-red-500',
  high:   'bg-orange-400',
  medium: 'bg-yellow-400',
  low:    'bg-gray-300',
}

export default async function TasksPage() {
  const supabase = createClient()
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, assignee:profiles(full_name, avatar_url), client:clients(company_name)')
    .order('created_at', { ascending: false })

  const tasksByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.status] = (tasks as Task[] | null)?.filter((t) => t.status === col.status) ?? []
    return acc
  }, {} as Record<string, Task[]>)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tasks</h1>
          <p className="text-gray-500 text-sm mt-0.5">{tasks?.length ?? 0} total tasks</p>
        </div>
        <button className="btn-primary">
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {COLUMNS.map(({ status, label, color }) => {
          const colTasks = tasksByStatus[status] as any[]
          return (
            <div key={status} className="card overflow-hidden">
              {/* Column header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${color} flex-shrink-0`} />
                <span className="text-sm font-semibold text-gray-700">{label}</span>
                <span className="ml-auto text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{colTasks.length}</span>
              </div>

              {/* Tasks */}
              <div className="p-2 space-y-2 min-h-[200px]">
                {colTasks.length > 0 ? colTasks.map((task) => (
                  <div key={task.id} className="bg-white border border-gray-150 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium text-gray-900 leading-snug">{task.title}</p>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${priorityDot[task.priority] ?? 'bg-gray-300'}`} title={task.priority} />
                    </div>
                    {task.client && (
                      <p className="text-xs text-gray-400 mb-2">{task.client.company_name}</p>
                    )}
                    <div className="flex items-center justify-between">
                      {task.due_date && (
                        <span className="text-xs text-gray-400">{formatDate(task.due_date)}</span>
                      )}
                      {task.assignee && (
                        <div className="w-5 h-5 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-xs font-bold ml-auto" title={task.assignee.full_name ?? ''}>
                          {getInitials(task.assignee.full_name)}
                        </div>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="flex items-center justify-center h-24 text-xs text-gray-300">
                    No tasks
                  </div>
                )}
              </div>

              {/* Add task */}
              <div className="px-2 py-2 border-t border-gray-50">
                <button className="w-full text-left text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded hover:bg-gray-50 transition-colors flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add task
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* List view */}
      <div className="card mt-6 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3>All Tasks</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Task</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Client</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Assigned To</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Priority</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Due Date</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {tasks && (tasks as any[]).map((task) => (
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
                <td className="px-5 py-3"><span className={`badge ${statusColor(task.priority)}`}>{statusLabel(task.priority)}</span></td>
                <td className="px-5 py-3 text-gray-500">{formatDate(task.due_date)}</td>
                <td className="px-5 py-3"><span className={`badge ${statusColor(task.status)}`}>{statusLabel(task.status)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
