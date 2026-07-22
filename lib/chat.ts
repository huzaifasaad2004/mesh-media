import { serviceRole } from '@/lib/apiAuth'

export async function canAccessChatChannel(userId: string, channelId: string) {
  const db = serviceRole()
  const { data: channel } = await db.from('chat_channels').select('id, is_private').eq('id', channelId).maybeSingle()
  if (!channel) return false
  if (!channel.is_private) return true
  const { data: member } = await db.from('chat_channel_members').select('user_id').eq('channel_id', channelId).eq('user_id', userId).maybeSingle()
  return !!member
}

export async function attachSignedUrls<T extends Record<string, any>>(messages: T[]) {
  const db = serviceRole()
  return Promise.all(messages.map(async (message) => {
    if (!message.attachment_path) return message
    const { data } = await db.storage.from('chat-attachments').createSignedUrl(message.attachment_path, 3600)
    return { ...message, attachment_url: data?.signedUrl ?? null }
  }))
}
