'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RootPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard') }, [router])
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 bg-brand-600 rounded-xl mx-auto mb-3 flex items-center justify-center">
          <span className="text-white font-bold text-lg">M</span>
        </div>
        <p className="text-sm text-gray-400">Loading Mesh Media…</p>
      </div>
    </div>
  )
}
