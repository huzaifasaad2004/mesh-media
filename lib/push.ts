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

/** Phones running the Mesh Media app register an Expo push token in the same
 *  table as browsers (endpoint = the token, p256dh = 'expo'). */
export const isExpoToken = (endpoint: string) => /^Expo(nent)?PushToken\[.+\]$/.test(endpoint)

async function sendExpoPush(rows: { id: string; endpoint: string }[], payload: PushPayload) {
  if (!rows.length) return
  const db = serviceRole()
  // Expo accepts up to 100 messages per request; free, no key needed.
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100)
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch.map((r) => ({
          to: r.endpoint, title: payload.title, body: payload.body, sound: 'default',
          data: { href: payload.href }, ...(payload.tag ? { threadId: payload.tag } : {}),
        }))),
      })
      const json: any = await res.json().catch(() => null)
      const tickets: any[] = Array.isArray(json?.data) ? json.data : []
      const dead = batch.filter((_, j) => tickets[j]?.details?.error === 'DeviceNotRegistered').map((r) => r.id)
      if (dead.length) await db.from('browser_push_subscriptions').delete().in('id', dead)
    } catch (error: any) {
      console.error('Expo push failed', error?.message ?? error)
    }
  }
}

export async function sendBrowserPush(userIds: string[], payload: PushPayload) {
  if (!userIds.length) return
  const db = serviceRole()
  const { data: all } = await db.from('browser_push_subscriptions')
    .select('id, endpoint, p256dh, auth').in('user_id', userIds)
  const phones = (all ?? []).filter((s) => isExpoToken(s.endpoint))
  const browsers = (all ?? []).filter((s) => !isExpoToken(s.endpoint))

  await sendExpoPush(phones, payload)
  if (!browsers.length || !configured()) return
  await Promise.all(browsers.map(async (subscription) => {
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
