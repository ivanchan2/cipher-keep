// 離線快取控制核心
const CACHE_NAME = 'cipherkeep-offline-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+TC:wght@300;400;500;700&display=swap'
];

// 安裝階段：下載並預先快取核心資源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 使用 Promise.allSettled 防禦：即使某個 CDN 在安裝當下斷線，其餘資源依然能成功快取，不阻礙 PWA 安裝
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((url) => {
          return cache.add(url).catch((err) => {
            console.warn(`[PWA sw.js] 無法快取資源: ${url}`, err);
          });
        })
      );
    }).then(() => {
      // 讓 Service Worker 立即接管，不需等待重整
      return self.skipWaiting();
    })
  );
});

// 激活階段：清理舊版本快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[PWA sw.js] 清除過期快取庫:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      // 讓當前已開啟的網頁立即被 Service Worker 控制
      return self.clients.claim();
    })
  );
});

// 攔截請求階段：完美支援離線存取
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 1. 如果快取庫裡有配對檔案，立即返回 (Offline First / 離線優先)
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. 如果沒有，發起網路請求，並動態快取新下載的資源
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // 3. 斷網時的終極兜底：若使用者在完全斷網下訪問其他變體路徑，直接返回快取的 index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html') || caches.match('./');
        }
      });
    })
  );
});