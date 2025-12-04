/*
 *** PWA 
 */

// Recursos estaticos
const stc = [
    //ico
    "/img/ico/favicon.ico",
    "/img/ico/icon-16x16.png",
    "/img/ico/icon-24x24.png",
    "/img/ico/icon-32x32.png",
    "/img/ico/icon-64x64.png",
    "/img/ico/icon-128x128.png",
    "/img/ico/icon-256x256.png",
    "/img/ico/icon-512x512.png",
    //images
    "/img/app/error.png",
    "/img/ch/americatv.png",
    "/img/ch/axn.png",
    "/img/ch/canal13.png",
    "/img/ch/cinecanal.jpg",
    "/img/ch/cinemax.png",
    "/img/ch/discovery.png",
    "/img/ch/dw.png",
    "/img/ch/ecuadortv.png",
    "/img/ch/ecuavisa.png",
    "/img/ch/fr24.png",
    "/img/ch/fx.jpg",
    "/img/ch/lifetime.jpg",
    "/img/ch/natgeo.png",
    "/img/ch/oroomar.png",
    "/img/ch/rt.png",
    "/img/ch/rts.png",
    "/img/ch/sonynovelas.jpg",
    "/img/ch/studiouniversal.png",
    "/img/ch/teleamazonas.png",
    "/img/ch/tvc.jpg",
];
//Recursos variables
const chg = [
    "/index.html",
    "/js/sptv.js",
    "/css/style.css",
    "/manifest.json",
];
//Recursos externos
const net = [
    //shaka
    "https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.3.16/controls.min.css",
    "https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.3.16/shaka-player.ui.min.js",
    //mux
    "https://cdnjs.cloudflare.com/ajax/libs/mux.js/7.0.3/mux.min.js",
    //cast
    "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1",
    "//www.gstatic.com/eureka/clank/cast_sender.js",
    "//www.gstatic.com/eureka/clank/112/cast_sender.js",
    "//www.gstatic.com/eureka/clank/113/cast_sender.js",
    "http://www.gstatic.com/cast/sdk/libs/sender/1.0/cast_framework.js",
];

//Versiones cache
const version = "v3.1"
const cacheChg = "app-sTV-chg-" + version;
const cacheStc = "app-sTV-stc-" + version;
const cacheNet = "app-sTV-net-" + version;

let source = "";
let cors = false;

// Permitir usar nuevo serviceWorker
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Instalar el Service Worker
self.addEventListener("install", (installEvent) => {
    console.log("[PWA Worker] Install...");
    installEvent.waitUntil((async () => {
        const CHG = await caches.open(cacheChg);
        console.log("[PWA Worker] Caching CHG: lo que cambia");
        await CHG.addAll(chg);
        const STC = await caches.open(cacheStc);
        console.log("[PWA Worker] Caching  STC: lo que no");
        await STC.addAll(stc);
    })());
});

// Activación del Service Worker
self.addEventListener("activate", async (activateEvent) => {
    console.log("[PWA Worker] Activate...");
    activateEvent.waitUntil(
        caches.keys()
            .then(function (cacheNames) {
                return Promise.all(
                    cacheNames.map(function (cache) {
                        if (cache !== cacheChg &&
                            cache !== cacheStc &&
                            cache !== cacheNet) {
                            console.log("[PWA Cache] Eliminando caché antigua");
                            return caches.delete(cache);
                        }
                    })
                );
            })
    );

    //refrescar...
    const tabs = await self.clients.matchAll({
        type: 'window'
    })
    tabs.forEach((tab) => {
        tab.navigate(tab.url)
    })
});

// Recibir datos DE la página principal
self.addEventListener('message', event => {
    if (event.data.type === 'ITEM') {
        console.log('[PWA dataget] ', event.data.data);
        source = event.data.data.url;
        cors = event.data.data.cors;
    }
});

// Fetching del contenido usando el Service Worker
self.addEventListener("fetch", (fetchEvent) => {
    const requestUrl = fetchEvent.request.url;
    const isExternalResource = net.some((host) => requestUrl.startsWith(host));

    fetchEvent.respondWith((async () => {
        const cacheChgOpen = await caches.open(cacheChg);
        const cacheStcOpen = await caches.open(cacheStc);
        const cacheNetOpen = await caches.open(cacheNet);

        const cachedResponseChg = await cacheChgOpen.match(fetchEvent.request);

        if (cachedResponseChg) {
            console.log("[PWA Cache] CHG: " + requestUrl);
            try {
                const networkResponse = await fetch(fetchEvent.request.url, {
                    referrer: "",
                    referrerPolicy: "no-referrer",
                    credentials: "omit",
                    cache: "no-cache",
                });
                const clonedResponse = networkResponse.clone();

                cacheChgOpen.delete(fetchEvent.request);

                // Guardar la respuesta en la caché 
                cacheChgOpen.put(fetchEvent.request, clonedResponse);
                console.log("[PWA Cache] CHG > UPDATED: " + requestUrl);

                return networkResponse;
            } catch (error) {
                console.log("[PWA Fetch] error: " + error);
                // Si hay un error al obtener la respuesta desde el servidor, se devuelve la respuesta en caché.
                return cachedResponseChg;
            }
        }

        const cachedResponseStc = await cacheStcOpen.match(fetchEvent.request);
        if (cachedResponseStc) {
            //Retornar recursos estaticos
            console.log("[PWA Cache] STC: " + fetchEvent.request.url);
            return cachedResponseStc;
        }

        if (isExternalResource) {
            const cachedResponseNet = await cacheNetOpen.match(fetchEvent.request);
            if (cachedResponseNet) {
                // Retornar recursos externos desde la caché
                console.log("[PWA Cache] NET: " + requestUrl);
                return cachedResponseNet;
            }

            // Actualizar recursos externos desde el servidor
            const networkResponse = await fetch(fetchEvent.request.url, {
                referrer: "",
                referrerPolicy: "no-referrer",
                credentials: "omit",
                cache: "no-cache",
            });

            fetchEvent.waitUntil(
                cacheNetOpen.put(fetchEvent.request, networkResponse.clone())
            );

            console.log("[PWA Cache] NET > UPDATE: " + requestUrl);
            return networkResponse;
        }

        let url = fetchEvent.request.url;

        console.log("[PWA requestUrl]: " + url);

        if (cors) {
            if (url.includes('https://sptv.netlify.app')) {
                url = url.replace('https://sptv.netlify.app/', source);
            }
            if (url.includes('https://api.codetabs.com/v1/proxy')) {
                url = url.replace('https://api.codetabs.com/v1/proxy/', source);
            }
            url = "https://api.codetabs.com/v1/proxy?quest=" + url
            console.log("[PWA proxy]: " + url);
        }

        try {
            const response = await fetch(url, {
                referrer: "",
                referrerPolicy: "no-referrer",
                credentials: "omit",
                cache: "no-cache",
            });

            return response;
        } catch (error) {
            const response = await fetch('https://api.codetabs.com/v1/proxy?quest=' + url, {
                referrer: "",
                referrerPolicy: "no-referrer",
                credentials: "omit",
                cache: "no-cache",
            });

            return response;
        }
    })());
});