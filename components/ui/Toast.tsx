'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

type ToastKind = 'success' | 'error'
type ToastItem = { id: number; kind: ToastKind; message: string }

type ToastContextValue = {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++idRef.current
    setToasts((t) => [...t, { id, kind, message }])
    setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  // Keep the context identity stable so showing a toast does not re-render the
  // entire application tree (including pages that fetch data in effects).
  const value = useMemo<ToastContextValue>(() => ({
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message),
  }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100vw-2rem)] sm:w-auto sm:max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="flex items-start gap-2.5 px-4 py-3 rounded-lg shadow-md text-sm"
            style={{
              background: t.kind === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
              color: t.kind === 'success' ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {t.kind === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
