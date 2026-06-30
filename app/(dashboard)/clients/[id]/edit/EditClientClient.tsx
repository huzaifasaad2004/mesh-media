'use client'

import { useRouter } from 'next/navigation'
import ClientForm from '@/components/forms/ClientForm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { Client } from '@/types/database'

export default function EditClientClient({ client }: { client: Client }) {
  const router = useRouter()
  return (
    <div className="max-w-2xl">
      <div className="page-header">
        <div>
          <Link href={`/clients/${client.id}`} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3 h-3" /> Back to Client
          </Link>
          <h1>Edit {client.company_name}</h1>
        </div>
      </div>
      <div className="card p-6">
        <ClientForm
          onSuccess={() => router.push(`/clients/${client.id}`)}
          initialData={client}
        />
      </div>
    </div>
  )
}
