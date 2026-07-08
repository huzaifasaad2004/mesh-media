'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ProfileEditor from '@/components/ProfileEditor'

export default function PortalProfilePage() {
  const [me, setMe] = useState<{ full_name: string | null; email: string | null; avatar_url: string | null } | null>(null)

  useEffect(() => {
    fetch('/api/profiles/me').then(r => r.json()).then(setMe)
  }, [])

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <Link href="/portal" className="text-taupe-500 hover:text-umber-700"><ArrowLeft className="w-4 h-4" /></Link>
        <div>
          <h1 className="text-2xl font-semibold text-ink" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>My Profile</h1>
          <p className="text-taupe-600 text-sm mt-0.5">Your name and photo, as seen by your account team.</p>
        </div>
      </div>

      {me ? (
        <ProfileEditor
          fullName={me.full_name}
          email={me.email}
          avatarUrl={me.avatar_url}
          onSaved={(patch) => setMe(m => m ? { ...m, ...patch } : m)}
        />
      ) : (
        <div className="card h-40 animate-pulse bg-paper-100" />
      )}
    </div>
  )
}
