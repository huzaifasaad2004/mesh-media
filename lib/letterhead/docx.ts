import fs from 'fs/promises'
import path from 'path'
import PizZip from 'pizzip'
import type { AgencyDocumentData, DocumentBlock } from './types'

const TEMPLATE_PATH = path.join(process.cwd(), 'public', 'templates', 'MeshMedia_Letterhead.docx')

const xml = (value: string | null | undefined) => (value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

const run = (text: string, options: { bold?: boolean; italic?: boolean; color?: string; size?: number; caps?: boolean; tracking?: number } = {}) => (
  `<w:r><w:rPr>` +
  `<w:rFonts w:ascii="Avenir Next" w:hAnsi="Avenir Next"/>` +
  `<w:sz w:val="${options.size ?? 21}"/><w:szCs w:val="${options.size ?? 21}"/>` +
  (options.bold ? '<w:b/><w:bCs/>' : '') +
  (options.italic ? '<w:i/><w:iCs/>' : '') +
  (options.color ? `<w:color w:val="${options.color}"/>` : '') +
  (options.caps ? '<w:caps/>' : '') +
  (options.tracking ? `<w:spacing w:val="${options.tracking}"/>` : '') +
  `</w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r>`
)

const paragraph = (text: string, options: {
  after?: number
  before?: number
  bold?: boolean
  italic?: boolean
  color?: string
  size?: number
  caps?: boolean
  tracking?: number
  align?: 'left' | 'center' | 'right'
  borderTop?: boolean
  indentLeft?: number
  hanging?: number
  keepNext?: boolean
} = {}) => {
  const pPr = [
    `<w:spacing w:line="320" w:lineRule="auto" w:before="${options.before ?? 0}" w:after="${options.after ?? 160}"/>`,
    options.align && options.align !== 'left' ? `<w:jc w:val="${options.align}"/>` : '',
    options.keepNext ? '<w:keepNext/>' : '',
    options.indentLeft ? `<w:ind w:left="${options.indentLeft}"${options.hanging ? ` w:hanging="${options.hanging}"` : ''}/>` : '',
    options.borderTop ? '<w:pBdr><w:top w:val="single" w:sz="8" w:space="8" w:color="6E1318"/></w:pBdr>' : '',
  ].join('')
  return `<w:p><w:pPr>${pPr}</w:pPr>${run(text, options)}</w:p>`
}

function blockXml(block: DocumentBlock, number: number) {
  if (!block.text.trim()) return ''
  if (block.type === 'heading') {
    return paragraph(block.text, { after: 120, before: 180, bold: true, color: '6E1318', size: 25, keepNext: true, align: block.align })
  }
  if (block.type === 'bullet') {
    return `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:line="320" w:after="80"/></w:pPr>${run(block.text, block)}</w:p>`
  }
  if (block.type === 'numbered') {
    return paragraph(`${number}.  ${block.text}`, { after: 80, bold: block.bold, italic: block.italic, align: block.align, indentLeft: 360, hanging: 360 })
  }
  return paragraph(block.text, { bold: block.bold, italic: block.italic, align: block.align })
}

function documentBody(data: AgencyDocumentData) {
  let numbered = 0
  const blocks = (data.content ?? []).map((block) => {
    if (block.type === 'numbered') numbered += 1
    else numbered = 0
    return blockXml(block, numbered)
  }).join('')

  return [
    paragraph(new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date()), { after: 420, color: '9C9384', size: 13, caps: true, tracking: 20 }),
    data.recipient_name ? paragraph(data.recipient_name, { bold: true, after: 40 }) : '',
    data.recipient_title ? paragraph(data.recipient_title, { color: '6E655B', size: 19, after: 40 }) : '',
    data.company_name ? paragraph(data.company_name, { color: '6E655B', size: 19, after: 40 }) : '',
    data.address_line ? paragraph(data.address_line, { color: '6E655B', size: 19, after: 380 }) : '',
    paragraph(`SUBJECT:  ${data.subject}`, { after: 300, color: '6E1318', bold: true, size: 17, caps: true, tracking: 20 }),
    paragraph(`Dear ${data.salutation_name || data.recipient_name || 'Sir/Madam'},`, { after: 240 }),
    blocks,
    paragraph(data.closing || 'Warm regards,', { after: 760 }),
    paragraph('', { borderTop: true, after: 30 }),
    paragraph(data.signatory_name, { bold: true, after: 30 }),
    paragraph(data.signatory_role, { color: '9C9384', size: 13, caps: true, tracking: 18, after: 0 }),
  ].join('')
}

export async function renderLetterheadDocx(data: AgencyDocumentData): Promise<Buffer> {
  const source = await fs.readFile(TEMPLATE_PATH)
  const zip = new PizZip(source)
  const part = zip.file('word/document.xml')
  if (!part) throw new Error('Letterhead template is missing word/document.xml')
  const original = part.asText()
  const section = original.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0]
  if (!section) throw new Error('Letterhead template section properties were not found')

  const next = original.replace(/<w:body>[\s\S]*<\/w:body>/, `<w:body>${documentBody(data)}${section}</w:body>`)
  zip.file('word/document.xml', next)
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
}
