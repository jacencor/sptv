import { Logger } from '../utils/Logger.js';

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
    }

    async init() {
        // Verificamos soporte nativo o de librería
        const canPlayNative = this.video.canPlayType('application/vnd.apple.mpegurl');
        const canPlayHlsJs = window.Hls && window.Hls.isSupported();

        if (!canPlayNative && !canPlayHlsJs) {
            Logger.error('HLS no es soportado en este navegador de ninguna forma.');
            return false;
        }
        return true;
    }

    async loadChannel(channel) {
        if (!channel || !channel.source) {
            Logger.error('Intento de carga de canal inválido');
            return false;
        }

        this.currentChannel = channel;
        this.video.poster = channel.img || 'img/app/error.png';
        this.destroy(); // Limpieza del buffer anterior

        return new Promise((resolve) => {
            this.loadPromiseResolve = resolve;

            // soporte HLS nativo (Safari, iOS o Chrome)
            if (this.video.canPlayType('application/vnd.apple.mpegurl')) {

                Logger.log('Usando reproductor HLS nativo');

                // Limpieza previa: Abortamos eventos de canales anteriores
                if (this.nativeAbortController) {
                    this.nativeAbortController.abort();
                }
                // Creamos un nuevo controlador para este canal específico
                this.nativeAbortController = new AbortController();
                const { signal } = this.nativeAbortController;

                // Fundamental para que iOS no mande el video a pantalla completa automáticamente
                this.video.playsInline = true;
                this.video.src = channel.source;

                // Timeout manual de 10 segundos (Evita el "Cuelgue Infinito" de Safari)
                const nativeTimeout = setTimeout(() => {
                    Logger.warn('Timeout nativo: Safari no pudo cargar el stream a tiempo.');
                    this.nativeAbortController.abort(); // Matamos todos los listeners
                    this.#handleNativeError({ code: 0, message: 'Timeout: Servidor no responde' });
                    this.destroyAndResolve(false);
                }, 10000);

                // Evento de Éxito
                this.video.addEventListener('loadedmetadata', () => {
                    clearTimeout(nativeTimeout); // Cancelamos la guillotina del timeout

                    this.video.play().catch(e => {
                        Logger.warn('Autoplay nativo bloqueado. Requiere interacción:', e);
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
                    Logger.warn('Conexión lenta, almacenando buffer...');
                }, { signal });

                this.video.addEventListener('stalled', () => {
                    Logger.warn('El stream nativo se ha estancado (stalled).');
                }, { signal });

            } else if (window.Hls && window.Hls.isSupported()) {
                Logger.log('Usando hls.js');
                this.#initHlsJs(channel.source, resolve);
            }
        });
    }

    #initHlsJs(source, resolve) {
        const bufferConfig = this.networkMonitor ? this.networkMonitor.getBufferConfig() : { maxBuffer: 20, startLevel: -1 };

        this.hls = new window.Hls({
            enableWorker: true,
            maxBufferLength: bufferConfig.maxBuffer,
            startLevel: bufferConfig.startLevel, // ABR automático activado
            capLevelToPlayerSize: true, // Optimización de ancho de banda basado en viewport
            abrEwmaDefaultEstimate: 5e5,
            // lowLatencyMode: false, // Desactiva a menos que el backend use LL-HLS real
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
            this.hls.loadSource(source);
        });

        this.hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
            this.video.play().catch(e => {
                Logger.warn('Auto-play bloqueado por el navegador. Requiere interacción.');
            });
            resolve(true);
        });

        this.hls.on(window.Hls.Events.ERROR, (event, data) => this.#handleHlsError(data, source));
    }

    #handleHlsError(data, source) {
        if (data.fatal) {
            Logger.error(`Error fatal HLS: ${data.type} - ${data.details}`);
            this.retryCount++;

            if (this.retryCount > this.maxRetries) {
                Logger.error(`Límite de errores fatales (${this.maxRetries}) superado. Canal muerto.`);
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
            Logger.warn(`Error no faltal HLS: ${data.type} - ${data.details}`);
            // Si entra un aviso no fatal (y no son timeouts), asumimos que el stream se estabilizó
            if (data.details !== 'fragLoadTimeOut' && data.details !== 'levelLoadTimeOut') {
                this.retryCount = 0;
            }

            // ... (Aquí va la lógica de "Nudge" para desatascar streams lentos que ya tenías)
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

        Logger.error(`[Nativo] ${errorMessage}`);
        this.notifications?.showError(`Señal perdida: ${errorMessage}`);
    }

    destroyAndResolve(success) {
        this.destroy();
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