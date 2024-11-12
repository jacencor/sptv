/*
 ***
 *** PLAYER TV 
 *** @jacencor
 ***
 */

// Arranque
document.addEventListener("shaka-ui-loaded", init);

// Registros (log)
const DEBUG = true;

function LOG(log) {
    if (DEBUG) {
        console.log("[SHAKA player] > " + log);
    }
}

// Obtener datos del URL
function getUrlData(name) {
    const queryString = window.location.search;
    const params = new URLSearchParams(queryString);
    const value = params.get(name);
    return value ? decodeURIComponent(value.replace(/\+/g, " ")) : "";
}

/*
 ***
 *** SHAKA player funciones
 ***
 */
// Init del player
async function init() {
    const video = document.getElementById("video");
    const tipo = getUrlData("tipo");
    const ui = video["ui"];
    video.poster = getUrlData("img");

    const config = {
        castReceiverAppId: "8D8C71A7",
        castAndroidReceiverCompatible: true,
        addSeekBar: false,
        controlPanelElements: ["play_pause", "volume", "fullscreen", "overflow_menu"],
        overflowMenuButtons: ["cast", "airplay", "quality", "language", ]
    }

    ui.configure(config);
    ui.getControls().getLocalization().changeLocale(["es"])
    const controls = ui.getControls();
    const player = controls.getPlayer();

    try {
        let url = getUrlData("url");
        if (url.startsWith("//")) {
            url = "https:" + url;
        }

        LOG("URL: " + url);

        player.configure({
            streaming: {
                rebufferingGoal: 2,
                bufferingGoal: 5,
                lowLatencyMode: true
            },
            abr: {
                enabled: true,
                defaultBandwidthEstimate: 500000
            },
            preferredAudioLanguage: "es",
        });

        if (tipo === "OPEN-DRM") {
            const k1 = atob(getUrlData("k1"));
            const k2 = atob(getUrlData("k2"));
            LOG("DRM: " + k1);
            LOG("DRM: " + k2);
            player.configure({
                drm: {
                    clearKeys: {
                        [k1]: k2,
                    },
                },
            });
        }

        controls.addEventListener('caststatuschanged', onCastStatusChanged);
        player.addEventListener('error', handleError);
        await player.load(url).then(() => {
            player.play();
        });

        LOG("Cargado");
    } catch (error) {
        console.error("ERROR: ", error);
        handleError(error);
    }
}

// CAST evento
function onCastStatusChanged(event) {
    const newCastStatus = event['newStatus'];
    LOG("CAST: " + newCastStatus);
}

// Manejo de horrores
const handleError = (error) => {
    // native error
    if (error instanceof Error) {
        const video = document.getElementById("video");
        video.poster = "img/app/error.png";
    }
    if (error.severity === shaka.util.Error.Severity.CRITICAL) {
        // fatal error
        const video = document.getElementById("video");
        video.poster = "img/app/error.png";
    } else {
        // no fatal error
        console.error("ERROR: ", error);
    }
};