import { PDFDocument, PDFImage, rgb } from 'pdf-lib'

export interface FilledField {
  page_number: number
  field_type: 'signature' | 'name' | 'date'
  x: number // fraction of page width, from left
  y: number // fraction of page height, from top
  width: number // fraction of page width
  height: number // fraction of page height
  value: string // base64 PNG data URL (signature) or plain text (name/date)
}

/**
 * Stamps filled field values onto the original PDF bytes and returns a
 * flattened copy. Coordinates are stored as top-left-origin fractions of the
 * page (matching how they're captured in the browser); pdf-lib draws from the
 * bottom-left, so y gets flipped per page height here.
 */
export async function mergeFieldsIntoPdf(originalBytes: Uint8Array, fields: FilledField[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalBytes)
  const pages = pdfDoc.getPages()
  const imageCache = new Map<string, PDFImage>()

  for (const field of fields) {
    const page = pages[field.page_number - 1]
    if (!page || !field.value) continue
    const { width: pw, height: ph } = page.getSize()
    const boxX = field.x * pw
    const boxW = field.width * pw
    const boxH = field.height * ph
    const boxYTop = field.y * ph
    const boxYBottom = ph - boxYTop - boxH // flip to pdf-lib's bottom-left origin

    if (field.field_type === 'signature' && field.value.startsWith('data:image')) {
      let image = imageCache.get(field.value)
      if (!image) {
        const base64 = field.value.split(',')[1]
        const bytes = Buffer.from(base64, 'base64')
        image = field.value.includes('image/jpeg') ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes)
        imageCache.set(field.value, image)
      }
      // Preserve aspect ratio within the placed box instead of stretching.
      const scale = Math.min(boxW / image.width, boxH / image.height)
      const drawW = image.width * scale
      const drawH = image.height * scale
      page.drawImage(image, {
        x: boxX + (boxW - drawW) / 2,
        y: boxYBottom + (boxH - drawH) / 2,
        width: drawW,
        height: drawH,
      })
    } else {
      const fontSize = Math.min(14, boxH * 0.7)
      page.drawText(field.value, {
        x: boxX + 2,
        y: boxYBottom + (boxH - fontSize) / 2,
        size: fontSize,
        color: rgb(0.08, 0.07, 0.07),
      })
    }
  }

  return pdfDoc.save()
}
