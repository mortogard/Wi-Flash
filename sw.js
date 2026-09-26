// WI-FLASH PRO - Offline Service Worker
const CACHE_NAME = 'wiflash-pro-v4';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)).catch((err) => {
      console.warn('[SW] Cache prefetch warn:', err);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // CRITICAL: Bypass all Modul Wi-Flash (ESP8266) local LAN endpoints (192.168.4.1)
  if (
    requestUrl.hostname === '192.168.4.1' ||
    requestUrl.pathname.startsWith('/set') ||
    requestUrl.pathname.startsWith('/status') ||
    requestUrl.pathname.startsWith('/reset') ||
    requestUrl.pathname.startsWith('/setwifi') ||
    requestUrl.pathname.startsWith('/resetwifi') ||
    (requestUrl.protocol === 'http:' && requestUrl.hostname !== 'localhost')
  ) {
    return;
  }

  if (event.request.method !== 'GET') {
    return;
  }

  // Network First with Cache Fallback for dynamic PWA assets
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.url.startsWith('http')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html') || caches.match('/');
          }
        });
      })
  );
});
