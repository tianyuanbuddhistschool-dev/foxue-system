/* 光明真言・獨立課誦系統 v3.0.0 — Service Worker
   - 只快取 app shell（單頁、data、i18n、Firebase 設定、icons）
   - 音檔（/audio/、Range）一律交返瀏覽器直接上網，唔快取
   - 換版本時改 CACHE 名，activate 清走舊 cache */
'use strict';

var CACHE = 'guangming-standalone-v3.0.1-20261118';
var SHELL = [
  './',
  './index.html',
  './guangming.html',
  './guangming-practice.html',
  './data.js',
  './guangming-i18n.js',
  './firebase-config.js',
  './native-audio.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        return key === CACHE ? Promise.resolve() : caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') { return; }
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) { return; }
  if (url.pathname.indexOf('/audio/') !== -1 || req.headers.has('range')) { return; }

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
          fetch(req).then(function (res) { if (res && res.ok) { cache.put(req, res.clone()); } }).catch(function () {});
          return cached;
        }
        return fetch(req).then(function (res) {
          if (res && res.ok) { cache.put(req, res.clone()); }
          return res;
        }).catch(function () { return Response.error(); });
      });
    })
  );
});
