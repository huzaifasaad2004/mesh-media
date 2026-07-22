self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(self.registration.showNotification(data.title || 'Mesh Chat', {
    body: data.body || 'You have a new message',
    icon: '/icon-192.png',
    badge: '/favicon-32.png',
    tag: data.tag || 'mesh-chat',
    data: { href: data.href || '/chat' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const href = new URL(event.notification.data?.href || '/chat', self.location.origin).href
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url.startsWith(self.location.origin))
    if (existing) return existing.focus().then(() => existing.navigate(href))
    return clients.openWindow(href)
  }))
})
