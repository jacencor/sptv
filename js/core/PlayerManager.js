// Mapa de errores nativos HTMLMediaError (Safari/iOS)
const NATIVE_ERRORS = {
    1: 'La carga del canal fue cancelada.',
    2: 'Se perdió la conexión con el servidor de origen.',
    3: 'El stream está corrupto o desincronizado.',
    4: 'El formato del canal no es compatible.'
};

export class PlayerManager {
    constructor(videoElement, notifications) {
        this.video = videoElement;
        this.notifications = notifications;
        this.hls = null;
        this.currentChannel = null;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.loadPromiseResolve = null;
        this.isCasting = false;
        this.nativeTimeout = null;       // timeout de carga nativa (Safari)
        this.nativeAbortController = null; // AbortController de listeners nativos

        this.castOverlay = document.getElementById('castOverlay');
        this.castChannelName = document.getElementById('castChannelName');
    }

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
                    this.nativeTimeout = null;

                    this.video.play().catch(e => {
                        console.warn('[SPTV]', 'Autoplay nativo bloqueado. Requiere interacción:', e);
                    });
                    resolve(true);
                }, { signal });

                this.video.addEventListener('error', () => {
                    clearTimeout(this.nativeTimeout);
                    this.nativeTimeout = null;
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

    _initHlsJs(source) {
        if (!this.hls) {
            this.hls = new window.Hls({
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

            this.hls.on(window.Hls.Events.MEDIA_ATTACHED, () => {
                console.log('[SPTV]', 'HLS Media attached');
            });

            this.hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                this.video.play().catch(e => {
                    console.warn('[SPTV]', 'Auto-play bloqueado por el navegador. Requiere interacción.');
                });
                if (this.loadPromiseResolve) {
                    this.loadPromiseResolve(true);
                    this.loadPromiseResolve = null;
                }
            });

            this.hls.on(window.Hls.Events.ERROR, (event, data) => this._handleHlsError(data, this.currentChannel ? this.currentChannel.source : null));
        } else {
            this.hls.stopLoad();
        }

        this.hls.loadSource(source);
    }

    _handleHlsError(data, source) {
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
                case window.Hls.ErrorTypes.NETWORK_ERROR:
                    if (this.notifications) this.notifications.showWarning(`Red inestable (Intento ${this.retryCount}/${this.maxRetries}). Reconectando...`);
                    this.retryTimeout = setTimeout(() => {
                        if (this.hls) { this.hls.loadSource(source); this.hls.startLoad(); }
                    }, 2000);
                    break;
                case window.Hls.ErrorTypes.MEDIA_ERROR:
                    if (this.notifications) this.notifications.showWarning(`Fallo de video (Intento ${this.retryCount}/${this.maxRetries}). Limpiando buffer...`);
                    this.hls.recoverMediaError();
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
                if (this.retryCount >= this.maxRetries) {
                    this.hls.stopLoad();
                    this.retryTimeout = setTimeout(() => {
                        this.hls.startLoad();
                        if (this.video && (this.video.paused || this.video.readyState < 3)) {
                            this.video.currentTime += 0.1;
                        }
                    }, 500);
                    this.retryCount = 0;
                }
            }
        }
    }

    _handleNativeError(error) {
        var code = error ? error.code : null;
        var msg = (code === 0 && error.message)
            ? error.message
            : NATIVE_ERRORS[code] || 'Error crítico al reproducir la señal.';
        console.error('[SPTV]', `[Nativo] ${msg}`);
        if (this.notifications) this.notifications.showError(`Señal perdida: ${msg}`);
    }

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

    stopCurrentPlayback() {
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }

        // Limpiar timeout y listeners nativos (Safari/iOS)
        if (this.nativeTimeout) {
            clearTimeout(this.nativeTimeout);
            this.nativeTimeout = null;
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