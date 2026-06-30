import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatCurrency, formatDate, statusColor, statusLabel } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Phone, Mail, Globe, CheckCircle2, Circle } from 'lucide-react'

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const [
    { data: client },
    { data: contacts },
    { data: notes },
    { data: onboarding },
    { data: tasks },
    { data: contracts },
    { data: invoices },
    { data: files },
  ] = await Promise.all([
    supabase.from('clients').select('*').eq('id', params.id).single(),
    supabase.from('contacts').select('*').eq('client_id', params.id).order('is_primary', { ascending: false }),
    supabase.from('client_notes').select('*, author:profiles(full_name)').eq('client_id', params.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('onboarding_steps').select('*').eq('client_id', params.id).order('sort_order'),
    supabase.from('tasks').select('id, title, status, priority, due_date').eq('client_id', params.id).neq('status', 'done').limit(5),
    supabase.from('contracts').select('id, title, status, value, start_date, end_date').eq('client_id', params.id).order('created_at', { ascending: false }).limit(3),
    supabase.from('invoices').select('id, invoice_number, total, status, due_date').eq('client_id', params.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('files').select('id, name, file_type, category, created_at').eq('client_id', params.id).order('created_at', { ascending: false }).limit(10),
  ])

  if (!client) notFound()

  const completedSteps = onboarding?.filter((s: any) => s.is_completed).length ?? 0
  const totalSteps = onboarding?.length ?? 0

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Clients
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-100 text-brand-700 rounded-xl flex items-center justify-center text-lg font-bold">
              {client.company_name[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1>{client.company_name}</h1>
                <span className={`badge ${statusColor(client.status)}`}>{statusLabel(client.status)}</span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{client.industry ?? 'No industry set'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {client.drive_folder_url && (
              <a href={client.drive_folder_url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                <ExternalLink className="w-3 h-3" /> Drive Folder
              </a>
            )}
            <Link href={`/clients/${params.id}/edit`} className="btn-primary btn-sm">Edit</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-5">
          {/* Client Info */}
          <div className="card p-5">
            <h3 className="mb-4">Client Info</h3>
            <div className="space-y-3">
              {client.email && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <a href={`mailto:${client.email}`} className="text-brand-600 hover:underline truncate">{client.email}</a>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700">{client.phone}</span>
                </div>
              )}
              {client.website && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline truncate">{client.website}</a>
                </div>
              )}
              {client.monthly_retainer && (
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-sm text-gray-500">Monthly Retainer</span>
                  <span className="text-sm font-semibold text-green-700">{formatCurrency(client.monthly_retainer)}/mo</span>
                </div>
              )}
              {client.address && (
                <p className="text-sm text-gray-500 pt-2 border-t border-gray-100">{client.address}</p>
              )}
            </div>
          </div>

          {/* Contacts */}
          <div className="card p-5">
            <h3 className="mb-4">Contacts</h3>
            {contacts && contacts.length > 0 ? (
              <div className="space-y-3">
                {contacts.map((c: any) => (
                  <div key={c.id} className="flex items-start gap-3">
                    <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0 mt-0.5">
                      {c.full_name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.full_name} {c.is_primary && <span className="text-xs text-brand-600">(Primary)</span>}</p>
                      {c.role && <p className="text-xs text-gray-400">{c.role}</p>}
                      {c.email && <p className="text-xs text-gray-500">{c.email}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">No contacts added</p>}
          </div>

          {/* Onboarding */}
          {totalSteps > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3>Onboarding</h3>
                <span className="text-xs text-gray-500">{completedSteps}/{totalSteps}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
                <div className="bg-brand-600 h-1.5 rounded-full transition-all" style={{ width: `${totalSteps ? (completedSteps / totalSteps) * 100 : 0}%` }} />
              </div>
              <div className="space-y-2">
                {onboarding?.map((step: any) => (
                  <div key={step.id} className="flex items-center gap-2.5">
                    {step.is_completed
                      ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      : <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    }
                    <span className={`text-sm ${step.is_completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{step.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Tasks */}
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3>Open Tasks</h3>
              <Link href={`/tasks?client=${params.id}`} className="text-xs text-brand-600 hover:underline">View all</Link>
            </div>
            {tasks && tasks.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {tasks.map((task: any) => (
                  <div key={task.id} className="px-5 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-800">{task.title}</span>
                    <div className="flex items-center gap-2">
                      {task.due_date && <span className="text-xs text-gray-400">{formatDate(task.due_date)}</span>}
                      <span className={`badge ${statusColor(task.priority)}`}>{task.priority}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-5 py-6 text-sm text-gray-400">No open tasks</p>
            )}
          </div>

          {/* Contracts */}
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3>Contracts</h3>
              <Link href="/contracts" className="text-xs text-brand-600 hover:underline">View all</Link>
            </div>
            {contracts && contracts.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {contracts.map((c: any) => (
                  <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.title}</p>
                      <p className="text-xs text-gray-400">{formatDate(c.start_date)} → {formatDate(c.end_date)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {c.value && <span className="text-sm font-semibold">{formatCurrency(c.value)}</span>}
                      <span className={`badge ${statusColor(c.status)}`}>{statusLabel(c.status)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-5 py-6 text-sm text-gray-400">No contracts yet</p>
            )}
          </div>

          {/* Invoices */}
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3>Invoices</h3>
              <Link href="/finance" className="text-xs text-brand-600 hover:underline">View all</Link>
            </div>
            {invoices && invoices.length > 0 ? (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {invoices.map((inv: any) => (
                    <tr key={inv.id}>
                      <td className="px-5 py-3 font-medium text-brand-600">{inv.invoice_number}</td>
                      <td className="px-5 py-3 text-gray-500">Due {formatDate(inv.due_date)}</td>
                      <td className="px-5 py-3 font-semibold">{formatCurrency(inv.total)}</td>
                      <td className="px-5 py-3"><span className={`badge ${statusColor(inv.status)}`}>{statusLabel(inv.status)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-5 py-6 text-sm text-gray-400">No invoices yet</p>
            )}
          </div>

          {/* Files */}
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3>Files</h3>
              <Link href={`/files?client=${params.id}`} className="text-xs text-brand-600 hover:underline">View all</Link>
            </div>
            {files && files.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {files.map((f: any) => (
                  <div key={f.id} className="px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 bg-gray-100 rounded flex items-center justify-center text-xs font-bold text-gray-500 uppercase">
                        {f.file_type?.slice(0, 3) ?? 'DOC'}
                      </div>
                      <span className="text-sm text-gray-800">{f.name}</span>
                    </div>
                    {f.category && <span className="badge bg-gray-100 text-gray-600">{f.category}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-5 py-6 text-sm text-gray-400">No files yet</p>
            )}
          </div>

          {/* Notes */}
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3>Notes</h3>
            </div>
            {notes && notes.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {notes.map((note: any) => (
                  <div key={note.id} className="px-5 py-3">
                    <p className="text-sm text-gray-700 mb-1">{note.content}</p>
                    <p className="text-xs text-gray-400">{note.author?.full_name ?? 'Unknown'} · {formatDate(note.created_at)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-5 py-6 text-sm text-gray-400">No notes yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
