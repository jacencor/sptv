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
            // lowLatencyMode: false, // Desactiva a menos que el backend use LL-HLS real
            liveSyncDurationCount: 5, // Mantener solo 2 fragmentos de sincronización
            liveMaxLatencyDurationCount: 10, // Si se retrasa mucho, salta al vivo de nuevo
            maxBufferLength: bufferConfig.maxBuffer,
            maxMaxBufferLength: 30,
            backBufferLength: 10, // Libera memoria de segmentos viejos
            startLevel: startLevel, // ABR automático
            capLevelToPlayerSize: true, // No pedir 4K si la pantalla es pequeña
            abrEwmaDefaultEstimate: 5e5, // Estimación inicial de ancho de banda (500kbps)
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
                } else {
                    Logger.warn(`Error (No fatal) HLS: ${data.type} - ${data.details}`);
                    if (data.details === 'fragLoadTimeOut' || data.details === 'levelLoadTimeOut') {
                        this.retryCount++;
                        if (this.retryCount <= this.maxRetries) {
                            Logger.warn('Múltiples timeouts detectados. Forzando desatasco...');
                            this.notifications?.showWarning('La señal origen está lenta, ajustando...');

                            // Estrategia 1: Flush del buffer de red y recarga manual
                            this.hls.stopLoad();

                            setTimeout(() => {
                                this.hls.startLoad();

                                // Estrategia 2: El Nudge usando la referencia nativa de hls.js
                                const media = this.hls.media;

                                // Verificamos que el elemento multimedia exista y esté atascado
                                if (media && (media.paused || media.readyState < 3)) {
                                    media.currentTime += 0.1;
                                    Logger.log('Nudge aplicado (+0.1s) para destrabar el buffer.');
                                }
                            }, 500);
                        }
                    }
                }
            });
        });
    }

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
        
        if (this.hls) {
            this.hls.loadSource(source);
        }
    }

    #handleManifestLoadError(source) {
        this.notifications?.showWarning('Error al cargar la lista de reproducción, reintentando...');
        setTimeout(() => {
            this.#loadSourceWithRetry(source, true);
        }, 2000);
    }

    #startLoadWithRetry(source, isRetry = false) {
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
        
        if (this.hls) {
            this.hls.startLoad(source);
        }
    }

    #handleGenericNetworkError(source) {
        this.notifications?.showWarning('Error al cargar la lista de reproducción, reintentando...');
        setTimeout(() => {
            this.#startLoadWithRetry(source, true);
        }, 2000);
    }

    #loadChannelWithRetry(source, isRetry = false) {
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
        
        if (this.hls) {
            this.loadChannel(this.currentChannel);
        }
    }

    #handleManifestTimeout(source) {
        this.notifications?.showWarning('Error al cargar la lista de reproducción, reintentando...');
        setTimeout(() => {
            this.#loadChannelWithRetry(source, true);
        }, 1000);
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