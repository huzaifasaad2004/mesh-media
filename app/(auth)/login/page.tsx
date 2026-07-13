'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, CheckCircle } from 'lucide-react'

type Portal = 'admin' | 'team' | 'client'

export default function LoginPage() {
  const [portal, setPortal] = useState<Portal>('admin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (portal === 'client') {
      // Magic link — no password for clients
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/portal`,
          shouldCreateUser: false,
        },
      })
      setLoading(false)
      if (error) {
        setError(error.message.includes('Signups not allowed')
          ? 'This email has no portal access yet. Ask your Mesh Media contact to invite you.'
          : error.message)
      } else {
        setSent(true)
      }
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      // Route by role
      const { data: { user } } = await supabase.auth.getUser()
      let dest = '/dashboard'
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (profile?.role === 'client') dest = '/portal'
        else if (profile?.role === 'contractor') dest = '/contractor-portal'
      }
      router.push(dest)
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper-0 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/brand/mm_mark_maroon.png" alt="Mesh Media" className="w-12 h-14 object-contain mx-auto mb-3" />
          <h1 className="text-3xl font-semibold text-ink" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
            Mesh Media
          </h1>
          <p className="text-sm text-taupe-600 mt-1">Agency Management Platform</p>
        </div>

        {/* Card */}
        <div className="bg-paper-50 border border-sand-300 rounded-xl p-8" style={{ boxShadow: 'var(--shadow-md)' }}>

          {/* Portal switcher */}
          <div className="flex gap-1 bg-paper-200 rounded-lg p-1 mb-6">
            {(['admin', 'team', 'client'] as Portal[]).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => { setPortal(p); setError(''); setSent(false) }}
                className={`flex-1 text-xs font-medium py-2 rounded-md capitalize transition-colors ${
                  portal === p ? 'bg-brand-600 text-paper-100' : 'text-umber-700 hover:text-ink'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {sent ? (
            <div className="text-center py-6">
              <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--success)' }} />
              <p className="text-sm font-medium text-ink">Check your email</p>
              <p className="text-xs text-taupe-600 mt-1">We sent a sign-in link to <strong>{email}</strong>. It expires in 1 hour.</p>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder={portal === 'client' ? 'you@yourcompany.com' : 'you@meshmedia.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ fontSize: 16 }}
                />
              </div>

              {portal !== 'client' && (
                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input pr-10"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{ fontSize: 16 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-taupe-500 hover:text-umber-700"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {portal === 'client' && (
                <p className="text-xs text-taupe-600">
                  No password needed — we&apos;ll email you a secure sign-in link.
                </p>
              )}

              {error && (
                <p className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--danger)', background: 'var(--danger-bg)' }}>{error}</p>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                {loading ? 'Please wait…' : portal === 'client' ? 'Email me a sign-in link' : 'Sign in'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-taupe-500 mt-6">
          {portal === 'client' ? 'Clients sign in with a magic link — no password to remember.' : 'Contact your admin if you need access.'}
        </p>
      </div>
    </div>
  )
}
