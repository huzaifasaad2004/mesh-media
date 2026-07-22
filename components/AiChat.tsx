'use client'

import { useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { X, Send, Loader2, ChevronDown } from 'lucide-react'
import { useAiChat, type Message } from '@/components/AiChatContext'

const STARTERS = [
  'What\'s my net profit right now?',
  'Which invoices are overdue and who do I chase?',
  'Create a task to redesign the homepage due Friday',
  'Show me active projects and their progress',
]

const CYAN = '#2BD6D6' // Aether-only accent — never on general UI

export default function AiChat() {
  const router = useRouter()
  const pathname = usePathname()
  const {
    open, setOpen, messages, setMessages, loading, setLoading, error, setError,
    clientContext, clearClientContext, pendingPrompt, clearPendingPrompt,
  } = useAiChat()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, messages])

  const send = async (text?: string) => {
    const msg = (text ?? inputRef.current?.value ?? '').trim()
    if (!msg || loading) return
    if (inputRef.current) inputRef.current.value = ''
    setError('')
    const newMessages: Message[] = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, clientContext }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'AI unavailable')
      setMessages(p => [...p, { role: 'assistant', content: data.reply }])
      // Aether changed data (created a task/client) — refresh the page so it shows
      if (data.didWrite) {
        setTimeout(() => router.refresh(), 600)
      }
    } catch (e: any) {
      setError(e.message.includes('GEMINI_API_KEY') ? 'Add GEMINI_API_KEY to Vercel env vars to enable Aether.' : e.message)
    } finally {
      setLoading(false)
    }
  }

  // A page called ask('...') — send it once, then clear so it doesn't re-fire.
  useEffect(() => {
    if (pendingPrompt) {
      send(pendingPrompt.text)
      clearPendingPrompt()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt])

  function renderContent(text: string) {
    // Escape first — message content echoes DB data (client names, request
    // text), so raw HTML here is a stored-XSS vector. Then the mini-markdown.
    const esc = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return esc
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>')
  }

  // Mesh Chat owns the bottom composer area; never cover its send/voice controls.
  if (pathname.startsWith('/chat')) return null

  return (
    <>
      {/* Floating launcher — Aether avatar with cyan ring */}
      <button
        onClick={() => setOpen(!open)}
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
            <div className="flex-1 min-w-0">
              <p className="font-semibold" style={{ color: '#F7F2E9', fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 17 }}>Aether</p>
              <p className="text-xs" style={{ color: CYAN }}>Your brand concierge</p>
            </div>
            <button onClick={() => setOpen(false)} className="opacity-60 hover:opacity-100" style={{ color: '#F3EEE6' }} aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Client-scoped context chip — set via useAiChat().ask(prompt, { name }) */}
          {clientContext && (
            <div className="flex items-center gap-1.5 px-4 py-1.5" style={{ borderBottom: '1px solid #2A2420' }}>
              <span className="text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: 'rgba(43,214,214,0.12)', color: CYAN }}>
                Talking about: {clientContext.name}
                <button onClick={clearClientContext} aria-label="Clear client context" className="hover:opacity-70">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            </div>
          )}

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
                defaultValue=""
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                disabled={loading}
              />
              <button onClick={() => send()} disabled={loading}
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
