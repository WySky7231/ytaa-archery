// Offline support for the installed app.
// - Pages: network first, falling back to the cached app shell when offline.
// - App files, images, sounds and fonts: served from cache, fetched once.
// BASE is the folder the app is served from ("/" or e.g. "/ytaa-archery/").
const CACHE = 'archery-v2'
const BASE = new URL('./', self.location.href).pathname
const SHELL = [
  '',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'bow.jpg',
  'cheer.mp3',
  'flame.png',
  'lightbulb.png',
  'logo.png',
  'logo-arrow.png',
  'logo-base.png',
].map((path) => BASE + path)

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      await cache.addAll(SHELL)
      // The page's JS/CSS loaded before this worker existed, so cache them now.
      const html = await (await fetch(BASE, { cache: 'no-store' })).text()
      const assets = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map((m) => m[1])
      await cache.addAll(assets)
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  const sameOrigin = url.origin === self.location.origin
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if (!sameOrigin && !isFont) return

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req)
          if (res.ok) {
            const cache = await caches.open(CACHE)
            cache.put(BASE, res.clone())
            return res
          }
          // Some hosts (GitHub Pages) answer in-app routes like /streak with a "not found"
          // page; show the app itself instead.
          return (await caches.match(BASE)) || res
        } catch {
          return (await caches.match(BASE)) || Response.error()
        }
      })(),
    )
    return
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(req)
      if (cached) return cached
      const res = await fetch(req)
      if (res.ok || res.type === 'opaque') {
        const cache = await caches.open(CACHE)
        cache.put(req, res.clone())
      }
      return res
    })(),
  )
})
