/* =============================================================
   佛音靈氣・佛學系統 — Service Worker
   - 快取 app shell（index/app/styles/data/manifest/icons），令離線都開到
   - 音檔（audio/，大檔、要用 HTTP Range）一律交返瀏覽器直接上網，唔快取
   - 換版本時改 CACHE 名，activate 會清走舊 cache
   ============================================================= */
'use strict';

var CACHE = 'foxue-shell-v1.4.0-20261117';
var SHELL = [
  './',
  './index.html',
  './guangming.html',
  './app.js',
  './guangming.js',
  './styles.css',
  './guangming.css',
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
