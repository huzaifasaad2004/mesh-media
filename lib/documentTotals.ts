interface Item { quantity: number; unit_price: number }

export function computeTotals(
  items: Item[],
  discountType: string | undefined,
  discountValue: number | undefined,
  taxRate: number | undefined
) {
  const subtotal = (items ?? []).reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0)
  const dValue = Number(discountValue) || 0
  const discountAmount = discountType === 'percent' ? subtotal * (dValue / 100) : discountType === 'flat' ? dValue : 0
  const taxable = Math.max(0, subtotal - discountAmount)
  const rate = Number(taxRate) || 0
  const taxAmount = taxable * (rate / 100)
  const total = taxable + taxAmount
  return { subtotal, discountAmount, taxable, taxAmount, total }
}
