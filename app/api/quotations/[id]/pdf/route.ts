import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceRead, serviceRole } from '@/lib/apiAuth'
import { renderDocumentPdf } from '@/lib/pdf/DocumentPdf'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceRead()
  if ('res' in auth) return auth.res

  const { data: q, error } = await serviceRole()
    .from('quotations')
    .select('*, client:clients(company_name, email, contact_person, phone, address), items:quotation_items(*)')
    .eq('id', params.id)
    .single()
  if (error || !q) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })

  const items = (q.items ?? []).map((i: any) => ({
    description: i.description, quantity: Number(i.quantity),
    unit_price: Number(i.unit_price), amount: Number(i.amount),
  }))
  const subtotal = items.reduce((s: number, i: any) => s + i.amount, 0)
  const discountAmount = q.discount_type === 'percent' ? subtotal * (Number(q.discount_value ?? 0) / 100)
    : q.discount_type === 'flat' ? Number(q.discount_value ?? 0) : 0

  const pdf = await renderDocumentPdf({
    type: 'quotation',
    number: q.quote_number,
    issueDate: q.issue_date,
    dueOrExpiryDate: q.expiry_date,
    dueOrExpiryLabel: 'Valid Until',
    subject: q.subject,
    client: q.client ?? { company_name: 'Unknown' },
    items,
    subtotal,
    discountAmount,
    taxRate: Number(q.tax_rate ?? 0),
    taxAmount: Number(q.tax_amount ?? 0),
    total: Number(q.total ?? 0),
    notes: q.notes,
    terms: q.terms,
    baseUrl: process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin,
  })

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${q.quote_number}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
