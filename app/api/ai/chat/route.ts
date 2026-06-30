import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const SYSTEM_PROMPT = `You are Meshi, the AI assistant for MeshMedia Agency OS — an internal ERP system for MeshMedia For Marketing and PR, a marketing agency based in Abu Dhabi, UAE.

You help the team with:
- Writing professional invoice & quotation descriptions
- Summarizing client/financial data
- Business advice and strategy
- Drafting emails and messages to clients
- Explaining how to use the ERP system
- General agency management questions

Keep responses concise and professional. When relevant, use AED as currency. Be friendly but business-focused.`

async function callGemini(messages: { role: string; content: string }[], context?: string) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const systemContent = context ? `${SYSTEM_PROMPT}\n\nCurrent data context:\n${context}` : SYSTEM_PROMPT

  const contents = [
    { role: 'user', parts: [{ text: systemContent + '\n\n[Conversation starts]' }] },
    { role: 'model', parts: [{ text: 'Understood! I\'m Meshi, ready to help MeshMedia. How can I assist?' }] },
    ...messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  ]

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 1024, temperature: 0.7 } }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? 'Gemini error')
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    // Build lightweight context from DB
    const db = admin()
    const [{ data: invoices }, { data: clients }, { data: expenses }] = await Promise.all([
      db.from('invoices').select('total, status, invoice_number').order('created_at', { ascending: false }).limit(10),
      db.from('clients').select('company_name, status').limit(20),
      db.from('expenses').select('amount, category').limit(20),
    ])

    const paidRevenue = (invoices ?? []).filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)
    const outstanding = (invoices ?? []).filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + i.total, 0)
    const totalExpenses = (expenses ?? []).reduce((s, e) => s + e.amount, 0)
    const activeClients = (clients ?? []).filter(c => c.status === 'active').length

    const context = `
- Active clients: ${activeClients} / ${(clients ?? []).length} total
- Revenue collected (paid invoices): AED ${paidRevenue.toLocaleString()}
- Outstanding (sent/overdue): AED ${outstanding.toLocaleString()}
- Total expenses: AED ${totalExpenses.toLocaleString()}
- Net: AED ${(paidRevenue - totalExpenses).toLocaleString()}
- Recent invoices: ${(invoices ?? []).slice(0, 5).map(i => `${i.invoice_number} (${i.status}, AED ${i.total})`).join(', ')}
`
    const reply = await callGemini(messages, context)
    return NextResponse.json({ reply })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
