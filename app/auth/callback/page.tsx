'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Supabase's invite/magic-link emails can land here with the session either
// as a `?code=` (PKCE, exchangeable server- or client-side) or as URL hash
// tokens (#access_token=...) which ONLY the browser can ever see. A server
// route handler can't read a hash fragment at all — it never reaches the
// server — which was why invited teammates got bounced back to a bare login
// page. This client page handles both cases.
function AuthCallbackInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    const next = params.get('next') ?? '/dashboard'
    const code = params.get('code')

    async function resolve() {
      // If the URL carries a PKCE code, exchange it explicitly.
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) { setError(error.message); return }
      }

      // If the URL carried hash tokens (#access_token=...), the browser
      // client already parsed and stored them by the time this runs
      // (detectSessionInUrl is on by default). Either way, confirm a session
      // now exists before proceeding.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('This link is invalid or has expired.'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, password_set')
        .eq('id', session.user.id)
        .single()

      if (profile?.role === 'client') { router.replace('/portal'); return }
      if (profile?.password_set === false) {
        router.replace(`/set-password?next=${encodeURIComponent(next)}`)
        return
      }
      router.replace(next)
    }

    resolve()
  }, [params, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper-0 px-4">
      <div className="text-center">
        <img src="/brand/mm_mark_maroon.png" alt="Mesh Media" className="w-10 h-12 object-contain mx-auto mb-3" />
        {error ? (
          <>
            <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>{error}</p>
            <a href="/login" className="text-sm text-brand-600 hover:underline mt-2 inline-block">Back to sign in</a>
          </>
        ) : (
          <p className="text-sm text-taupe-500">Signing you in…</p>
        )}
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper-0 px-4">
      <div className="text-center">
        <img src="/brand/mm_mark_maroon.png" alt="Mesh Media" className="w-10 h-12 object-contain mx-auto mb-3" />
        <p className="text-sm text-taupe-500">Signing you in…</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AuthCallbackInner />
    </Suspense>
  )
}
