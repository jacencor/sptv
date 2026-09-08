// @ts-check

/** @import { Channel } from './ChannelManager.js' */
/** @import { INotifications } from '../ui/NotificationManager.js' */

/**
 * @typedef {Object} NativeError
 * @property {number} code
 * @property {string} [message]
 */

/** @type {Record<number, string>} Mapa de errores nativos HTMLMediaError (Safari/iOS) */
const NATIVE_ERRORS = {
    1: 'La carga del canal fue cancelada.',
    2: 'Se perdió la conexión con el servidor de origen.',
    3: 'El stream está corrupto o desincronizado.',
    4: 'El formato del canal no es compatible.'
};

export class PlayerManager {
    /**
     * @param {HTMLVideoElement} videoElement
     * @param {INotifications | null} notifications
     */
    constructor(videoElement, notifications) {
        /** @type {HTMLVideoElement} */
        this.video = videoElement;
        this.notifications = notifications;

        /** @type {HlsInstance | null} */
        this.hls = null;

        /** @type {Channel | null} */
        this.currentChannel = null;

        /** @type {number} */
        this.retryCount = 0;

        /** @type {number} */
        this.maxRetries = 3;

        /** @type {((value: boolean | 'aborted') => void) | null} */
        this.loadPromiseResolve = null;

        /** @type {boolean} */
        this.isCasting = false;

        /** @type {ReturnType<typeof setTimeout> | undefined} timeout de carga nativa (Safari) */
        this.nativeTimeout = undefined;

        /** @type {AbortController | null} AbortController de listeners nativos */
        this.nativeAbortController = null;

        /** @type {ReturnType<typeof setTimeout> | undefined} */
        this.retryTimeout = undefined;

        this.castOverlay = document.getElementById('castOverlay');
        this.castChannelName = document.getElementById('castChannelName');
    }

    /**
     * Carga y reproduce un canal. Devuelve `true` si tuvo éxito, `false` si falló
     * definitivamente, o `'aborted'` si fue interrumpido por una carga posterior.
     * @param {Channel} channel
     * @returns {Promise<boolean | 'aborted'>}
     */
    async loadChannel(channel) {
        if (!channel || !channel.source) {
            console.error('[SPTV]', 'Intento de carga de canal inválido');
            return false;
        }

        this.currentChannel = channel;
        this.retryCount = 0;

        this.video.poster = channel.img || 'img/app/error.png';
        this.stopCurrentPlayback();

        return new Promise((resolve) => {
            if (this.loadPromiseResolve) {
                this.loadPromiseResolve('aborted');
            }
            this.loadPromiseResolve = resolve;

            if (window.Hls && window.Hls.isSupported()) {
                console.log('[SPTV]', 'Usando hls.js');
                this._initHlsJs(channel.source);
            } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {

                console.log('[SPTV]', 'Usando reproductor HLS nativo');

                if (this.nativeAbortController) this.nativeAbortController.abort();

                this.nativeAbortController = new AbortController();
                const { signal } = this.nativeAbortController;

                this.video.src = channel.source;

                // Timeout manual (evita cuelgue infinito en Safari)
                // Se almacena en this para poder limpiarlo desde stopCurrentPlayback
                this.nativeTimeout = setTimeout(() => {
                    console.warn('[SPTV]', 'Timeout nativo: Safari no pudo cargar el stream a tiempo.');
                    this._handleNativeError({ code: 0, message: 'Timeout: Servidor no responde' });
                    this.destroyAndResolve(false);
                }, 10000);

                this.video.addEventListener('loadedmetadata', () => {
                    clearTimeout(this.nativeTimeout);
                    this.nativeTimeout = undefined;

                    this.video.play().catch(/** @param {Error} e */ e => {
                        console.warn('[SPTV]', 'Autoplay nativo bloqueado. Requiere interacción:', e);
                    });
                    resolve(true);
                }, { signal });

                this.video.addEventListener('error', () => {
                    clearTimeout(this.nativeTimeout);
                    this.nativeTimeout = undefined;
                    const err = this.video.error;
                    this._handleNativeError(err);
                    this.destroyAndResolve(false);
                }, { signal });

                this.video.addEventListener('waiting', () => {
                    console.warn('[SPTV]', 'Conexión lenta, almacenando buffer...');
                }, { signal });

                this.video.addEventListener('stalled', () => {
                    console.warn('[SPTV]', 'El stream nativo se ha estancado (stalled).');
                }, { signal });

            }
        });
    }

