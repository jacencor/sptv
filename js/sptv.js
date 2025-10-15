/*
*
*/
let tv = null;
cargarJSON();

function openNav() {
    document.getElementById("mySidebar").style.width = "250px";
}

function closeNav() {
    document.getElementById("mySidebar").style.width = "0";
}

function makeListTV() {
    console.log("Lista TV: Inicio");
    const listChannel = document.getElementById("channels-group");
    listChannel.innerHTML = "";

    for (const item of tv) {
        console.log("Lista TV: " + item.name);

        const channel = document.createElement("button");
        channel.type = "button";

        const isLink = item.tipo === "LINK";
        if (isLink) {
            const link = document.createElement("a");
            link.innerHTML = item.name + " &#x1f517;";
            link.href = item.source;
            link.rel = "noreferrer";
            link.target = "_top";
            listChannel.appendChild(link);
        } else {
            channel.innerHTML = item.name;
            channel.id = item.name;
            channel.addEventListener("click", () => playIframe(tv.indexOf(item)));
            listChannel.appendChild(channel);
        }
    }
    playIframe(0);
}

// Play recurso
function playIframe(play) {
    console.log("Play iframe: Inicio");
    channel = play;
    const main = document.getElementById("mainStream");
    const iframe = document.createElement("iframe");
    const item = tv[play];

    iframe.id = "iPlayer";
    iframe.title = "Video Player";
    iframe.sandbox = "allow-same-origin allow-scripts allow-presentation";
    iframe.allow = "encrypted-media; autoplay; fullscreen; accelerometer 'none'; gyroscope 'none'; clipboard-write 'none'; camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'";
    iframe.allowFullscreen = "true";
    iframe.allowtransparency = "false";
    iframe.fetchpriority = "low";
    iframe.loading = "lazy";

    iframe.referrerPolicy = "no-referrer";

    main.innerHTML = "";
    main.appendChild(iframe);

    console.log("Play iframe: " + item.tipo);
    if (item.tipo == "IFRAME") {
        iframe.sandbox = "allow-same-origin allow-scripts allow-presentation";
        iframe.contentWindow.console.console.log = function () { };
        iframe.src = item.source;
    } else {
        let src = "shaka.html"
        src += "?tipo=" + item.type;
        src += "&img=" + item.img;
        src += "&url=" + item.source;
        if (item.tipo === "OPEN-DRM") {
            src += "&k1=" + item.key.replace(":", "&k2=");
        }
        iframe.src = src;
    }


    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        let source = item.source.split('/');
        let url = source.slice(0, -1).join('/');
        navigator.serviceWorker.controller.postMessage({
            type: 'ITEM',
            datos: {
                url: url+'/',
            }
        });
    }

    closeNav();
}

async function cargarJSON() {
    try {
        const response = await fetch('data/channels.json');
        const data = await response.json();
        console.log('Datos cargados:', data);
        tv = data;
    } catch (error) {
        console.error('Error al cargar el JSON:', error);
    }
}

/*
 * ORDEN: CACHE > INTERNET
 */
if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
        console.log("[Service Worker] Carga");
        const registration = await navigator.serviceWorker
            .register("/serviceWorker.js")
            .then((res) => {
                console.log("[Service Worker] Registrado :P");
                return res;
            })
            .catch(err => () => {
                console.log("[Service Worker] No Registrado: F");
                console.log(err);
            });
        // por si acaso se perdio la deteccion del update... reenviar el SkIP
        if (registration.waiting) {
            console.log("[Service Worker] Saltar espera");
            registration.waiting.postMessage("SKIP_WAITING");
        }
        // Detectar el update y esprar instalar
        registration.addEventListener("updatefound", () => {
            console.log("[Service Worker] Actualización");
            if (registration.installing) {
                //esperar a que el nuevo serviceworker.js entre a camellar
                registration.installing.addEventListener("statechange", () => {
                    if (registration.waiting) {
                        if (navigator.serviceWorker.controller) {
                            console.log("[Service Worker] Saltar espera");
                            registration.waiting.postMessage("SKIP_WAITING");
                        } else {
                            // primera instalaciín siga
                            console.log("[Service Worker] Registrado por primera vez :P")
                        }
                    }
                });
            }
        });

        console.log(tv);
        makeListTV();
    });
}