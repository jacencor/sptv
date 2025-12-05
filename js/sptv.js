/*
* Simple TV
*/
let tv = [];
let m3u = null;
let currentChannel = 0;
let player = null;
let videoElement = null;
let playerUI = null;

// Inicializar aplicación
async function initApp() {
    console.log("Inicializando aplicación...");

    // Cargar elementos DOM una vez
    videoElement = document.getElementById("video");

    await cargarM3u();
    parseM3UToJSON();
    makeListTV();

    // Inicializar player solo una vez
    await initPlayer(0);

    console.log("Aplicación lista");
}

//Cargar lista m3u
async function cargarM3u() {
    console.log("Cargando M3U...");
    try {
        const response = await fetch('/data/play.m3u');
        const data = await response.text();
        console.log('Datos m3u:', data);
        m3u = data;
    } catch (error) {
        console.error('Error al cargar el JSON:', error);
    }
}

//Crear lista de canales
function parseM3UToJSON() {
    console.log("Parseando M3U...");
    const result = [];
    const lines = m3u.split('\n');
    let current = null;

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('#EXTINF:')) {
            current = {
                source: '',
                key: null,
                img: '',
                type: 'OPEN',
                name: 'Canal'
            };

            // Extraer nombre del canal
            const nameMatch = trimmed.match(/,(.+)$/);
            if (nameMatch) current.name = nameMatch[1].trim();

            // Extraer logo
            const logoMatch = trimmed.match(/tvg-logo="([^"]+)"/);
            if (logoMatch) current.img = logoMatch[1].replace('https://sptv.netlify.app', '');
        }
        else if (trimmed && !trimmed.startsWith('#') && current) {
            current.source = trimmed;
            result.push(current);
            current = null;
        }
    }

    tv = result;
}

// Generando lista de canales en sidebar
function makeListTV() {
    console.log("Generando lista de canales...");
    console.log("Lista TV: Inicio");
    const listChannel = document.getElementById("channels-group");
    listChannel.innerHTML = "";

    for (const item of tv) {
        console.log("Lista TV: " + item.name);

        const channel = document.createElement("button");
        channel.type = "button";
        channel.innerHTML = item.name;
        channel.id = item.name;
        channel.addEventListener("click", () => cambiarCanal(tv.indexOf(item)));
        listChannel.appendChild(channel);
    }
}

// Inicializar player una sola vez
async function initPlayer(channelIndex = 0) {
    console.log("Inicializando player...");

    // Si ya existe el player, solo cambiar canal
    if (player && playerUI) {
        return await cambiarCanal(channelIndex);
    }

    try {
        // Configurar UI de Shaka
        const config = {
            castReceiverAppId: "8D8C71A7",
            castAndroidReceiverCompatible: true,
            addSeekBar: false,
            controlPanelElements: ["play_pause", "volume", "fullscreen", "overflow_menu"],
            overflowMenuButtons: ["cast", "airplay", "quality", "language"]
        };

        playerUI = videoElement.ui;
        playerUI.configure(config);
        playerUI.getControls().getLocalization().changeLocale(["es"]);

        // Obtener player
        player = playerUI.getControls().getPlayer();

        // Configurar player
        player.configure({
            streaming: {
                rebufferingGoal: 2,
                bufferingGoal: 5,
                lowLatencyMode: true,
                bufferBehind: 10,
                ignoreTextStreamFailures: true
            },
            abr: {
                enabled: true,
                defaultBandwidthEstimate: 1000000,
                bandwidthUpgradeTarget: 0.95,
                bandwidthDowngradeTarget: 0.9
            },
            manifest: {
                retryParameters: {
                    maxAttempts: 3,
                    baseDelay: 1000,
                    backoffFactor: 2
                }
            },
            preferredAudioLanguage: "es",
        });

        // Event listeners
        player.addEventListener('error', handlePlayerError);
        player.addEventListener('buffering', handleBuffering);
        player.addEventListener('loaded', handleLoaded);

        // Reproducir primer canal
        await cambiarCanal(channelIndex);

        console.log("Player inicializado");
    } catch (error) {
        console.error("Error inicializando player:", error);
        handlePlayerError(error);
    }
}

// Cambiar canal
async function cambiarCanal(channelIndex) {
    console.log('Cambiando al canal...');
    notificarServiceWorker(tv[channelIndex]);

    if (!tv[channelIndex]) {
        console.error('Índice de canal inválido');
        return;
    }

    if (!player) {
        console.error("Player no inicializado");
        await initPlayer();
        return;
    }

    try {
        currentChannel = channelIndex;
        const channel = tv[channelIndex];
        videoElement.poster = channel.img;

        if (player && player.isInProgress()) {
            player.unload();
        }

        await player.load(channel.source);

        try {
            await video.play();
            console.log("Reproduciendo...");
        } catch (playError) {
            console.warn("No se pudo reproducir automáticamente:", playError);
        }



        closeNav();
    } catch (error) {
        console.error('Error cambiando al canal...', error);
        const nextChannel = (channelIndex + 1) % tv.length;

        if (nextChannel !== channelIndex) {
            console.log('Intentando con siguiente canal...');
            await cambiarCanal(nextChannel);
        } else {
            handlePlayerError(error);
        }
    }
}

