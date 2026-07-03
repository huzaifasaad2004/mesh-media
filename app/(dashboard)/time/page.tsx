'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Play, Square, Plus, Trash2, Clock, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const inputClass = 'w-full border border-sand-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose focus:border-transparent'

function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
function fmtClock(secs: number) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':')
}
function startOfWeek() {
  const d = new Date()
  const day = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - day)
  return d.toISOString().split('T')[0]
}

export default function TimePage() {
  const [entries, setEntries] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [running, setRunning] = useState<any | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [desc, setDesc] = useState('')
  const [projectId, setProjectId] = useState('')
  const [taskId, setTaskId] = useState('')
  const [billable, setBillable] = useState(true)
  const [manualMins, setManualMins] = useState('')
  const [busy, setBusy] = useState(false)
  const tick = useRef<any>(null)

  const load = useCallback(async () => {
    const [eRes, tRes, pRes, tkRes] = await Promise.all([
      fetch(`/api/time?since=${startOfWeek()}`),
      fetch('/api/time/timer'),
      fetch('/api/projects'),
      fetch('/api/tasks'),
    ])
    const [e, t, p, tk] = await Promise.all([eRes.json(), tRes.json(), pRes.json(), tkRes.json()])
    setEntries(Array.isArray(e) ? e : [])
    setRunning(t ?? null)
    setProjects(Array.isArray(p) ? p : [])
    setTasks(Array.isArray(tk) ? tk : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // live clock for the running timer
  useEffect(() => {
    if (running?.started_at) {
      const update = () => setElapsed(Math.floor((Date.now() - new Date(running.started_at).getTime()) / 1000))
      update()
      tick.current = setInterval(update, 1000)
      return () => clearInterval(tick.current)
    } else {
      setElapsed(0)
    }
  }, [running])

  const startTimer = async () => {
    setBusy(true)
    const res = await fetch('/api/time/timer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc, project_id: projectId, task_id: taskId, billable }),
    })
    const d = await res.json()
    setBusy(false)
    if (res.ok) { setRunning(d); setDesc(''); load() }
  }

  const stopTimer = async () => {
    setBusy(true)
    await fetch('/api/time/timer', { method: 'PATCH' })
    setBusy(false)
    setRunning(null)
    load()
  }

  const addManual = async () => {
    const mins = Math.round(Number(manualMins) || 0)
    if (mins <= 0) return
    setBusy(true)
    await fetch('/api/time', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc, project_id: projectId, task_id: taskId, billable, minutes: mins }),
    })
    setBusy(false)
    setDesc(''); setManualMins('')
    load()
  }

  const del = async (id: string) => {
    await fetch(`/api/time/${id}`, { method: 'DELETE' })
    load()
  }

  const logged = entries.filter(e => e.ended_at) // exclude running
  const weekMins = logged.reduce((s, e) => s + e.minutes, 0)
  const billableMins = logged.filter(e => e.billable).reduce((s, e) => s + e.minutes, 0)

  // billable rollup by project
  const byProject = Object.values(logged.reduce((acc: Record<string, any>, e) => {
    const key = e.project?.name ?? e.client?.company_name ?? 'Unassigned'
    if (!acc[key]) acc[key] = { name: key, total: 0, billable: 0 }
    acc[key].total += e.minutes
    if (e.billable) acc[key].billable += e.minutes
    return acc
  }, {})).sort((a: any, b: any) => b.total - a.total)

  const availTasks = projectId ? tasks.filter(t => t.project_id === projectId) : tasks

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Time Tracking</h1>
          <p className="text-taupe-600 text-sm mt-0.5">
            This week: <span className="font-semibold">{fmtDuration(weekMins)}</span> · {fmtDuration(billableMins)} billable
          </p>
        </div>
      </div>

      {/* Timer / entry bar */}
      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
          <div className="md:col-span-4">
            <label className="text-xs font-medium text-taupe-600 mb-1 block">What are you working on?</label>
            <input className={inputClass} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description" disabled={!!running} />
          </div>
          <div className="md:col-span-3">
            <label className="text-xs font-medium text-taupe-600 mb-1 block">Project</label>
            <select className={inputClass} value={projectId} onChange={e => { setProjectId(e.target.value); setTaskId('') }} disabled={!!running}>
              <option value="">No project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="text-xs font-medium text-taupe-600 mb-1 block">Task</label>
            <select className={inputClass} value={taskId} onChange={e => setTaskId(e.target.value)} disabled={!!running}>
              <option value="">No task</option>
              {availTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="md:col-span-2 flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-umber-700 whitespace-nowrap">
              <input type="checkbox" checked={billable} onChange={e => setBillable(e.target.checked)} disabled={!!running} />
              Billable
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-paper-200">
          {running ? (
            <>
              <div className="flex items-center gap-2 text-brand-600">
                <Clock className="w-4 h-4" />
                <span className="font-mono text-lg font-semibold tabular-nums">{fmtClock(elapsed)}</span>
                <span className="text-sm text-taupe-600">{running.description ?? 'Running…'}</span>
              </div>
              <button className="btn-primary" onClick={stopTimer} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />} Stop
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <input className={inputClass + ' w-24'} type="number" min="1" placeholder="mins" value={manualMins} onChange={e => setManualMins(e.target.value)} />
                <button className="btn-secondary btn-sm" onClick={addManual} disabled={busy || !manualMins}>
                  <Plus className="w-3 h-3" /> Add manually
                </button>
              </div>
              <button className="btn-primary" onClick={startTimer} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Start timer
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Entries */}
        <div className="card lg:col-span-2">
          <div className="px-5 py-3.5 border-b border-paper-200"><h3>This week&apos;s entries</h3></div>
          {loading ? (
            <div className="px-5 py-12 text-center text-taupe-500 text-sm">Loading…</div>
          ) : logged.length > 0 ? (
            <div className="divide-y divide-paper-200 max-h-[28rem] overflow-y-auto">
              {logged.map(e => (
                <div key={e.id} className="px-5 py-3 flex items-center gap-3 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{e.description ?? 'Untitled'}</p>
                    <p className="text-xs text-taupe-500 mt-0.5">
                      {[e.project?.name, e.task?.title].filter(Boolean).join(' · ') || 'No project'} · {formatDate(e.entry_date)}
                      {!e.billable && ' · non-billable'}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{fmtDuration(e.minutes)}</span>
                  <button onClick={() => del(e.id)} className="opacity-0 group-hover:opacity-100 text-taupe-500 hover:text-red-500 transition-opacity">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-12 text-center text-taupe-500 text-sm">No time logged this week yet. Start the timer above.</div>
          )}
        </div>

        {/* Billable rollup */}
        <div className="card">
          <div className="px-5 py-3.5 border-b border-paper-200"><h3>By project</h3></div>
          {byProject.length > 0 ? (
            <div className="divide-y divide-paper-200">
              {byProject.map((p: any) => (
                <div key={p.name} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink truncate">{p.name}</span>
                    <span className="text-sm font-semibold tabular-nums">{fmtDuration(p.total)}</span>
                  </div>
                  <p className="text-xs text-taupe-500 mt-0.5">{fmtDuration(p.billable)} billable</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-12 text-center text-taupe-500 text-sm">No breakdown yet</div>
          )}
        </div>
      </div>
    </div>
  )
}
