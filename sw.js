/* Schedule PWA service worker — bump CACHE_VERSION whenever app assets change. */
const CACHE_VERSION = 'schedule-pwa-v4';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './atom_background.webp?v=3'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    // Cache each asset independently: one missing optional file must not break install.
    await Promise.all(APP_SHELL.map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (response.ok) await cache.put(url, response.clone());
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('schedule-pwa-') && key !== CACHE_VERSION).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION);
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response && response.ok) await cache.put('./index.html', response.clone());
        return response;
      } catch (_) {
        return (await cache.match(request)) || (await cache.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Stale-while-revalidate for same-origin assets, so updates arrive without blocking UI.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);
    const network = fetch(request).then((response) => {
      if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    }).catch(() => null);
    if (cached) {
      event.waitUntil(network.then(() => undefined));
      return cached;
    }
    return (await network) || Response.error();
  })());
});
