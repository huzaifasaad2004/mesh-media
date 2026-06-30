const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
  'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']

function chunk(n: number): string {
  if (n === 0) return ''
  if (n < 20) return ones[n]
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
  return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + chunk(n % 100) : '')
}

export function amountToWords(amount: number): string {
  const floored = Math.floor(amount)
  const fils = Math.round((amount - floored) * 100)
  if (floored === 0) return 'UAE Dirham Zero'
  let result = 'UAE Dirham '
  if (floored >= 1_000_000) {
    result += chunk(Math.floor(floored / 1_000_000)) + ' Million '
    const rem = floored % 1_000_000
    if (rem >= 1000) result += chunk(Math.floor(rem / 1000)) + ' Thousand '
    if (rem % 1000) result += chunk(rem % 1000)
  } else if (floored >= 1000) {
    result += chunk(Math.floor(floored / 1000)) + ' Thousand'
    if (floored % 1000) result += ' ' + chunk(floored % 1000)
  } else {
    result += chunk(floored)
  }
  if (fils > 0) result += ` and ${fils}/100 Fils`
  return result.trim()
}