// Notificar Service Worker
function notificarServiceWorker(channel) {
    if (!navigator.serviceWorker) return;

    try {
        const urlParts = channel.source.split('/');
        const baseUrl = urlParts.slice(0, -1).join('/') + '/';
        let cors = false;

        if (channel.name == "4 RTS") cors = true;

        const message = {
            type: 'ITEM',
            data: { url: baseUrl, cors: cors }
        };

        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage(message);
        } else {
            navigator.serviceWorker.ready.then(registration => {
                registration.active?.postMessage(message);
            });
        }
    } catch (error) {
        console.warn("Error notificando Service Worker:", error);
    }
}

// Manejo de errores
function handlePlayerError(error) {
    console.error("Error del player:", error);

    if (error.code === shaka.util.Error.Code.LOAD_INTERRUPTED) {
        return;
    }

    const video = document.getElementById("video");
    video.poster = "img/app/error.png";

    // Reintentar después de 3 segundos
    setTimeout(() => {
        if (player && tv[currentChannel]) {
            cambiarCanal(currentChannel).catch(() => {
                const nextChannel = (currentChannel + 1) % tv.length;
                cambiarCanal(nextChannel);
            });
        }
    }, 3000);
}

// Handlers para eventos del player
function handleBuffering(event) {
    if (event.buffering) {
        console.log("Buffering...");
    } else {
        console.log("Buffering completado...");
    }
}

// Handler de cargado
function handleLoaded() {
    console.log("Contenido cargado completamente...");
}

// Abrir sidebar
function openNav() {
    document.getElementById("mySidebar").style.width = "250px";
    document.getElementById("openSidebar").style.display = "none";
}

// Cerra sidebar
function closeNav() {
    document.getElementById("mySidebar").style.width = "0";
    document.getElementById("openSidebar").style.display = "block";
}

// CAST evento
function onCastStatusChanged(event) {
    const newCastStatus = event['newStatus'];
    console.log("CAST: " + newCastStatus);
}

// Manejo de horrores
const handleError = (error) => {
    if (error instanceof Error) {
        const video = document.getElementById("video");
        video.poster = "img/app/error.png";
    }
    if (error.severity === shaka.util.Error.Severity.CRITICAL) {
        const video = document.getElementById("video");
        video.poster = "img/app/error.png";
    } else {
        console.error("ERROR: ", error);
    }
};
/*
 * PWA: CACHE > INTERNET
 */
// Inicializar PWA
if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
        console.log("[INI-SW Iniciando registro forzado...");

        try {
            // 1. REGISTRAR 
            const registration = await navigator.serviceWorker.register("/serviceWorker.js");

            console.log("[INI-SW Registrado, versión:", registration.active?.scriptURL);

            // 2. FORZAR CHECK DE UPDATE INMEDIATAMENTE
            console.log("[INI-SW Forzando check de updates...");
            await registration.update(); // ← Esto fuerza verificar si hay nueva versión

            // 3. ESCUCHAR NUEVAS VERSIONES Y FORZAR ACTIVACIÓN
            registration.addEventListener("updatefound", () => {
                console.log("[INI-SW ¡Nueva versión encontrada!");
                const newWorker = registration.installing;

                newWorker.addEventListener("statechange", () => {
                    console.log(`[INI-SW Estado nuevo: ${newWorker.state}`);

                    // Cuando se instala, forzar activación inmediata
                    if (newWorker.state === "installed") {
                        console.log("[INI-SW Forzando activación de nueva versión...");
                        newWorker.postMessage({ type: 'SKIP_WAITING' });

                        // Recargar automáticamente para usar nueva versión
                        /*setTimeout(() => {
                            console.log("[INI-SW Recargando para nueva versión...");
                            window.location.reload();
                        }, 300);*/
                    } else if (newWorker.state === "activated") {
                        console.log("[Service Worker] Activado y listo");
                        console.log("[INI-SW estado activado");
                        if (navigator.serviceWorker.controller) {
                            navigator.serviceWorker.controller.postMessage({
                                type: 'SW_ACTIVATED'
                            });
                        }
                    }
                });
            });

            // 4. SI YA HABÍA UNA VERSIÓN ESPERANDO, ACTIVARLA
            if (registration.waiting) {
                console.log("[INI-SW Hay versión esperando, activando...");
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                //setTimeout(() => window.location.reload(), 300);
            }

            // 6. FORZAR QUE EL SW TOME CONTROL INMEDIATO
            await navigator.serviceWorker.ready;
            console.log("[INI-SW Listo y tomando control");

            // 7. INICIAR APLICACIÓN
            await initApp();

        } catch (error) {
            console.error("[INI-SW Error crítico:", error);
            await initApp();
        }
    });
} else {
    window.addEventListener("load", initApp);
}