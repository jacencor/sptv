const CACHE_NAME = 'sptv-v1.17';
const STATIC_ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './manifest.json',
    './js/main.js',
    './js/core/PlayerManager.js',
    './js/core/ChannelManager.js',
    './js/core/CastManager.js',
    './js/ui/SidebarUI.js',
    './js/ui/NotificationManager.js'
];

self.addEventListener('message', /** @param {ExtendableMessageEvent} event */ (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener("activate", /** @param {ExtendableEvent} activateEvent */ async (activateEvent) => {
    activateEvent.waitUntil(
        caches.keys()
            .then(function (cacheNames) {
                return Promise.all(
                    cacheNames.map(function (cache) {
                        if (cache !== CACHE_NAME) {
                            return caches.delete(cache);
                        }
                    })
                );
            })
            .then(() => {
                return self.clients.claim();
            })
    );
});

self.addEventListener('install', /** @param {ExtendableEvent} event */ event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
    // Para actualizaciones manuales, no llamamos a self.skipWaiting() aquí
});

self.addEventListener('fetch', /** @param {FetchEvent} event */ event => {
    const url = new URL(event.request.url);

    const isMediaExt = /\.(m3u8|ts|aac|mp4|mkv|avi|mov|webm|mp3|m4a|m4v|vtt|key)$/i.test(url.pathname);
    if (isMediaExt || event.request.destination === 'video' || event.request.destination === 'audio') {
        event.respondWith(fetch(event.request, { cache: 'no-store' }));
        return;
    }

    // Bypass: ChannelManager maneja su propio caché Stale-While-Revalidate para listas M3U
    if (url.pathname.includes('.m3u')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Stale-While-Revalidate
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                // 'opaque' soporta logos cross-origin sin CORS
                if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache)).catch(() => { });
                }
                return networkResponse;
            });

            return cachedResponse || fetchPromise.catch(() => {
                if (event.request.mode === 'navigate') return caches.match('./index.html');
                return Response.error();
            });
        })
    );
});