    /**
     * Inicializa o reutiliza la instancia de hls.js y carga el source indicado.
     * @param {string} source - URL del manifest HLS
     * @returns {void}
     */
    _initHlsJs(source) {
        const Hls = window.Hls;
        if (!Hls) return;

        if (!this.hls) {
            this.hls = new Hls({
                enableWorker: true,
                maxBufferLength: 30,
                startLevel: -1,
                capLevelToPlayerSize: true,
                abrEwmaDefaultEstimate: 5e5,
                abrBandWidthFactor: 0.9,
                abrBandWidthUpFactor: 0.7,
                abrEwmaFastLive: 5.0,
                abrEwmaSlowLive: 9.0,
                liveSyncDurationCount: 5,
                liveMaxLatencyDurationCount: 10,
                maxMaxBufferLength: 60,
                backBufferLength: 10,
                manifestLoadingMaxRetry: 3,
                manifestLoadingRetryDelay: 1000,
                levelLoadingMaxRetry: 3,
                fragLoadingMaxRetry: 3,
                fragLoadingRetryDelay: 1000,
                manifestLoadingTimeOut: 10000,
                fragLoadingTimeOut: 10000,
                maxFragLookUpTolerance: 0.2,
                abrMaxWithRealBitrate: true
            });

            this.hls.attachMedia(this.video);

            this.hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                console.log('[SPTV]', 'HLS Media attached');
            });

