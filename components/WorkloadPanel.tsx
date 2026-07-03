'use client'

import { useEffect, useState } from 'react'
import { getInitials } from '@/lib/utils'
import { Users2 } from 'lucide-react'

function fmt(mins: number) {
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function WorkloadPanel() {
  const [rows, setRows] = useState<any[] | null>(null)

  useEffect(() => {
    fetch('/api/workload').then(async r => {
      if (!r.ok) { setRows([]); return }
      setRows(await r.json())
    }).catch(() => setRows([]))
  }, [])

  // Hidden entirely for non-managers or when empty
  if (!rows || rows.length === 0) return null

  const maxTasks = Math.max(1, ...rows.map(r => r.open_tasks))

  return (
    <div className="card mb-6">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-paper-200">
        <Users2 className="w-4 h-4 text-taupe-500" />
        <h3>Team workload · this week</h3>
      </div>
      <div className="divide-y divide-paper-200">
        {rows.map(r => (
          <div key={r.id} className="px-5 py-3 flex items-center gap-4">
            <div className="w-8 h-8 bg-brand-600 text-paper-100 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
              {getInitials(r.full_name ?? r.email)}
            </div>
            <div className="w-40 min-w-0">
              <p className="text-sm font-medium text-ink truncate">{r.full_name ?? r.email}</p>
              <p className="text-xs text-taupe-500 capitalize">{r.role}</p>
            </div>
            <div className="flex-1">
              <div className="h-2 bg-paper-200 rounded-full overflow-hidden">
                <div className="h-full bg-brand-600 rounded-full" style={{ width: `${(r.open_tasks / maxTasks) * 100}%` }} />
              </div>
            </div>
            <span className="text-sm text-umber-700 w-24 text-right tabular-nums">{r.open_tasks} open</span>
            <span className="text-sm text-taupe-600 w-20 text-right tabular-nums">{fmt(r.week_minutes)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
