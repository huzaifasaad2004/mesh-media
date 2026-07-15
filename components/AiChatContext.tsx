'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export interface Message { role: 'user' | 'assistant'; content: string }
export interface ClientContext { name: string }

interface PendingPrompt { text: string; nonce: number }

interface AiChatState {
  open: boolean
  setOpen: (open: boolean) => void
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  loading: boolean
  setLoading: (loading: boolean) => void
  error: string
  setError: (error: string) => void
  clientContext: ClientContext | null
  setClientContext: (context: ClientContext | null) => void
  clearClientContext: () => void
  /** Set by ask(), consumed once by AiChat's effect, then cleared. */
  pendingPrompt: PendingPrompt | null
  clearPendingPrompt: () => void
  /** Open Aether, optionally scoped to a client, and send this prompt immediately. */
  ask: (prompt: string, context?: ClientContext) => void
}

const AiChatCtx = createContext<AiChatState | null>(null)

const WELCOME: Message = {
  role: 'assistant',
  content: "I'm **Aether**. I can see your live financials, clients, projects and tasks — and I can create tasks and clients for you. What do you need?",
}

export function AiChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [clientContext, setClientContext] = useState<ClientContext | null>(null)
  const [pendingPrompt, setPendingPrompt] = useState<PendingPrompt | null>(null)

  const clearClientContext = useCallback(() => setClientContext(null), [])
  const clearPendingPrompt = useCallback(() => setPendingPrompt(null), [])

  const ask = useCallback((prompt: string, context?: ClientContext) => {
    if (context) setClientContext(context)
    setOpen(true)
    setPendingPrompt({ text: prompt, nonce: Date.now() })
  }, [])

  return (
    <AiChatCtx.Provider value={{
      open, setOpen, messages, setMessages, loading, setLoading, error, setError,
      clientContext, setClientContext, clearClientContext, pendingPrompt, clearPendingPrompt, ask,
    }}>
      {children}
    </AiChatCtx.Provider>
  )
}

export function useAiChat() {
  const ctx = useContext(AiChatCtx)
  if (!ctx) throw new Error('useAiChat must be used within AiChatProvider')
  return ctx
}
