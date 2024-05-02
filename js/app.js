/*
 ***
 *** Funciones principales
 *** @jacencor
 ***
 */

// Tabindex 
const tInit = 2;
// Canal valor por defecto
let channel = 0;
// Registros (log)
const DEBUG = true;

function LOG(log) {
    if (DEBUG) {
        console.log("[SPTV] > " + log);
    }
}

/*  
 *** Mostrar la lista de canales de TV
 */
function makeListTV() {
    LOG("Lista TV: Inicio");
    //Limpiar los contenidos
    const mainStreamElement = document.getElementById("mainStream");
    const streamHeaderElement = document.getElementById("streamHeader");
    const listElement = document.getElementById("list");
    mainStreamElement.innerHTML = "";
    streamHeaderElement.innerHTML = "";
    listElement.innerHTML = "";

    let doc = document.getElementById("list");
    // listar canales 
    for (const channel of tv) {
        LOG("Lista TV: " + channel.name);
        const liElement = document.createElement("li");
        const buttonElement = document.createElement("button");

        //Enlaces externos
        const isLink = channel.tipo === "LINK";
        //const isIOS = navigator.userAgent.match(/iPad|iPhone|iPod/i);
        //const isAndroidChrome = !!window.chrome && navigator.userAgent.match(/Android/i);
        buttonElement.type = "button";

        if (isLink) {
            const aElement = document.createElement("a");
            aElement.innerHTML = channel.name + " &#x1f517;";
            aElement.href = channel.source;
            aElement.rel = "noreferrer";
            aElement.target = "_top";
            buttonElement.appendChild(aElement);
        } else {
            buttonElement.innerHTML = channel.name;
            buttonElement.id = channel.name;
            buttonElement.addEventListener("click", () => playIframe(tv.indexOf(channel)));
            buttonElement.tabIndex = tv.indexOf(channel) + tInit;
        }

        liElement.appendChild(buttonElement);
        listElement.appendChild(liElement);
    }
    document.getElementById("focusEnd").tabIndex = tv.length + tInit + 1;
    playIframe(channel);
}

// Play recurso
function playIframe(play) {
    LOG("Play iframe: Inicio");
    channel = play;
    const mainStreamElement = document.getElementById("mainStream");
    const iFrameElement = document.createElement("iframe");
    const currentChannel = tv[play];

    iFrameElement.id = "iPlayer";
    iFrameElement.title = "Video Player";
    iFrameElement.loading = "lazy";
    iFrameElement.tabIndex = tv.length + tInit;
    iFrameElement.allow = "encrypted-media; autoplay; fullscreen";
    iFrameElement.allowFullscreen = "true";
    iFrameElement.scrolling = "no";
    iFrameElement.referrerPolicy = "no-referrer";

    mainStreamElement.innerHTML = "";
    mainStreamElement.appendChild(iFrameElement);

    // Iframe externos
    LOG("Play iframe: " + currentChannel.tipo);
    if (currentChannel.tipo == "IFRAME") {
        iFrameElement.sandbox = "allow-same-origin allow-scripts allow-presentation";
        iFrameElement.contentWindow.console.log = function () {};
        iFrameElement.src = currentChannel.source;
    } else {
        let src = "shaka.html"
        src += "?tipo=" + currentChannel.tipo;
        src += "&img=" + currentChannel.poster;
        src += "&url=" + currentChannel.source;
        // Uso de ClearKey
        if (currentChannel.tipo === "OPEN-DRM") {
            src += "&k1=" + currentChannel.key.replace(":", "&k2=");
        }
        iFrameElement.src = src;
    }
}

//Volver al focus principal - OK
function tabLoop() {
    LOG("TAB: LOOP");
    document.getElementById(tv[0].name).focus();
}

//Ciclo canal
function change() {
    LOG("Cambio canal: " + channel);
    if (channel >= tv.length) {
        channel = 0;
    } else if (channel < 0) {
        channel = tv.length - 1;
    }
    playIframe(channel);
}

//Manejo por control/teclado - OK
document.addEventListener("keydown", (event) => {
    LOG("KEYDOWN evento: " + event.code);
    if (event.code == "ArrowUp") { //canal+
        ++channel;
        change();
    } else if (event.code == "ArrowDown") { //canal-
        --channel;
        change()
    }

});

/*
 *** SPTV - OK
 *** Carga
 */
window.addEventListener("load", () => {
    //tvSet();
    for (const [i, val] of tv.entries()) {
        tv[i].source = atob(val.source);
        tv[i].key = val.key ? atob(val.key) : null;
        tv[i].poster = val.poster ? atob(val.poster) : null;
        tv[i].tipo = atob(val.tipo);
        tv[i].name = atob(val.name);
    }
    console.log(tv);
    makeListTV();
    document.getElementById("loader").classList.toggle("none");
    document.getElementById('focusEnd').addEventListener('focus', () => {
        tabLoop();
    });
    document.getElementById('focusStart').addEventListener('focus', () => {
        tabLoop();
    });
    document.getElementById('legal').addEventListener('click', () => {
        const iFrameElement = document.getElementById("iPlayer");
        iFrameElement.src = "DMCA.html";
    });
});

/**
 *  Genrerar lista tv
 */
function tvSet() {
    for (const [i, channel] of tv.entries()) {
        let item = {
            source: null,
            key: null,
            poster: null,
            tipo: null,
            name: null,
        }
        item.source = channel.source != null ? btoa(channel.source) : null;
        item.key = channel.key != null ? btoa(channel.key) : null;
        item.poster = channel.poster != null ? btoa(channel.poster) : null;
        item.tipo = channel.tipo != null ? btoa(channel.tipo) : null;
        item.name = channel.name != null ? btoa(channel.name) : null;
        tv[i] = item;
    }
    console.log(tv);
}
/*
 *** PWA - OK
 *** Ejecución del serviceWorker 
 *** ORDEN: CACHE > INTERNET
 */
if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
        LOG("[Service Worker] Carga");
        const registration = await navigator.serviceWorker
            .register("/serviceWorker.js")
            .then((res) => {
                LOG("[Service Worker] Registrado :P");
                return res;
            })
            .catch(err => () => {
                LOG("[Service Worker] No Registrado: F");
                LOG(err);
            });
        // por si acaso se perdio la deteccion del update... reenviar el SkIP
        if (registration.waiting) {
            LOG("[Service Worker] Saltar espera");
            registration.waiting.postMessage("SKIP_WAITING");
        }
        // Detectar el update y esprar instalar
        registration.addEventListener("updatefound", () => {
            LOG("[Service Worker] Actualización");
            if (registration.installing) {
                //esperar a que el nuevo serviceworker.js entre a camellar
                registration.installing.addEventListener("statechange", () => {
                    if (registration.waiting) {
                        if (navigator.serviceWorker.controller) {
                            LOG("[Service Worker] Saltar espera");
                            registration.waiting.postMessage("SKIP_WAITING");
                        } else {
                            // primera instalaciín siga
                            LOG("[Service Worker] Registrado por primera vez :P")
                        }
                    }
                });
            }
        });

    });
}