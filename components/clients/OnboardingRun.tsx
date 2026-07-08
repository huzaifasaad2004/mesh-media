'use client'

import { useEffect, useState, useCallback } from 'react'
import { CheckCircle2, Circle, PlayCircle, RotateCcw } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface Step { id: string; title: string; description: string | null; is_completed: boolean }
interface Run { id: string; template_name: string; status: 'active' | 'completed' | 'cancelled'; steps: Step[] }
interface Template { id: string; name: string }

export default function OnboardingRun({ clientId }: { clientId: string }) {
  const [run, setRun] = useState<Run | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const toast = useToast()

  const fetchRun = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/onboarding-run`)
    const data = await res.json()
    setRun(data ?? null)
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    fetchRun()
    fetch('/api/onboarding/templates').then((r) => r.json()).then((d) => setTemplates(Array.isArray(d) ? d : []))
  }, [fetchRun])

  const startRun = async () => {
    if (!selectedTemplate) return
    setStarting(true)
    const res = await fetch('/api/onboarding/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, template_id: selectedTemplate }),
    })
    const data = await res.json()
    setStarting(false)
    if (res.ok) { toast.success('Onboarding started'); fetchRun() }
    else toast.error(data.error ?? 'Failed to start onboarding')
  }

  const toggleStep = async (stepId: string, is_completed: boolean) => {
    if (!run) return
    setRun({ ...run, steps: run.steps.map((s) => (s.id === stepId ? { ...s, is_completed } : s)) })
    const res = await fetch(`/api/onboarding/run-steps/${stepId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_completed }),
    })
    if (!res.ok) { toast.error('Failed to update step'); fetchRun() }
  }

  const finishRun = async () => {
    if (!run) return
    const res = await fetch(`/api/onboarding/runs/${run.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'completed' }),
    })
    if (res.ok) { toast.success('Onboarding marked complete'); fetchRun() }
    else toast.error('Failed to complete onboarding')
  }

  if (loading) return null

  const completedSteps = run?.steps.filter((s) => s.is_completed).length ?? 0
  const totalSteps = run?.steps.length ?? 0
  const allDone = totalSteps > 0 && completedSteps === totalSteps

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3>Onboarding</h3>
        {run && run.status === 'active' && <span className="text-xs text-gray-500">{completedSteps}/{totalSteps}</span>}
      </div>

      {!run || run.status !== 'active' ? (
        <div className="space-y-2.5">
          {run?.status === 'completed' && (
            <p className="text-xs text-green-700 bg-green-50 rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Completed "{run.template_name}"
            </p>
          )}
          {templates.length > 0 ? (
            <>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>
                <option value="">Select a template…</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button className="btn-primary btn-sm w-full justify-center" disabled={!selectedTemplate || starting} onClick={startRun}>
                {run?.status === 'completed' ? <RotateCcw className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                {starting ? 'Starting…' : run?.status === 'completed' ? 'Start Another' : 'Start Onboarding'}
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-400">No onboarding templates yet — create one in Settings.</p>
          )}
        </div>
      ) : (
        <>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
            <div className="bg-brand-600 h-1.5 rounded-full transition-all" style={{ width: `${totalSteps ? (completedSteps / totalSteps) * 100 : 0}%` }} />
          </div>
          <div className="space-y-2">
            {run.steps.map((step) => (
              <button key={step.id} onClick={() => toggleStep(step.id, !step.is_completed)} className="flex items-center gap-2.5 w-full text-left">
                {step.is_completed
                  ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  : <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                <span className={`text-sm ${step.is_completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{step.title}</span>
              </button>
            ))}
          </div>
          {allDone && (
            <button className="btn-secondary btn-sm w-full justify-center mt-4" onClick={finishRun}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Mark Onboarding Complete
            </button>
          )}
        </>
      )}
    </div>
  )
}
