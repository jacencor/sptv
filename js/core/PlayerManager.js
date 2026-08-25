export class PlayerManager {
    constructor(videoElement, networkMonitor, notifications) {
        this.video = videoElement;
        this.networkMonitor = networkMonitor;
        this.notifications = notifications;
        this.hls = null;
        this.currentChannel = null;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.loadPromiseResolve = null;
        this.isCasting = false;
        
        // Elementos UI para Cast
        this.castOverlay = document.getElementById('castOverlay');
        this.castChannelName = document.getElementById('castChannelName');
    }

    async loadChannel(channel) {
        if (!channel || !channel.source) {
            console.error('[SPTV]', 'Intento de carga de canal inválido');
            return false;
        }

        this.currentChannel = channel;
        this.video.poster = channel.img || 'img/app/error.png';
        this.stopCurrentPlayback(); // Limpieza suave del buffer anterior

        return new Promise((resolve) => {
            if (this.loadPromiseResolve) {
                this.loadPromiseResolve(false); // Cancela la carga anterior limpiamente
            }
            this.loadPromiseResolve = resolve;

            if (this.video.canPlayType('application/vnd.apple.mpegurl')) {

                console.log('[SPTV]', 'Usando reproductor HLS nativo');

                // Limpieza previa: Abortamos eventos de canales anteriores
                if (this.nativeAbortController) {
                    this.nativeAbortController.abort();
                }
                // Creamos un nuevo controlador para este canal específico
                this.nativeAbortController = new AbortController();
                const { signal } = this.nativeAbortController;

                this.video.src = channel.source;

                // Timeout manual de 10 segundos (Evita el "Cuelgue Infinito" de Safari)
                const nativeTimeout = setTimeout(() => {
                    console.warn('[SPTV]', 'Timeout nativo: Safari no pudo cargar el stream a tiempo.');
                    this.nativeAbortController.abort(); // Matamos todos los listeners
                    this.#handleNativeError({ code: 0, message: 'Timeout: Servidor no responde' });
                    this.destroyAndResolve(false);
                }, 10000);

                // Evento de Éxito
                this.video.addEventListener('loadedmetadata', () => {
                    clearTimeout(nativeTimeout); // Cancelamos la guillotina del timeout

                    this.video.play().catch(e => {
                        console.warn('[SPTV]', 'Autoplay nativo bloqueado. Requiere interacción:', e);
                    });
                    resolve(true);
                }, { signal });

                this.video.addEventListener('error', () => {
                    clearTimeout(nativeTimeout);
                    const err = this.video.error;
                    this.#handleNativeError(err);
                    this.destroyAndResolve(false);
                }, { signal });

                this.video.addEventListener('waiting', () => {
                    console.warn('[SPTV]', 'Conexión lenta, almacenando buffer...');
                }, { signal });

                this.video.addEventListener('stalled', () => {
                    console.warn('[SPTV]', 'El stream nativo se ha estancado (stalled).');
                }, { signal });

            } else if (window.Hls && window.Hls.isSupported()) {
                console.log('[SPTV]', 'Usando hls.js');
                this.#initHlsJs(channel.source);
            }
        });
    }

    #initHlsJs(source) {
        if (!this.hls) {
            const bufferConfig = this.networkMonitor ? this.networkMonitor.getBufferConfig() : { maxBuffer: 20, startLevel: -1 };

            this.hls = new window.Hls({
                enableWorker: true,
                maxBufferLength: bufferConfig.maxBuffer,
                startLevel: bufferConfig.startLevel, // ABR automático activado
                capLevelToPlayerSize: true, // Optimización de ancho de banda basado en viewport
                abrEwmaDefaultEstimate: 5e5,
                liveSyncDurationCount: 5, // Mantener solo 2 fragmentos de sincronización
                liveMaxLatencyDurationCount: 10, // Si se retrasa mucho, salta al vivo de nuevo
                maxMaxBufferLength: 30,
                backBufferLength: 10, // Libera memoria de segmentos viejos
                // Topes de reintentos para manifiestos (m3u8) y fragmentos (.ts)
                manifestLoadingMaxRetry: 3,
                manifestLoadingRetryDelay: 1000,
                levelLoadingMaxRetry: 3,
                fragLoadingMaxRetry: 3,
                fragLoadingRetryDelay: 1000,
                // Tiempos máximos de espera (Timeout). Si un servidor no responde en 10s, abortar.
                manifestLoadingTimeOut: 10000,
                fragLoadingTimeOut: 10000,
                // Evita que el reproductor intente buscar infinitamente un fragmento perdido
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

            this.hls.on(window.Hls.Events.ERROR, (event, data) => this.#handleHlsError(data, this.currentChannel?.source));
        } else {
            this.hls.stopLoad(); // Frenar descargas del canal viejo si se reutiliza
        }

        this.hls.loadSource(source);
    }

    #handleHlsError(data, source) {
        if (data.fatal) {
            console.error('[SPTV]', `Error fatal HLS: ${data.type} - ${data.details}`);
            this.retryCount++;

            if (this.retryCount > this.maxRetries) {
                console.error('[SPTV]', `Límite de errores fatales (${this.maxRetries}) superado. Canal muerto.`);
                this.notifications?.showError('Fallo definitivo: Imposible conectar con la señal de origen.');
                this.destroyAndResolve(false);
                return;
            }

            switch (data.type) {
                case window.Hls.ErrorTypes.NETWORK_ERROR:
                    this.notifications?.showWarning(`Red inestable (Intento ${this.retryCount}/${this.maxRetries}). Reconectando...`);
                    setTimeout(() => {
                        if (this.hls) { this.hls.loadSource(source); this.hls.startLoad(); }
                    }, 2000);
                    break;
                case window.Hls.ErrorTypes.MEDIA_ERROR:
                    this.notifications?.showWarning(`Fallo de video (Intento ${this.retryCount}/${this.maxRetries}). Limpiando buffer...`);
                    this.hls.recoverMediaError();
                    break;
                default:
                    this.notifications?.showError('Error crítico reproduciendo el canal.');
                    this.destroyAndResolve(false);
                    break;
            }
        } else {
            console.warn('[SPTV]', `Error no fatal HLS: ${data.type} - ${data.details}`);
            // Si entra un aviso no fatal (y no son timeouts), asumimos que el stream se estabilizó
            if (data.details !== 'fragLoadTimeOut' && data.details !== 'levelLoadTimeOut') {
                this.retryCount = 0;
            }

            // Lógica de "Nudge" para desatascar streams lentos
            if (data.details === 'fragLoadTimeOut' || data.details === 'levelLoadTimeOut') {
                this.retryCount++;
                if (this.retryCount >= this.maxRetries) {
                    this.hls.stopLoad();
                    setTimeout(() => {
                        this.hls.startLoad();
                        if (this.video && (this.video.paused || this.video.readyState < 3)) {
                            this.video.currentTime += 0.1; // Nudge
                        }
                    }, 500);
                    this.retryCount = 0;
                }
            }
        }
    }

    #handleNativeError(error) {
        let errorMessage = 'Error crítico al reproducir la señal.';

        if (error) {
            if (error.code === 0 && error.message) {
                errorMessage = error.message;
            }
            // Manejo de códigos nativos HTMLMediaError (Safari/iOS)
            else {
                switch (error.code) {
                    case 1: // MEDIA_ERR_ABORTED
                        errorMessage = 'La carga del canal fue cancelada.';
                        break;
                    case 2: // MEDIA_ERR_NETWORK
                        errorMessage = 'Se perdió la conexión con el servidor de origen.';
                        break;
                    case 3: // MEDIA_ERR_DECODE
                        errorMessage = 'El stream está corrupto o desincronizado.';
                        break;
                    case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
                        errorMessage = 'El formato del canal no es compatible.';
                        break;
                }
            }
        }

        console.error('[SPTV]', `[Nativo] ${errorMessage}`);
        this.notifications?.showError(`Señal perdida: ${errorMessage}`);
    }

    setCastMode(isCasting, channelName = '') {
        this.isCasting = isCasting;
        
        if (isCasting) {
            // Pausar video local
            this.stopCurrentPlayback();
            if (this.video) this.video.pause();
            
            // Mostrar Overlay
            if (this.castOverlay) {
                this.castOverlay.classList.remove('d-none');
                if (this.castChannelName) {
                    this.castChannelName.textContent = channelName;
                }
            }
        } else {
            // Ocultar Overlay
            if (this.castOverlay) {
                this.castOverlay.classList.add('d-none');
            }
            
            // Si el usuario desconecta, recargamos el canal localmente
            if (this.currentChannel) {
                this.loadChannel(this.currentChannel);
            }
        }
    }

    stopCurrentPlayback() {
        if (this.hls) {
            this.hls.stopLoad();
            // No destruimos HLS ni removemos el src del video para evitar flasheos negros
        }
        // Para nativo (Safari), no quitamos el src explícitamente al hacer zapping 
        // para que la transición sea más suave.
    }

    destroyAndResolve(success) {
        this.stopCurrentPlayback();
        if (this.loadPromiseResolve) {
            this.loadPromiseResolve(success);
            this.loadPromiseResolve = null;
        }
    }

    destroy() {
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }
        if (this.video) {
            this.video.removeAttribute('src');
            this.video.load();
        }
    }
}