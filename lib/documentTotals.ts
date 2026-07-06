interface Item { quantity: number; unit_price: number }

// Money is stored/displayed at 2dp — never let float precision leak into
// stored totals (sum-of-lines must equal the displayed total).
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export function computeTotals(
  items: Item[],
  discountType: string | undefined,
  discountValue: number | undefined,
  taxRate: number | undefined
) {
  const subtotal = round2((items ?? []).reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0))
  const dValue = Number(discountValue) || 0
  const discountAmount = round2(discountType === 'percent' ? subtotal * (dValue / 100) : discountType === 'flat' ? dValue : 0)
  const taxable = Math.max(0, round2(subtotal - discountAmount))
  const rate = Number(taxRate) || 0
  const taxAmount = round2(taxable * (rate / 100))
  const total = round2(taxable + taxAmount)
  return { subtotal, discountAmount, taxable, taxAmount, total }
}
