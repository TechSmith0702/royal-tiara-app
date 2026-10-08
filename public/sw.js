// Royal Tiara service worker: receives push notifications and opens the right
// page when one is tapped. It deliberately caches nothing, so the app is always
// the latest version from the website.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Royal Tiara', {
      body: data.body || '',
      icon: '/app-icon.png',
      badge: '/badge.png',
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { link: data.link || '/' },
    }),
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = new URL(event.notification.data?.link || '/', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      // Reuse an open Royal Tiara window if there is one.
      for (const win of windows) {
        if (new URL(win.url).origin === self.location.origin && 'focus' in win) {
          return win.focus().then(w => (w && 'navigate' in w ? w.navigate(url) : w))
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
