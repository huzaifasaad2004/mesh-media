import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { toolDeclarations, executeTool, WRITE_TOOLS, type ToolContext } from '@/lib/aiTools'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const MODEL = 'gemini-2.5-flash'

function systemPrompt(role: string) {
  return `You are Aether — guardian of the brand-verse and AI assistant inside Mesh Media Agency OS, the internal ERP of MeshMedia For Marketing and PR, a marketing & PR agency in Abu Dhabi, UAE.

Persona: insightful, composed, a little cinematic — you see what a brand can become. Concise and genuinely helpful. Never break character or say "as an AI language model".

You have live access to the agency's data through tools. Use them:
- For any question about money, clients, tasks, projects, or who owes what — CALL a tool to get real numbers rather than guessing.
- When the user asks you to create or do something (a task, a client), CALL the matching tool. After a create tool succeeds, confirm what you did in one short sentence.
- If a tool reports a name wasn't found, tell the user plainly.

Today's date is ${new Date().toISOString().split('T')[0]}. Convert relative dates ("Friday", "next week") to absolute YYYY-MM-DD before calling tools.
Currency is AED. The current user's role is "${role}". If a tool returns a permission error, tell the user they don't have access for that action.
Keep answers tight — a sentence or two, or a short list. Use **bold** for key figures.`
}

async function callGemini(body: any) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? 'Gemini error')
  return data
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const role = profile?.role ?? 'member'

    const { messages } = await req.json()

    const ctx: ToolContext = { db: admin(), role, userId: user.id }

    // Build Gemini conversation
    const contents: any[] = (messages ?? []).map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const baseBody = {
      system_instruction: { parts: [{ text: systemPrompt(role) }] },
      tools: [{ function_declarations: toolDeclarations }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 1024 },
    }

    const actions: string[] = []
    let didWrite = false

    // Function-calling loop (cap iterations to stay bounded)
    for (let i = 0; i < 6; i++) {
      const data = await callGemini({ ...baseBody, contents })
      const candidate = data.candidates?.[0]
      const parts = candidate?.content?.parts ?? []
      const calls = parts.filter((p: any) => p.functionCall)

      if (calls.length === 0) {
        const text = parts.map((p: any) => p.text).filter(Boolean).join('\n').trim()
        return NextResponse.json({ reply: text || 'Done.', actions, didWrite })
      }

      // Record the model's function-call turn
      contents.push({ role: 'model', parts })

      // Execute every requested call, append responses
      const responseParts: any[] = []
      for (const c of calls) {
        const { name, args } = c.functionCall
        const result = await executeTool(name, args ?? {}, ctx)
        if (WRITE_TOOLS.includes(name) && result?.created) { didWrite = true; actions.push(name) }
        responseParts.push({ functionResponse: { name, response: { result } } })
      }
      contents.push({ role: 'user', parts: responseParts })
    }

    // Fell through the loop — ask for a final summary without tools
    const finalData = await callGemini({
      system_instruction: baseBody.system_instruction,
      contents,
      generationConfig: baseBody.generationConfig,
    })
    const text = (finalData.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text).filter(Boolean).join('\n').trim()
    return NextResponse.json({ reply: text || 'Done.', actions, didWrite })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
