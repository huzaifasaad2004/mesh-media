// Fixed geometry of a Document Studio contract's signature page (the PDF's last page).
// LetterheadPdf draws the signature lines here and the e-signature send places its
// fields on exactly the same spots, so the boxes always sit on the lines.
export const A4 = { width: 595.28, height: 841.89 }

export const CONTRACT_SIGNATURE_COLUMNS = {
  agency: { left: 85, width: 205 },
  client: { left: 318, width: 215 },
}

export const CONTRACT_SIGNATURE_ROWS = {
  partyLabelTop: 236,
  signatureTop: 318, signatureHeight: 58,
  dateTop: 416, dateHeight: 24, dateWidth: 130,
}

/** e-signature fields (top-left-origin page fractions) for one party's column. */
export function contractSignatureFields(party: 'agency' | 'client') {
  const col = CONTRACT_SIGNATURE_COLUMNS[party]
  const r = CONTRACT_SIGNATURE_ROWS
  return [
    { field_type: 'signature' as const, x: col.left / A4.width, y: r.signatureTop / A4.height, width: col.width / A4.width, height: r.signatureHeight / A4.height },
    { field_type: 'date' as const, x: col.left / A4.width, y: r.dateTop / A4.height, width: r.dateWidth / A4.width, height: r.dateHeight / A4.height },
  ]
}