            this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this.video.play().catch(/** @param {Error} e */ e => {
                    console.warn('[SPTV]', 'Auto-play bloqueado por el navegador. Requiere interacción.');
                });
                if (this.loadPromiseResolve) {
                    this.loadPromiseResolve(true);
                    this.loadPromiseResolve = null;
                }
            });

            this.hls.on(Hls.Events.ERROR, /** @param {string} event @param {HlsErrorData} data */ (event, data) =>
                this._handleHlsError(data, this.currentChannel ? this.currentChannel.source : null)
            );
        } else {
            this.hls.stopLoad();
        }

        this.hls.loadSource(source);
    }

    /**
     * Maneja errores reportados por hls.js, con reintentos para errores recuperables.
     * @param {HlsErrorData} data
     * @param {string | null} source - URL del stream activo para reconexión
     * @returns {void}
     */
    _handleHlsError(data, source) {
        const Hls = window.Hls;
        if (!Hls) return;

        if (data.fatal) {
            console.error('[SPTV]', `Error fatal HLS: ${data.type} - ${data.details}`);
            this.retryCount++;

            if (this.retryCount > this.maxRetries) {
                console.error('[SPTV]', `Límite de errores fatales (${this.maxRetries}) superado. Canal muerto.`);
                if (this.notifications) this.notifications.showError('Fallo definitivo: Imposible conectar con la señal de origen.');
                this.destroyAndResolve(false);
                return;
            }

            switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                    if (this.notifications) this.notifications.showWarning(`Red inestable (Intento ${this.retryCount}/${this.maxRetries}). Reconectando...`);
                    this.retryTimeout = setTimeout(() => {
                        if (this.hls && source) { this.hls.loadSource(source); this.hls.startLoad(); }
                    }, 2000);
                    break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                    if (this.notifications) this.notifications.showWarning(`Fallo de video (Intento ${this.retryCount}/${this.maxRetries}). Limpiando buffer...`);
                    if (this.hls) this.hls.recoverMediaError();
                    break;
                default:
                    if (this.notifications) this.notifications.showError('Error crítico reproduciendo el canal.');
                    this.destroyAndResolve(false);
                    break;
            }
        } else {
            console.warn('[SPTV]', `Error no fatal HLS: ${data.type} - ${data.details}`);
            if (data.details !== 'fragLoadTimeOut' && data.details !== 'levelLoadTimeOut') {
                this.retryCount = 0;
            }

            if (data.details === 'fragLoadTimeOut' || data.details === 'levelLoadTimeOut') {
                this.retryCount++;
                if (this.retryCount >= this.maxRetries && this.hls) {
                    this.hls.stopLoad();
                    this.retryTimeout = setTimeout(() => {
                        if (this.hls) this.hls.startLoad();
                        if (this.video && (this.video.paused || this.video.readyState < 3)) {
                            this.video.currentTime += 0.1;
                        }
                    }, 500);
                    this.retryCount = 0;
                }
            }
        }
    }

    /**
     * Maneja errores del reproductor nativo del navegador (Safari/iOS).
     * @param {NativeError | MediaError | null} error
     * @returns {void}
     */
    _handleNativeError(error) {
        const code = error ? error.code : null;
        const msg = (code === 0 && error && 'message' in error && error.message)
            ? error.message
            : (code !== null ? NATIVE_ERRORS[code] : null) || 'Error crítico al reproducir la señal.';
        console.error('[SPTV]', `[Nativo] ${msg}`);
        if (this.notifications) this.notifications.showError(`Señal perdida: ${msg}`);
    }

    /**
     * Activa o desactiva el modo Chromecast.
     * Cuando se activa, detiene la reproducción local y muestra el overlay.
     * Cuando se desactiva, reanuda el canal actual en el video local.
     * @param {boolean} isCasting
     * @param {string} [channelName]
     * @returns {void}
     */
    setCastMode(isCasting, channelName = '') {
        this.isCasting = isCasting;

        if (isCasting) {
            this.stopCurrentPlayback();
            if (this.video) this.video.pause();

            if (this.castOverlay) {
                this.castOverlay.classList.remove('d-none');
                if (this.castChannelName) {
                    this.castChannelName.textContent = channelName;
                }
            }
        } else {
            if (this.castOverlay) {
                this.castOverlay.classList.add('d-none');
            }

            if (this.currentChannel) {
                this.loadChannel(this.currentChannel);
            }
        }
    }

    /**
     * Detiene la carga activa (hls.js y nativa) limpiando timers y listeners,
     * sin destruir la instancia HLS para evitar flasheos negros en el zapping.
     * @returns {void}
     */
    stopCurrentPlayback() {
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = undefined;
        }

        // Limpiar timeout y listeners nativos (Safari/iOS)
        if (this.nativeTimeout) {
            clearTimeout(this.nativeTimeout);
            this.nativeTimeout = undefined;
        }
        if (this.nativeAbortController) {
            this.nativeAbortController.abort();
            this.nativeAbortController = null;
        }

        if (this.hls) {
            this.hls.stopLoad();
            // No destruimos HLS al hacer zapping para evitar flasheos negros;
            // la instancia se reutiliza con loadSource().
        }
    }

    /**
     * Destruye completamente la instancia HLS (en fallos fatales) y resuelve
     * la promesa de carga pendiente con el resultado indicado.
     * @param {boolean} success
     * @returns {void}
     */
    destroyAndResolve(success) {
        // En fallos fatales destruimos la instancia HLS por completo para que
        // sus listeners de ERROR no se disparen sobre la siguiente carga.
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }
        this.stopCurrentPlayback();
        if (this.loadPromiseResolve) {
            this.loadPromiseResolve(success);
            this.loadPromiseResolve = null;
        }
    }

}