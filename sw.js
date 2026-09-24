// WI-FLASH PRO - Offline Service Worker for GitHub Pages & PWA
const CACHE_NAME = 'wiflash-pro-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
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
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Cache First with Network Fallback, but BYPASS Modul Wi-Flash local LAN calls
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // CRITICAL FOR MODUL WI-FLASH HARDWARE:
  // Jangan pernah cache atau blokir request ke IP lokal flasher (192.168.4.1 atau port LAN)
  if (
    requestUrl.hostname === '192.168.4.1' ||
    requestUrl.pathname.startsWith('/set') ||
    requestUrl.pathname.startsWith('/status') ||
    requestUrl.pathname.startsWith('/reset') ||
    requestUrl.pathname.startsWith('/setwifi') ||
    requestUrl.pathname.startsWith('/resetwifi') ||
    (requestUrl.protocol === 'http:' && requestUrl.hostname !== 'localhost')
  ) {
    // Biarkan browser fetch langsung ke Modul Wi-Flash tanpa campur tangan service worker
    return;
  }

  // Hanya tangani GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version, update cache in background (Stale While Revalidate)
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Offline, ignore background update failure
          });
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(event.request).then((networkResponse) => {
        // Cache successful responses for external fonts / static assets
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
        // If offline and request is for page navigation, return cached index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html') || caches.match('./');
        }
      });
    })
  );
});