'use client'

import { useAiChat } from '@/components/AiChatContext'

const CYAN = '#2BD6D6' // Aether-only accent — never on general UI

export default function AskAetherButton({ companyName }: { companyName: string }) {
  const { ask } = useAiChat()
  return (
    <button
      onClick={() => ask(`Tell me everything you know about ${companyName} — status, open invoices, active projects, and anything relevant from notes.`, { name: companyName })}
      className="btn-secondary btn-sm"
      style={{ borderColor: CYAN, color: CYAN }}
      title="Ask Aether about this client"
    >
      <img src="/brand/aether_avatar_64.png" alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
      Ask Aether
    </button>
  )
}
