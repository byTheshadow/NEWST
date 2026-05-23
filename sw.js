/*============================================================SERVICE WORKER —缓存策略
   ============================================================ */

const CACHE_NAME = 'shadow-v1';

/* ---- 需要缓存的静态资源列表 ---- */
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './core/db.js',
  './core/router.js',
  './core/state.js',
  './core/utils.js',
  './screens/lockscreen.js',
  './screens/homescreen.js',
  './screens/settings.js'
];

/* ---- Install：预缓存静态资源 ---- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

/* ---- Activate：清理旧缓存 ---- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );self.clients.claim();
});

/* ---- Fetch：Cache First（静态），Network Only（API） ---- */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  /* API请求不缓存 */
  if (url.pathname.includes('/v1/') || url.hostname !== location.hostname) {
    event.respondWith(fetch(event.request));
    return;
  }

  /* 静态资源 Cache First */
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
