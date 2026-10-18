/* Offline shell for the StudyTracker PWA.
   Upload this file beside index.html on GitHub Pages. */
const CACHE_PREFIX = 'study-tracker-pwa-';
const CACHE_NAME = CACHE_PREFIX + 'v4';
const CORE_PATHS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  './atom_background.webp?v=3'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Optional assets may not exist in every deployment; one missing file must
    // not prevent the service worker from installing.
    await Promise.all(CORE_PATHS.map(async path => {
      try {
        const url = new URL(path, self.registration.scope);
        const response = await fetch(url.href, { cache: 'reload' });
        if (response.ok && (response.type === 'basic' || response.type === 'default')) {
          await cache.put(url.href, response.clone());
        }
      } catch (error) {
        // Continue installation if an optional asset is missing or offline.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          cache.put(request, response.clone()).catch(() => {});
          return response;
        }
      } catch (error) {
        // Fall back to the saved app shell when offline.
      }
      const cached = await caches.match(request);
      if (cached) return cached;
      const indexUrl = new URL('./index.html', self.registration.scope).href;
      const indexResponse = await caches.match(indexUrl);
      if (indexResponse) return indexResponse;
      const rootUrl = new URL('./', self.registration.scope).href;
      const rootResponse = await caches.match(rootUrl);
      if (rootResponse) return rootResponse;
      return new Response('Приложение ещё не сохранено для работы офлайн. Открой сайт с интернетом хотя бы один раз.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    })());
    return;
  }

  // Cache-first for local assets, with network fallback and cache update.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (error) {
      return new Response('', { status: 504, statusText: 'Offline asset unavailable' });
    }
  })());
});
