import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatCurrency, formatDate, statusColor, statusLabel } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Phone, Mail, Globe, Activity } from 'lucide-react'
import PortalAccessCard from '@/components/clients/PortalAccessCard'
import OnboardingRun from '@/components/clients/OnboardingRun'
import AskAetherButton from '@/components/clients/AskAetherButton'
import { computeChurnRisk, CHURN_LEVEL_LABEL, CHURN_LEVEL_COLOR } from '@/lib/churnRisk'

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const role = myProfile?.role ?? 'client'
  const isManagerUp = ['owner', 'admin', 'manager'].includes(role)
  // Members see only what's assigned to them — no client contact emails, no
  // finance detail, no portal-access/onboarding controls. Those sections are
  // skipped entirely (not just hidden client-side) so the queries never run.
  const canSeeFinance = isManagerUp
  const canSeeContactDetails = isManagerUp

  const [
    { data: client },
    { data: contacts },
    { data: notes },
    { data: tasks },
    { data: contracts },
    { data: invoices },
    { data: files },
    { data: reports },
    { data: mediaPlacements },
  ] = await Promise.all([
    supabase.from('clients').select('*').eq('id', params.id).single(),
    supabase.from('contacts').select('*').eq('client_id', params.id).order('is_primary', { ascending: false }),
    supabase.from('client_notes').select('*, author:profiles(full_name)').eq('client_id', params.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('tasks').select('id, title, status, priority, due_date').eq('client_id', params.id).neq('status', 'done').limit(5),
    supabase.from('contracts').select('id, title, status, value, start_date, end_date').eq('client_id', params.id).order('created_at', { ascending: false }).limit(3),
    canSeeFinance
      ? supabase.from('invoices').select('id, invoice_number, total, amount_paid, status, issue_date, due_date, paid_date').eq('client_id', params.id).order('issue_date', { ascending: false })
      : Promise.resolve({ data: null }),
    supabase.from('files').select('id, name, file_type, category, created_at').eq('client_id', params.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('client_reports').select('id, period, pdf_url').eq('client_id', params.id).order('period', { ascending: false }).limit(12),
    supabase.from('media_placements').select('id, title, outlet_name, publish_date, ave, emv_multiplier, sentiment, url').eq('client_id', params.id).order('publish_date', { ascending: false }).limit(5),
  ])

  if (!client) notFound()

  const sixMonthsAgo = new Date(Date.now() - 183 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const [{ data: recentInvoicesForChurn }, { data: lastTaskRow }, { data: lastNoteRow }] = await Promise.all([
    supabase.from('invoices').select('status, due_date, issue_date').eq('client_id', params.id).gte('issue_date', sixMonthsAgo),
    supabase.from('tasks').select('created_at').eq('client_id', params.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('client_notes').select('created_at').eq('client_id', params.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const churn = computeChurnRisk({
    status: client.status,
    monthlyRetainer: client.monthly_retainer,
    invoices: recentInvoicesForChurn ?? [],
    lastTaskAt: lastTaskRow?.created_at ?? null,
    lastNoteAt: lastNoteRow?.created_at ?? null,
  })


  const totalInvoiced = (invoices ?? []).reduce((s, i: any) => s + Number(i.total), 0)
  const totalPaid = (invoices ?? []).reduce((s, i: any) => s + Number(i.status === 'paid' ? i.total : i.amount_paid ?? 0), 0)
  const outstandingBalance = (invoices ?? []).filter((i: any) => ['sent', 'overdue', 'partially_paid'].includes(i.status)).reduce((s, i: any) => s + (Number(i.total) - Number(i.amount_paid ?? 0)), 0)

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
            <AskAetherButton companyName={client.company_name} />
            {client.drive_folder_url && (
              <a href={client.drive_folder_url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                <ExternalLink className="w-3 h-3" /> Drive Folder
              </a>
            )}
            {isManagerUp && <Link href={`/clients/${params.id}/edit`} className="btn-primary btn-sm">Edit</Link>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-5">
          {/* Client Pulse — churn/health signal */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2"><Activity className="w-4 h-4 text-gray-400" /> Client Pulse</h3>
              <span className={`badge ${CHURN_LEVEL_COLOR[churn.level]}`}>{CHURN_LEVEL_LABEL[churn.level]}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: `${churn.score}%`,
                  background: churn.level === 'healthy' ? 'var(--success, #4F7A4A)' : churn.level === 'watch' ? 'var(--warning, #B8801F)' : 'var(--danger, #B23A2E)',
                }}
              />
            </div>
            <p className="text-xs text-gray-400 mb-2">Health score: {churn.score}/100</p>
            <ul className="space-y-1.5">
              {churn.reasons.map((r, i) => (
                <li key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
                  <span className="text-gray-300 mt-0.5">•</span> {r}
                </li>
              ))}
            </ul>
          </div>

          {/* Client Info — contact details (email/phone/website) are a
              manager+ concern; a member only needs to know who the client is. */}
          <div className="card p-5">
            <h3 className="mb-4">Client Info</h3>
            <div className="space-y-3">
              {canSeeContactDetails && client.email && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <a href={`mailto:${client.email}`} className="text-brand-600 hover:underline truncate">{client.email}</a>
                </div>
              )}
              {canSeeContactDetails && client.phone && (
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
              {canSeeFinance && client.monthly_retainer && (
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-sm text-gray-500">Monthly Retainer</span>
                  <span className="text-sm font-semibold text-green-700">{formatCurrency(client.monthly_retainer)}/mo</span>
                </div>
              )}
              {client.address && (
                <p className="text-sm text-gray-500 pt-2 border-t border-gray-100">{client.address}</p>
              )}
              {!canSeeContactDetails && !client.website && !client.address && (
                <p className="text-sm text-gray-400">Contact details are only visible to managers.</p>
              )}
            </div>
          </div>

          {/* Contacts — names only for a member, no emails */}
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
                      {canSeeContactDetails && c.email && <p className="text-xs text-gray-500">{c.email}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">No contacts added</p>}
          </div>

          {/* Client Portal Access — invite/access control is a manager+ action */}
          {isManagerUp && <PortalAccessCard clientId={params.id} clientEmail={client.email} />}

          {/* Onboarding */}
          {isManagerUp && <OnboardingRun clientId={params.id} />}
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

          {/* Account Statement — finance detail, manager+ only */}
          {canSeeFinance && (
            <div className="card">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3>Account Statement</h3>
                <Link href="/finance/invoices" className="text-xs text-brand-600 hover:underline">All invoices</Link>
              </div>
              <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
                <div className="px-5 py-3 text-center">
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(totalInvoiced)}</p>
                  <p className="text-xs text-gray-500">Total Invoiced</p>
                </div>
                <div className="px-5 py-3 text-center">
                  <p className="text-lg font-bold text-green-700">{formatCurrency(totalPaid)}</p>
                  <p className="text-xs text-gray-500">Total Paid</p>
                </div>
                <div className="px-5 py-3 text-center">
                  <p className={`text-lg font-bold ${outstandingBalance > 0 ? 'text-orange-600' : 'text-gray-900'}`}>{formatCurrency(outstandingBalance)}</p>
                  <p className="text-xs text-gray-500">Balance Due</p>
                </div>
              </div>
              {invoices && invoices.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Invoice</th>
                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Issued</th>
                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Paid</th>
                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Amount</th>
                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {invoices.map((inv: any) => (
                        <tr key={inv.id}>
                          <td className="px-5 py-3 font-medium text-brand-600">
                            <a href={`/invoice/${inv.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{inv.invoice_number}</a>
                          </td>
                          <td className="px-5 py-3 text-gray-500">{formatDate(inv.issue_date)}</td>
                          <td className="px-5 py-3 text-gray-500">{inv.paid_date ? formatDate(inv.paid_date) : '—'}</td>
                          <td className="px-5 py-3 font-semibold">{formatCurrency(inv.total)}</td>
                          <td className="px-5 py-3"><span className={`badge ${statusColor(inv.status)}`}>{statusLabel(inv.status)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-5 py-6 text-sm text-gray-400">No invoices yet</p>
              )}
            </div>
          )}

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

          {/* Media Coverage */}
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3>Media Coverage</h3>
              <Link href={`/media?client=${params.id}`} className="text-xs text-brand-600 hover:underline">View all</Link>
            </div>
            {mediaPlacements && mediaPlacements.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {mediaPlacements.map((m: any) => {
                  const emv = m.ave != null ? Number(m.ave) * Number(m.emv_multiplier ?? 3) : null
                  return (
                    <div key={m.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {m.url ? <a href={m.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{m.title}</a> : m.title}
                        </p>
                        <p className="text-xs text-gray-400">{m.outlet_name} · {formatDate(m.publish_date)}</p>
                      </div>
                      {emv != null && <span className="text-sm font-semibold text-green-700 flex-shrink-0">{formatCurrency(emv)}</span>}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="px-5 py-6 text-sm text-gray-400">No media coverage logged yet</p>
            )}
          </div>

          {/* Impact Reports */}
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3>Impact Reports</h3>
            </div>
            {reports && reports.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {reports.map((r: any) => (
                  <a key={r.id} href={r.pdf_url} target="_blank" rel="noopener noreferrer"
                    className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <span className="text-sm text-gray-800">
                      {new Date(`${r.period}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="px-5 py-6 text-sm text-gray-400">No reports generated yet</p>
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
