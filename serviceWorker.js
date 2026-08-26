const CACHE_NAME = 'sptv-v1.6';
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
    // Para actualizaciones manuales, no llamamos a self.skipWaiting() aquí
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // No cachear streams HLS
    if (url.pathname.endsWith('.m3u8') || url.pathname.includes('.ts')) {
        event.respondWith(fetch(event.request, { cache: 'no-store' }));
        return;
    }

    // Network-first para el playlist M3U
    if (url.pathname.includes('play.m3u')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Actualiza el cache si la red funciona
                    const clonedResponse = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clonedResponse));
                    return response;
                })
                .catch(() => {
                    // Si falla la red, intenta usar el cache
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Estrategia Stale-While-Revalidate para el resto (estáticos, JS, CSS, CDNs)
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                // Si la respuesta es válida, actualizamos el cache
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
                }
                return networkResponse;
            }).catch(() => {
                // Error de red, no hacemos nada extra aquí porque ya retornamos el cache si existe
            });

            // Retornamos el cache rápido, o si no hay, esperamos la red
            return cachedResponse || fetchPromise.then(response => {
                if (!response && event.request.mode === 'navigate') {
                    // Si es una navegación (HTML) y falla, retornamos el index cached
                    return caches.match('/index.html');
                }
                return response;
            });
        })
    );
});