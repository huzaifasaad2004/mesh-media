import webpush from 'web-push'
import { serviceRole } from '@/lib/apiAuth'

type PushPayload = { title: string; body: string; href: string; tag?: string }

function configured() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:hello@m3m.ae'
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(subject, publicKey, privateKey)
  return true
}

export async function sendBrowserPush(userIds: string[], payload: PushPayload) {
  if (!userIds.length || !configured()) return
  const db = serviceRole()
  const { data: subscriptions } = await db.from('browser_push_subscriptions')
    .select('id, endpoint, p256dh, auth').in('user_id', userIds)

  await Promise.all((subscriptions ?? []).map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, JSON.stringify(payload), { TTL: 3600 })
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await db.from('browser_push_subscriptions').delete().eq('id', subscription.id)
      } else {
        console.error('Browser push failed', error?.statusCode ?? error?.message ?? error)
      }
    }
  }))
}
