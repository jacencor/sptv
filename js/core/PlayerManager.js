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
        if (!window.Hls || !window.Hls.isSupported()) {
            Logger.error('HLS.js no es soportado nativamente en este entorno');
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
        if (this.video) {
            this.video.poster = channel.img || 'img/app/error.png';
        }

        // Limpieza fundamental: liberar el buffer anterior antes de instanciar uno nuevo
        this.destroy();

        const bufferConfig = this.networkMonitor ? this.networkMonitor.getBufferConfig() : { maxBuffer: 20 };
        const startLevel = bufferConfig.startLevel !== undefined ? bufferConfig.startLevel : -1;

        this.hls = new window.Hls({
            enableWorker: true,
            lowLatencyMode: true,              // Reduce latencia (Live)
            liveSyncDurationCount: 2,          // Mantener solo 2 fragmentos de sincronización
            maxBufferLength: bufferConfig.maxBuffer,
            maxMaxBufferLength: 30,
            backBufferLength: 30,              // Libera memoria de segmentos viejos
            startLevel: startLevel,                    // ABR automático
            capLevelToPlayerSize: true,        // No pedir 4K si la pantalla es pequeña
            abrEwmaDefaultEstimate: 5e5,       // Estimación inicial de ancho de banda (500kbps)
            fragLoadingTimeOut: 10000,
            fragLoadingMaxRetry: 3,
            manifestLoadingMaxRetry: 0,
            manifestLoadingTimeOut: 10000,
            abrMaxWithRealBitrate: true
        });

        this.hls.attachMedia(this.video);

        return new Promise((resolve) => {
            this.loadPromiseResolve = resolve;

            this.hls.on(window.Hls.Events.MEDIA_ATTACHED, () => {
                this.hls.loadSource(channel.source);
            });

            this.hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                this.video.play().catch(e => Logger.warn('Autoplay bloqueado:', e));
                resolve(true);
            });

            this.hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                const playPromise = this.video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        Logger.warn('Auto-play bloqueado por el navegador. Requiere interacción del usuario.');
                    });
                }
                resolve(true);
            });

            // Estrategia de auto-recuperación sin intervención del usuario
            this.hls.on(window.Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    Logger.warn(`Error fatal HLS: ${data.type} - ${data.details}`);

                    switch (data.type) {
                        case window.Hls.ErrorTypes.NETWORK_ERROR:
                            this.notifications?.showWarning('Problema de red, reintentando...');
                            Logger.warn('Caída de red detectada, intentando reconexión de fragmentos...');
                            if (data.details === 'manifestLoadTimeOut') {
                                this.#handleManifestTimeout(channel.source);
                            } else if (data.details === 'manifestLoadError') {
                                this.#handleManifestLoadError(channel.source);
                            } else {
                                this.#handleGenericNetworkError();
                            }
                            break;
                            break;
                        case window.Hls.ErrorTypes.MEDIA_ERROR:
                            this.notifications?.showWarning('Error en el stream, recuperando...');
                            Logger.warn('Corrupción de buffer, intentando recuperar el hilo de video...');
                            this.hls.recoverMediaError();
                            break;
                        default:
                            this.notifications?.showError('Error crítico: no se puede reproducir este canal');
                            Logger.error('Error crítico insalvable. Destruyendo instancia.');
                            this.hls.destroy();
                            resolve(false);
                            break;
                    }
                }else{
                    Logger.log(`pasaba por aca`);
                    this.retryCount = 0;
                }
            });
        });
    }
    // Carga el source y lleva conteo de reintentos
    #loadSourceWithRetry(source, isRetry = false) {
        if (isRetry) {
            this.retryCount++;
            Logger.log(`Reintentando cargar manifiesto (${this.retryCount}/${this.maxRetries})`);
            this.notifications?.showWarning(`Reintentando (${this.retryCount}/${this.maxRetries})...`);
        }

        if (this.retryCount >= this.maxRetries) {
            this.notifications?.showError(`No se pudo cargar ${this.currentChannel.name} después de ${this.maxRetries} intentos`);
            this.destroyAndResolve(false);
            return;
        }

        // Limpiar cualquier carga previa pendiente
        if (this.hls) {
            this.hls.loadSource(source);
        }
    }

    #handleManifestLoadError(source) {
        this.notifications?.showWarning('Error al cargar la lista de reproducción, reintentando...');
        setTimeout(() => {
            this.#loadSourceWithRetry(source, true);
        }, 1000);
    }

    #handleGenericNetworkError() {
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            this.notifications?.showWarning(`Problema de red (${this.retryCount}/${this.maxRetries}), reintentando...`);
            setTimeout(() => {
                if (this.hls) this.hls.startLoad();
            }, 1000);
        } else {
            this.notifications?.showError(`Fallo definitivo de red para ${this.currentChannel.name}`);
            this.destroyAndResolve(false);
        }
    }
    #handleManifestTimeout(source) {
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            this.notifications?.showWarning(
                `El servidor está tardando en responder (${this.retryCount}/${this.maxRetries}), reintentando...`
            );

            // Tiempo de espera progresivo (exponential backoff)
            const delay = Math.min(2000 * Math.pow(2, this.retryCount - 1), 1000);

            setTimeout(() => {
                if (this.hls) {
                    // Destruir y recrear para asegurar limpieza completa
                    this.destroy();
                    this.loadChannel(this.currentChannel);
                }
            }, delay);
        } else {
            this.notifications?.showError(
                `No se pudo cargar ${this.currentChannel.name} después de ${this.maxRetries} intentos (timeout)`
            );
            this.destroyAndResolve(false);
        }
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
    }
}