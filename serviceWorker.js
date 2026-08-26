const CACHE_NAME = 'sptv-v1.15';
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

self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener("activate", async (activateEvent) => {
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

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
    // Para actualizaciones manuales, no llamamos a self.skipWaiting() aquí
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    const isMediaExt = /\.(m3u8|ts|aac|mp4|mkv|avi|mov|webm|mp3|m4a|m4v|vtt|key)$/i.test(url.pathname);
    if (isMediaExt || event.request.destination === 'video' || event.request.destination === 'audio') {
        event.respondWith(fetch(event.request, { cache: 'no-store' }));
        return;
    }

    // Network-first
    if (url.pathname.includes('play.m3u')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clonedResponse = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clonedResponse));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
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