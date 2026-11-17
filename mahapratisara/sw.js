/* 大隨求陀羅尼・Service Worker
   - 導航：network-first，離線回 index.html
   - 靜態：cache-first
   - 音檔：完全不攔截，保留 HTTP Range 206
   - Firebase／Google CDN：不攔截
*/
const CACHE = 'mahapratisara-v1.0.9';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './data.js',
  './native-audio.js',
  './app.js',
  './manifest.webmanifest',
  './icons/favicon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') { return; }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) { return; }
  if (/\.(mp3|m4a|ogg|wav)(\?|$)/i.test(url.pathname)) { return; }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-cache' }).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      }).catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  /* 程式碼／樣式／資料：network-first，避免更新後仍用舊 app.js／data.js */
  if (/\.(js|css|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' }).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      }).catch(() => caches.match(request).then((cached) => cached || new Response('', { status: 504 })))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) { return cached; }
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      });
    })
  );
});
