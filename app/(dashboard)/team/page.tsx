import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'
import { Plus, UserPlus } from 'lucide-react'
import type { Profile } from '@/types/database'

const roleColors: Record<string, string> = {
  admin:  'bg-purple-100 text-purple-700',
  staff:  'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-600',
}

export default async function TeamPage() {
  const supabase = createClient()

  const [{ data: profiles }, { data: salaries }, { data: taskCounts }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('salaries').select('*, profile:profiles(id)').is('effective_to', null),
    supabase.from('tasks').select('assigned_to').neq('status', 'done'),
  ])

  const taskCountByUser = (taskCounts ?? []).reduce((acc: Record<string, number>, t: any) => {
    if (t.assigned_to) acc[t.assigned_to] = (acc[t.assigned_to] ?? 0) + 1
    return acc
  }, {})

  const salaryByUser = (salaries ?? []).reduce((acc: Record<string, any>, s: any) => {
    if (s.profile?.id) acc[s.profile.id] = s
    return acc
  }, {})

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Team</h1>
          <p className="text-gray-500 text-sm mt-0.5">{profiles?.length ?? 0} team members</p>
        </div>
        <button className="btn-primary">
          <UserPlus className="w-4 h-4" /> Invite Member
        </button>
      </div>

      {/* Role overview */}
      <div className="flex gap-3 mb-6">
        {['admin', 'staff', 'viewer'].map((role) => (
          <div key={role} className="card px-4 py-2.5 flex items-center gap-2.5">
            <span className={`badge ${roleColors[role]}`}>{role}</span>
            <span className="text-sm font-semibold text-gray-800">
              {profiles?.filter((p: Profile) => p.role === role).length ?? 0}
            </span>
          </div>
        ))}
      </div>

      {/* Team grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {profiles && (profiles as Profile[]).map((member) => {
          const salary = salaryByUser[member.id]
          const openTasks = taskCountByUser[member.id] ?? 0
          return (
            <div key={member.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0">
                  {getInitials(member.full_name ?? member.email)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 truncate">{member.full_name ?? 'No name'}</p>
                    <span className={`badge ${roleColors[member.role]}`}>{member.role}</span>
                  </div>
                  <p className="text-sm text-gray-500 truncate mt-0.5">{member.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-center">
                  <p className="text-lg font-bold text-gray-900">{openTasks}</p>
                  <p className="text-xs text-gray-500">Open Tasks</p>
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-center">
                  <p className="text-sm font-bold text-gray-900">
                    {salary ? formatCurrency(salary.amount) : '—'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {salary ? `per ${salary.pay_period.replace('ly', '')}` : 'No salary set'}
                  </p>
                </div>
              </div>

              {salary && (
                <p className="text-xs text-gray-400 mt-3">Salary from {formatDate(salary.effective_from)}</p>
              )}

              <div className="flex gap-2 mt-4">
                <button className="btn-secondary btn-sm flex-1 justify-center">Edit</button>
                {!salary && (
                  <button className="btn-ghost btn-sm flex-1 justify-center">Set Salary</button>
                )}
              </div>
            </div>
          )
        })}

        {/* Invite card */}
        <div className="card p-5 border-dashed border-2 border-gray-200 bg-gray-50 flex flex-col items-center justify-center text-center min-h-[180px] hover:border-brand-300 hover:bg-brand-50 transition-colors cursor-pointer">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mb-3">
            <Plus className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-500">Invite team member</p>
          <p className="text-xs text-gray-400 mt-1">Send an email invite</p>
        </div>
      </div>
    </div>
  )
}
