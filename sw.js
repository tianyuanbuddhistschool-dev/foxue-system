/* =============================================================
   佛音靈氣・佛學系統 — Service Worker
   - 快取 app shell（index/app/styles/data/manifest/icons），令離線都開到
   - 音檔（audio/，大檔、要用 HTTP Range）一律交返瀏覽器直接上網，唔快取
   - 換版本時改 CACHE 名，activate 會清走舊 cache
   ============================================================= */
'use strict';

var CACHE = 'guangming-shell-v2.3.4-20261118';
var SHELL = [
  './',
  './index.html',
  './guangming.html',
  './library.html',
  './app.js',
  './guangming.js',
  './guangming-i18n.js',
  './firebase-config.js',
  './native-audio.js',
  './styles.css',
  './guangming.css',
  './theme-black-gold.css',
  './theme.js',
  './data.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE) { return caches.delete(key); }
        return Promise.resolve();
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') { return; }

  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) { return; }

  /* 音檔：大檔＋Range 請求，唔經 cache，直接上網（GitHub Pages 支援 206） */
  if (url.pathname.indexOf('/audio/') !== -1 || req.headers.has('range')) { return; }

  /* 導航請求（HTML）：network-first —— 一定要拿到最新版面，離線才退回 cache。
     之前用 stale-while-revalidate，用戶會見到舊版面（例如手機橫向溢出已修好但仍然見到舊樣）。 */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); }).catch(function () {});
        }
        return res;
      }).catch(function () {
        return caches.open(CACHE).then(function (cache) {
          return cache.match(req, { ignoreSearch: true }).then(function (cached) {
            return cached || cache.match('./guangming.html') || cache.match('./index.html') || Response.error();
          });
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req, { ignoreSearch: true }).then(function (cached) {
        if (cached) {
          /* 背景更新（stale-while-revalidate） */
          fetch(req).then(function (res) {
            if (res && res.ok) { cache.put(req, res.clone()); }
          }).catch(function () { /* 離線就繼續用 cache */ });
          return cached;
        }
        return fetch(req).then(function (res) {
          if (res && res.ok) { cache.put(req, res.clone()); }
          return res;
        }).catch(function () {
          /* 離線導航：退回 index.html */
          if (req.mode === 'navigate') {
            return cache.match('./index.html');
          }
          return Response.error();
        });
      });
    })
  );
});
