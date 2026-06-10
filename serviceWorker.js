const CACHE_NAME = 'sptv-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/manifest.json'
];

// Permitir usar nuevo serviceWorker
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Activación del Service Worker
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
    self.skipWaiting();
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // No cachear streams HLS
    if (url.pathname.endsWith('.m3u8') || url.pathname.includes('.ts')) {
        event.respondWith(fetch(event.request, { cache: 'no-store' }));
        return;
    }

    // No cachear el M3U
    if (url.pathname.includes('play.m3u')) {
        event.respondWith(fetch(event.request, { cache: 'no-cache' }));
        return;
    }

    // Cachear assets estáticos
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});