// WI-FLASH PRO - Offline Service Worker for GitHub Pages & PWA
const CACHE_NAME = 'wiflash-pro-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

// Install Event: Cache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[SW] Cache addAll partial fallback:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Cache First with Network Fallback, but BYPASS ESP-12F local LAN calls
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Jangan pernah tangani request ke IP lokal flasher hardware
  if (
    requestUrl.hostname === '192.168.4.1' ||
    requestUrl.pathname.startsWith('/set') ||
    requestUrl.pathname.startsWith('/status') ||
    requestUrl.pathname.startsWith('/reset') ||
    (requestUrl.protocol === 'http:' && requestUrl.hostname !== 'localhost')
  ) {
    return; // Biarkan browser fetch langsung ke modul ESP-12F
  }

  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (event.request.url.startsWith('http://') || event.request.url.startsWith('https://'))
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html') || caches.match('./');
        }
      });
    })
  );
});