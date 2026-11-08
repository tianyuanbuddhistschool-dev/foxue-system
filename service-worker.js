/* 佛學系統 Service Worker — 離線快取 + 音頻背景播放支援 */
const CACHE_NAME = "foapp-v1";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];
const AUDIO_ASSETS = [
  "/audio/guangming.m4a",
  "/audio/dainichi.m4a"
];

/* 安裝：快取核心檔案 */
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(CORE_ASSETS).catch(function (e) {
        console.warn("部分檔案快取失敗：", e.message);
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

/* 啟用：清理舊快取 */
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_NAME) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* 攔截請求：音頻用「網絡優先 + 回退快取 + Range 支援」，其他用「快取優先」 */
self.addEventListener("fetch", function (event) {
  const url = new URL(event.request.url);
  const isAudio = event.request.destination === "audio" ||
                  /\.m4a$|\.mp3$|\.aac$/.test(url.pathname);

  if (isAudio) {
    event.respondWith(handleAudioRequest(event.request));
    return;
  }

  // 其他資源：快取優先
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (resp) {
        // 只快取 GET 同 http/https
        if (event.request.method === "GET" && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
        }
        return resp;
      });
    })
  );
});

/* 音頻請求處理：支援 Range（播放器 seek 需要），網絡優先，離線時回退 */
function handleAudioRequest(request) {
  return fetch(request).then(function (response) {
    // 快取一份（音頻大，用 Range 會返 206，呢度快取完整版需要重新 fetch 無 Range）
    if (request.method === "GET" && (response.status === 200 || response.status === 206)) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(function (cache) {
        // 嘗試快取完整版
        fetch(request.url, { headers: {} }).then(function (fullRes) {
          if (fullRes.ok) cache.put(request.url, fullRes);
        }).catch(function () {});
      });
    }
    return response;
  }).catch(function () {
    // 離線回退：快取
    return caches.match(request.url).then(function (cached) {
      if (cached) return cached;
      return new Response("", { status: 404 });
    });
  });
}
