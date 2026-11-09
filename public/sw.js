// Royal Tiara service worker: receives push notifications and opens the right
// page when one is tapped. The app itself is never cached, so it is always the
// latest version from the website. The only things stored on the phone are the
// offline screen and its logo, shown when a page is opened with no internet.

const OFFLINE_CACHE = 'rt-offline-v1'
const OFFLINE_PAGE = '/offline.html'

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE)
      .then(cache => cache.addAll([OFFLINE_PAGE, '/logo.webp']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== OFFLINE_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  // The offline page's logo comes from the phone when there is no connection.
  if (new URL(request.url).pathname === '/logo.webp') {
    event.respondWith(fetch(request).catch(() => caches.match('/logo.webp')))
    return
  }
  // Only whole-page loads are touched; everything else goes to the network as usual.
  if (request.mode !== 'navigate') return
  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_PAGE)))
})

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
