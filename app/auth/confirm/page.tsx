'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import type { EmailOtpType } from '@supabase/supabase-js'

// Invite / magic-link / recovery emails land here with a token_hash in the
// URL. Crucially, NOTHING is consumed on page load — corporate email
// scanners and link previews GET this page all the time, and with the old
// one-time action links that silently burned the token before the human
// ever clicked ("This link is invalid or has expired"). The token is only
// verified when the person presses the button.
function ConfirmInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle')
  const [error, setError] = useState('')

  const tokenHash = params.get('token_hash') ?? ''
  const type = (params.get('type') ?? 'magiclink') as EmailOtpType
  const next = params.get('next') ?? '/dashboard'

  const headline =
    type === 'invite' ? 'Activate your account'
    : type === 'recovery' ? 'Reset your password'
    : 'Sign in to Mesh Media'

  const confirm = async () => {
    setState('working')
    const supabase = createClient()
    const { error: verifyErr } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (verifyErr) {
      setError(
        verifyErr.message.toLowerCase().includes('expired')
          ? 'This link has expired. Ask your admin to send a new one.'
          : verifyErr.message
      )
      setState('error')
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Could not start a session — try again.'); setState('error'); return }

    // Recovery links always go to the password screen
    if (type === 'recovery') { router.replace(`/set-password?next=${encodeURIComponent(next)}`); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, password_set')
      .eq('id', session.user.id)
      .single()

    if (profile?.role === 'client') { router.replace('/portal'); return }
    if (profile?.password_set === false) { router.replace(`/set-password?next=${encodeURIComponent(next)}`); return }
    router.replace(next)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper-0 px-4">
      <div className="w-full max-w-sm bg-white border border-sand-300 rounded-xl shadow-sm p-8 text-center">
        <img src="/brand/mm_mark_maroon.png" alt="Mesh Media" className="w-10 h-12 object-contain mx-auto mb-4" />
        <h1 className="font-display text-2xl text-ink mb-2">{headline}</h1>

        {!tokenHash ? (
          <p className="text-sm" style={{ color: 'var(--danger)' }}>
            This link is incomplete. Ask your admin to send a new one.
          </p>
        ) : state === 'error' ? (
          <>
            <p className="text-sm mb-4" style={{ color: 'var(--danger)' }}>{error}</p>
            <a href="/login" className="text-sm text-maroon hover:underline">Back to sign in</a>
          </>
        ) : (
          <>
            <p className="text-sm text-taupe-600 mb-6">
              {type === 'invite'
                ? "You've been invited to Mesh Media Agency OS. Continue to set up your account."
                : type === 'recovery'
                ? 'Continue to choose a new password for your account.'
                : 'Continue to open your workspace.'}
            </p>
            <button
              onClick={confirm}
              disabled={state === 'working'}
              className="w-full flex items-center justify-center gap-2 bg-maroon hover:bg-maroon-dark text-paper-100 font-medium rounded-lg px-4 py-2.5 text-sm transition-colors disabled:opacity-60"
            >
              {state === 'working' && <Loader2 size={15} className="animate-spin" />}
              {state === 'working' ? 'Signing you in…' : 'Continue →'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-paper-0" />}>
      <ConfirmInner />
    </Suspense>
  )
}
