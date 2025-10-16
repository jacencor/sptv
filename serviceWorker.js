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
    "/img/app/poster.jpg",
];
//Recursos variables
const chg = [
    "/index.html",
    "/shaka.html",
    "/js/sptv.js",
    "/js/play.js",
    "/data/channels.json",
    "/css/style.css",
    "/css/player.css",
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
    //imagenes
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/América_Televisión.svg/471px-América_Televisión.svg.png",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Ecuavisa_Logo_2019.png/640px-Ecuavisa_Logo_2019.png",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Teleamazonas_Logo.png/640px-Teleamazonas_Logo.png",
    "https://upload.wikimedia.org/wikipedia/commons/1/13/Rts_logo.png",
    "https://www.ecured.cu/images/b/b8/TVC_Ecuador.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/2/21/Oromar_logo.png",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/EcuadorTV_logo.png/465px-EcuadorTV_logo.png",
    "https://upload.wikimedia.org/wikipedia/commons/9/94/Gamavisión2018new.png",
    "https://canalrtu.tv/wp-content/uploads/2022/07/rtu.png",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_symbol_2012.svg/640px-Deutsche_Welle_symbol_2012.svg.png",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Telemundo_logo_2012.svg/615px-Telemundo_logo_2012.svg.png",
];

//Versiones cache
const version = "v2.2"
const cacheChg = "app-sTV-chg-" + version;
const cacheStc = "app-sTV-stc-" + version;
const cacheNet = "app-sTV-net-" + version;

let source = "";

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
        console.log('[PWA Source] ', event.data.datos);
        source = event.data.datos.url;
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

        if (!requestUrl.includes(".m3u8") &&
            !requestUrl.includes(".ts") &&
            !requestUrl.includes(".aac") &&
            !requestUrl.includes(".m4a") &&
            !requestUrl.includes(".m4v") &&
            !requestUrl.includes(".mpd") &&
            !requestUrl.includes("/shaka.html?tipo=")) {

            console.log("[PWA requestUrl]: " + requestUrl);

        } else {

            if (requestUrl.includes('https://sptv.netlify.app')) {
                console.log("[PWA requestUrl]: " + requestUrl);
                url = url.replace('https://sptv.netlify.app/', source);
            }
            if (requestUrl.includes('https://api.codetabs.com/v1/proxy')) {
                console.log("[PWA requestUrl]: " + requestUrl);
                url = url.replace('https://api.codetabs.com/v1/proxy/', source);
            }
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