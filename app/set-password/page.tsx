'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff } from 'lucide-react'

function SetPasswordInner() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      setName((session.user.user_metadata?.full_name as string) ?? '')
      setReady(true)
    })
  }, [router, supabase])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)

    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) { setError('Session expired — please sign in again.'); setLoading(false); return }

    const { error: pwError } = await supabase.auth.updateUser({ password, data: { full_name: name || undefined } })
    if (pwError) { setError(pwError.message); setLoading(false); return }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .update({ password_set: true, full_name: name || undefined })
      .eq('id', user.id)
      .select('role')
      .single()

    setLoading(false)
    if (profileError) { setError(profileError.message); return }

    const dest = profile?.role === 'client' ? '/portal' : profile?.role === 'contractor' ? '/contractor-portal' : (params.get('next') ?? '/dashboard')
    router.replace(dest)
    router.refresh()
  }

  if (!ready) return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper-0 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/brand/mm_mark_maroon.png" alt="Mesh Media" className="w-12 h-14 object-contain mx-auto mb-3" />
          <h1 className="text-3xl font-semibold text-ink" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
            Welcome to Mesh Media
          </h1>
          <p className="text-sm text-taupe-600 mt-1">Set a password to finish activating your account</p>
        </div>

        <div className="bg-paper-50 border border-sand-300 rounded-xl p-8" style={{ boxShadow: 'var(--shadow-md)' }}>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Your name</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" style={{ fontSize: 16 }} />
            </div>
            <div>
              <label className="label">New password</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ fontSize: 16 }}
                />
                <button type="button" onClick={() => setShow(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-taupe-500 hover:text-umber-700"
                  aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input
                type={show ? 'text' : 'password'}
                className="input"
                placeholder="Repeat password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                style={{ fontSize: 16 }}
              />
            </div>
            {error && (
              <p className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--danger)', background: 'var(--danger-bg)' }}>{error}</p>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? 'Saving…' : 'Set password & continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordInner />
    </Suspense>
  )
}
