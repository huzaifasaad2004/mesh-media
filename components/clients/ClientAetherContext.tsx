'use client'

import { useEffect } from 'react'
import { useAiChat } from '@/components/AiChatContext'

/**
 * Ambient — no UI of its own. Just being on a client's page tags the
 * floating Aether widget with that client, so typing "tell me about this
 * client" directly into the global launcher resolves correctly even if you
 * never clicked the "Ask Aether" button. Clears on unmount so leaving the
 * page doesn't leave a stale client tag on the conversation.
 */
export default function ClientAetherContext({ companyName }: { companyName: string }) {
  const { setClientContext, clearClientContext } = useAiChat()

  useEffect(() => {
    setClientContext({ name: companyName })
    return () => clearClientContext()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyName])

  return null
}
