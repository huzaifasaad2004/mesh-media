'use client'

import { useRef, useState, useEffect } from 'react'
import { Eraser, Loader2 } from 'lucide-react'

export default function SignaturePad({
  defaultName, onSubmit, submitting, submitLabel = 'Sign', onLiveChange,
}: {
  defaultName?: string
  onSubmit: (payload: { name: string; dataUrl: string | null }) => void
  submitting?: boolean
  submitLabel?: string
  /** Fires on every keystroke/stroke so a parent can show a live "where this will land" preview. */
  onLiveChange?: (payload: { name: string; dataUrl: string | null }) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasDrawn = useRef(false)
  const [name, setName] = useState(defaultName ?? '')
  const [mode, setMode] = useState<'draw' | 'type'>('draw')
  const [liveDataUrl, setLiveDataUrl] = useState<string | null>(null)

  useEffect(() => {
    onLiveChange?.({ name, dataUrl: mode === 'draw' ? liveDataUrl : null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, mode, liveDataUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#151312'
  }, [])

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'draw') return
    drawing.current = true
    hasDrawn.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || mode !== 'draw') return
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const end = () => {
    drawing.current = false
    if (hasDrawn.current) setLiveDataUrl(canvasRef.current!.toDataURL('image/png'))
  }

  const clear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasDrawn.current = false
    setLiveDataUrl(null)
  }

  const submit = () => {
    if (!name.trim()) return
    const dataUrl = mode === 'draw' && hasDrawn.current ? canvasRef.current!.toDataURL('image/png') : null
    onSubmit({ name: name.trim(), dataUrl })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Full name</label>
        <input
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Type your full legal name"
        />
      </div>

      <div className="flex gap-2 text-xs">
        <button type="button" onClick={() => setMode('draw')} className={`px-2.5 py-1 rounded-md ${mode === 'draw' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Draw signature</button>
        <button type="button" onClick={() => setMode('type')} className={`px-2.5 py-1 rounded-md ${mode === 'type' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Type name only</button>
      </div>

      {mode === 'draw' ? (
        <div>
          <canvas
            ref={canvasRef}
            width={400}
            height={140}
            className="w-full border border-gray-200 rounded-lg bg-white touch-none"
            style={{ height: 140 }}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
          />
          <button type="button" onClick={clear} className="btn-ghost btn-sm mt-1.5">
            <Eraser className="w-3 h-3" /> Clear
          </button>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg bg-gray-50 h-[140px] flex items-center justify-center">
          <span className="text-2xl" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{name || 'Your name'}</span>
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!name.trim() || submitting}
        className="btn-primary w-full justify-center"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {submitLabel}
      </button>
      <p className="text-[11px] text-gray-400">By signing, you agree this electronic signature is legally binding, same as a handwritten one.</p>
    </div>
  )
}
