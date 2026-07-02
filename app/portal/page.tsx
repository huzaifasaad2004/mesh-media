import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, statusColor, statusLabel } from '@/lib/utils'
import { FileText, FolderOpen, Eye } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PortalPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // RLS scopes every query below to this client's own rows
  const [{ data: clients }, { data: projects }, { data: invoices }, { data: quotations }, { data: files }] =
    await Promise.all([
      supabase.from('clients').select('id, company_name'),
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').order('issue_date', { ascending: false }).limit(10),
      supabase.from('quotations').select('*').order('issue_date', { ascending: false }).limit(10),
      supabase.from('files').select('*').order('created_at', { ascending: false }).limit(8),
    ])

  const companyName = clients?.[0]?.company_name ?? user?.email ?? 'there'
  const openInvoices = (invoices ?? []).filter(i => ['sent', 'overdue'].includes(i.status))
  const pendingQuotes = (quotations ?? []).filter(q => q.status === 'sent')

  return (
    <div>
      <h1 className="text-3xl font-semibold text-ink" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
        Welcome back, {companyName}
      </h1>
      <p className="text-sm text-taupe-600 mt-1 mb-6">Here&apos;s everything in motion with your brand.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Projects */}
        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Your projects</h2>
          {projects && projects.length > 0 ? (
            <div className="space-y-4">
              {projects.slice(0, 4).map((p: any) => (
                <div key={p.id}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-ink">{p.name}</span>
                    <span className={`badge ${statusColor(p.status)}`}>{statusLabel(p.status)}</span>
                  </div>
                  {p.description && <p className="text-xs text-taupe-600 line-clamp-1">{p.description}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-taupe-500 py-4">No active projects yet.</p>
          )}
        </div>

        {/* Pending quotations */}
        <div className="card p-5" style={pendingQuotes.length > 0 ? { borderColor: '#D98A8E' } : {}}>
          <h2 className="text-lg font-semibold mb-1" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
            {pendingQuotes.length > 0 ? 'Awaiting your review' : 'Quotations'}
          </h2>
          {pendingQuotes.length > 0 ? (
            <div className="space-y-3 mt-3">
              {pendingQuotes.map((q: any) => (
                <div key={q.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">{q.quote_number}</p>
                    <p className="text-xs text-taupe-600">{formatCurrency(q.total)}{q.expiry_date ? ` · valid until ${formatDate(q.expiry_date)}` : ''}</p>
                  </div>
                  <a href={`/quotation/${q.id}`} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                    <Eye className="w-3 h-3" /> View
                  </a>
                </div>
              ))}
              <p className="text-xs text-taupe-500 pt-1">To approve a quotation, reply to the email or contact us directly.</p>
            </div>
          ) : (
            <p className="text-sm text-taupe-500 py-4">Nothing awaiting your review.</p>
          )}
        </div>

        {/* Invoices */}
        <div className="card p-5 md:col-span-2">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Invoices</h2>
            <span className="text-xs text-taupe-500">{openInvoices.length} open</span>
          </div>
          {invoices && invoices.length > 0 ? (
            <div className="divide-y divide-paper-200">
              {invoices.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between py-3 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{inv.invoice_number}</p>
                    <p className="text-xs text-taupe-600">
                      {formatCurrency(inv.total)}{inv.due_date && ['sent', 'overdue'].includes(inv.status) ? ` · due ${formatDate(inv.due_date)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`badge ${statusColor(inv.status)}`}>{statusLabel(inv.status)}</span>
                    <a href={`/invoice/${inv.id}`} target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 flex items-center justify-center rounded text-taupe-500 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="View invoice">
                      <FileText className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-taupe-500 py-4">No invoices yet.</p>
          )}
        </div>

        {/* Files */}
        <div className="card p-5 md:col-span-2">
          <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Files &amp; deliverables</h2>
          {files && files.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {files.map((f: any) => (
                <a key={f.id} href={f.drive_url ?? '#'} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-paper-100 border border-sand-300 rounded-lg px-3 py-2 text-xs text-umber-700 hover:border-brand-300 transition-colors">
                  <FolderOpen className="w-3.5 h-3.5" />
                  {f.name}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-taupe-500 py-4">No files shared yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
