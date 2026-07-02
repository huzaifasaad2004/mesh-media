'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Send, Loader2, ChevronDown } from 'lucide-react'

interface Message { role: 'user' | 'assistant'; content: string }

const STARTERS = [
  'How much revenue this month?',
  'Which invoices are overdue?',
  'Draft a follow-up email for a late payment',
  'Write a description for social media management',
]

const CYAN = '#2BD6D6' // Aether-only accent — never on general UI

export default function AiChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "I'm **Aether** — guardian of the Mesh Media brand-verse. Ask me about your finances, clients, or let me draft something for you." }
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
      setError(e.message.includes('GEMINI_API_KEY') ? 'Add GEMINI_API_KEY to Vercel env vars to enable Aether.' : e.message)
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
      {/* Floating launcher — Aether avatar with cyan ring */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
        style={{ width: 52, height: 52 }}
        title="Aether — Mesh Media AI"
        aria-label="Open Aether assistant"
      >
        {open ? (
          <span className="w-full h-full rounded-full flex items-center justify-center" style={{ background: '#151312', border: `1.5px solid ${CYAN}` }}>
            <ChevronDown className="w-5 h-5" style={{ color: CYAN }} />
          </span>
        ) : (
          <img src="/brand/aether_avatar_128.png" alt="Aether" className="w-full h-full rounded-full object-cover" />
        )}
      </button>

      {/* Chat panel — dark espresso with cyan chrome (Aether-only) */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-80 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ height: 480, background: '#151312', border: '1px solid #3A332C' }}>

          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: '1px solid #2A2420' }}>
            <img src="/brand/aether_avatar_64.png" alt="Aether" className="w-9 h-9 rounded-full object-cover" />
            <div className="flex-1">
              <p className="font-semibold" style={{ color: '#F7F2E9', fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 17 }}>Aether</p>
              <p className="text-xs" style={{ color: CYAN }}>Your brand concierge</p>
            </div>
            <button onClick={() => setOpen(false)} className="opacity-60 hover:opacity-100" style={{ color: '#F3EEE6' }} aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${m.role === 'user' ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                  style={m.role === 'user'
                    ? { background: '#2A2420', color: '#E0D6C4' }
                    : { background: '#1C1815', color: '#C8BCA8', border: '1px solid #2A2420' }}
                  dangerouslySetInnerHTML={{ __html: renderContent(m.content) }}
                />
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-xl rounded-bl-sm" style={{ background: '#1C1815' }}>
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: CYAN }} />
                </div>
              </div>
            )}
            {error && <p className="text-xs text-center px-2" style={{ color: '#D98A8E' }}>{error}</p>}
            <div ref={bottomRef} />
          </div>

          {/* Starters (only when first message) */}
          {messages.length === 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {STARTERS.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="text-xs px-2.5 py-1 rounded-full transition-colors"
                  style={{ border: '1px solid #3A332C', color: '#9C9384', background: 'transparent' }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3">
            <div className="flex gap-2 items-center rounded-xl px-3 py-2" style={{ background: '#1C1815', border: '1px solid #3A332C' }}>
              <input
                ref={inputRef}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: '#F3EEE6' }}
                placeholder="Ask Aether anything…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                disabled={loading}
              />
              <button onClick={() => send()} disabled={!input.trim() || loading}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-opacity disabled:opacity-40"
                aria-label="Send">
                <Send className="w-4 h-4" style={{ color: CYAN }} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
