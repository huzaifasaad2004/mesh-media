import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceRead, serviceRole } from '@/lib/apiAuth'
import { renderDocumentPdf } from '@/lib/pdf/DocumentPdf'
import { archivePdfBestEffort } from '@/lib/documentArchive'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceRead()
  if ('res' in auth) return auth.res

  const { data: inv, error } = await serviceRole()
    .from('invoices')
    .select('*, client:clients(company_name, email, contact_person, phone, address), items:invoice_items(*)')
    .eq('id', params.id)
    .single()
  if (error || !inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const items = (inv.items ?? []).map((i: any) => ({
    description: i.description, quantity: Number(i.quantity),
    unit_price: Number(i.unit_price), amount: Number(i.amount),
  }))
  const subtotal = items.reduce((s: number, i: any) => s + i.amount, 0)
  const discountAmount = inv.discount_type === 'percent' ? subtotal * (Number(inv.discount_value ?? 0) / 100)
    : inv.discount_type === 'flat' ? Number(inv.discount_value ?? 0) : 0

  const pdf = await renderDocumentPdf({
    type: 'invoice',
    number: inv.invoice_number,
    issueDate: inv.issue_date,
    dueOrExpiryDate: inv.due_date,
    dueOrExpiryLabel: 'Due Date',
    subject: inv.subject,
    client: inv.client ?? { company_name: 'Unknown' },
    items,
    subtotal,
    discountAmount,
    taxRate: Number(inv.tax_rate ?? 0),
    taxAmount: Number(inv.tax_amount ?? 0),
    total: Number(inv.total ?? 0),
    status: inv.status,
    amountPaid: Number(inv.amount_paid ?? 0),
    paidDate: inv.paid_date,
    notes: inv.notes,
    terms: inv.terms,
    baseUrl: process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin,
  })

  await archivePdfBestEffort(serviceRole(), {
    entityType: 'invoice',
    entityId: inv.id,
    documentNumber: inv.invoice_number,
    clientName: inv.client?.company_name,
    pdf: Buffer.from(pdf),
    generatedBy: auth.user.id,
  })

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${inv.invoice_number}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
