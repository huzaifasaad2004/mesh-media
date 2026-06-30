'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Send, Sparkles, Loader2, ChevronDown } from 'lucide-react'

interface Message { role: 'user' | 'assistant'; content: string }

const STARTERS = [
  'How much revenue this month?',
  'Write a description for social media management',
  'Which invoices are overdue?',
  'Draft a follow-up email for a late payment',
]

export default function AiChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm **Meshi**, your MeshMedia AI assistant. I can help you write descriptions, check financials, draft emails, and more. What do you need?" }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, messages])

  const send = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')
    setError('')
    const newMessages: Message[] = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'AI unavailable')
      setMessages(p => [...p, { role: 'assistant', content: data.reply }])
    } catch (e: any) {
      setError(e.message.includes('GEMINI_API_KEY') ? 'Add GEMINI_API_KEY to Vercel env vars to enable AI.' : e.message)
    } finally {
      setLoading(false)
    }
  }

  function renderContent(text: string) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>')
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-13 h-13 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{ width: 52, height: 52, background: '#6E1318' }}
        title="Meshi AI Assistant"
      >
        {open
          ? <ChevronDown className="w-5 h-5 text-white" />
          : <Sparkles className="w-5 h-5 text-white" />
        }
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ height: 460 }}>

          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100" style={{ background: '#6E1318' }}>
            <div className="w-7 h-7 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">Meshi</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>MeshMedia AI Assistant</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white opacity-60 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}
                  style={m.role === 'user' ? { background: '#6E1318' } : {}}
                  dangerouslySetInnerHTML={{ __html: renderContent(m.content) }}
                />
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-3 py-2 rounded-xl rounded-bl-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              </div>
            )}
            {error && <p className="text-xs text-red-500 text-center px-2">{error}</p>}
            <div ref={bottomRef} />
          </div>

          {/* Starters (only when first message) */}
          {messages.length === 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {STARTERS.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-600 transition-colors bg-white">
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3">
            <div className="flex gap-2 items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <input
                ref={inputRef}
                className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
                placeholder="Ask Meshi anything…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                disabled={loading}
              />
              <button onClick={() => send()} disabled={!input.trim() || loading}
                className="text-white w-7 h-7 rounded-lg flex items-center justify-center transition-opacity disabled:opacity-40"
                style={{ background: '#6E1318' }}>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-center text-xs text-gray-400 mt-1.5">Powered by Google Gemini · Free</p>
          </div>
        </div>
      )}
    </>
  )
}
