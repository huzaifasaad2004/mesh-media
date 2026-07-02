'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RootPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard') }, [router])
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper-0">
      <div className="text-center">
        <img src="/brand/mm_mark_maroon.png" alt="Mesh Media" className="w-10 h-12 object-contain mx-auto mb-3" />
        <p className="text-sm text-taupe-500">Loading Mesh Media…</p>
      </div>
    </div>
  )
}
