'use client'

import { useEffect, useState, useCallback } from 'react'
import { Send, Loader2, MessageSquare } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default function TaskComments({ taskId }: { taskId: string }) {
  const [comments, setComments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/tasks/${taskId}/comments`)
    const data = await res.json()
    setComments(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [taskId])

  useEffect(() => { load() }, [load])

  const send = async () => {
    if (!text.trim() || sending) return
    setSending(true); setError('')
    const res = await fetch(`/api/tasks/${taskId}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comment: text.trim() }),
    })
    const data = await res.json()
    setSending(false)
    if (!res.ok) { setError(data.error ?? 'Failed to send'); return }
    setText('')
    setComments((c) => [...c, data])
  }

  return (
    <div className="border-t border-gray-100 pt-4 mt-4">
      <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-3">
        <MessageSquare className="w-3.5 h-3.5" /> Feedback
      </p>
      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-2.5 mb-3 max-h-48 overflow-y-auto">
          {comments.length === 0 && <p className="text-xs text-gray-400">No feedback yet.</p>}
          {comments.map((c) => (
            <div key={c.id} className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-sm text-gray-800">{c.comment}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{c.author?.full_name ?? 'Someone'} · {formatDate(c.created_at)}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          placeholder="Leave feedback…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button onClick={send} disabled={!text.trim() || sending} className="btn-secondary btn-sm">
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </div>
      {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
    </div>
  )
}
