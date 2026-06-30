'use client'

import { useRouter } from 'next/navigation'
import ClientForm from '@/components/forms/ClientForm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewClientPage() {
  const router = useRouter()
  return (
    <div className="max-w-2xl">
      <div className="page-header">
        <div>
          <Link href="/clients" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3 h-3" /> Back to Clients
          </Link>
          <h1>New Client</h1>
        </div>
      </div>
      <div className="card p-6">
        <ClientForm onSuccess={() => router.push('/clients')} />
      </div>
    </div>
  )
}
