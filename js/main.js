// @ts-check

/** @import { Channel } from './core/ChannelManager.js' */
import { loadChannels } from './core/ChannelManager.js';
import { PlayerManager } from './core/PlayerManager.js';
import { SidebarUI } from './ui/SidebarUI.js';
import { notifications } from './ui/NotificationManager.js';
import { CastManager } from './core/CastManager.js';

// Interceptar callback del Cast SDK para ganar la carrera de inicialización.
// CastManager tomará el control de este callback cuando sea instanciado.
window.__onGCastApiAvailable = (isAvailable) => {
    window.__castApiReady = isAvailable;
};

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('./serviceWorker.js');
            console.log('[SPTV] Service Worker registrado');

            await registration.update();

            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    refreshing = true;
                    window.location.reload();
                }
            });

            /** @param {ServiceWorker} worker */
            const showUpdatePrompt = (worker) => {
                notifications.showUpdateToast(() => worker.postMessage('SKIP_WAITING'));
            };

            // SW en espera (recarga sin actualizar)
            if (registration.waiting) showUpdatePrompt(registration.waiting);

            // Nuevas actualizaciones detectadas en background
            registration.addEventListener('updatefound', () => {
                const newWorker = /** @type {ServiceWorker} */ (registration.installing);
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('[SPTV] Nueva versión del SW disponible');
                        showUpdatePrompt(newWorker);
                    }
                });
            });

        } catch (error) {
            console.error('[SPTV] Error registrando SW:', error);
        }
    });
}

class SPTVApp {
    constructor() {
        /** @type {Channel[]} */
        this.channels = [];

        /** @type {number} Índice del canal actualmente en reproducción */
        this.currentIndex = 0;

        /** @type {PlayerManager | null} */
        this.player = null;

        /** @type {SidebarUI | null} */
        this.sidebar = null;

        /** @type {CastManager | null} */
        this.castManager = null;
        
        /** @type {ReturnType<typeof setTimeout> | undefined} */
        this.zapTimeout = undefined;
    }

    /**
     * Punto de entrada: carga canales, inicializa módulos y arranca la reproducción.
     * @returns {Promise<void>}
     */
    async init() {
        console.log('[SPTV]', 'Iniciando SPTV...');

        this.channels = await loadChannels('/data/play.m3u');

        if (!this.channels.length) {
            notifications.showError('No se pudieron cargar los canales');
            console.error('[SPTV]', 'No se cargaron canales');
            return;
        }

        const videoEl = /** @type {HTMLVideoElement} */ (document.getElementById('video'));
        this.player = new PlayerManager(videoEl, notifications);

        this.castManager = new CastManager((isConnected, channel) => {
            if (this.player) {
                this.player.setCastMode(isConnected, channel ? channel.name : '');
            }
        });

        this.sidebar = new SidebarUI(
            (idx) => this.changeChannel(idx)
        );

        // Restaurar el último canal visto (TTL: 7 días)
        let startIndex = 0;
        try {
            const data = localStorage.getItem('sptv_last');
            if (data) {
                /** @type {{ name: string, timestamp: number }} */
                const parsed = JSON.parse(data);
                if (Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000) {
                    const foundIndex = this.channels.findIndex(c => c.name === parsed.name);
                    if (foundIndex !== -1) startIndex = foundIndex;
                }
            }
        } catch (e) { /* ignorar errores de localStorage */ }

        this.sidebar.render(this.channels, startIndex);
        await this.changeChannel(startIndex, true);
        this.setupIdleTimer();
        this.setupKeyboardNavigation();
        this.setupPiP();

        console.log('[SPTV]', 'SPTV listo');
    }

    /**
     * Configura el botón y eventos de Picture-in-Picture si el navegador lo soporta.
     * @returns {void}
     */
    setupPiP() {
        const video = /** @type {HTMLVideoElement | null} */ (document.getElementById('video'));
        const pipBtn = document.getElementById('pipBtn');

        // Document.pictureInPictureEnabled verifica si el navegador/dispositivo soporta PiP
        // Algunos navegadores requieren @ts-ignore o cast explícito debido a que no está en la lib por defecto.
        if (video && pipBtn && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled) {
            pipBtn.classList.remove('d-none');

            pipBtn.addEventListener('click', /** @param {MouseEvent} e */ async (e) => {
                try {
                    if (document.pictureInPictureElement) {
                        await document.exitPictureInPicture();
                    } else if (video.readyState >= 1) { // Necesita metadata cargada al menos
                        // Cast para evitar errores de TS si requestPictureInPicture no está declarado en ES2022 DOM lib
                        await (/** @type {any} */ (video)).requestPictureInPicture();
                    }
                } catch (error) {
                    console.error('[SPTV] Error al usar Picture-in-Picture:', error);
                }
            });

            video.addEventListener('enterpictureinpicture', () => {
                pipBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
                pipBtn.setAttribute('aria-expanded', 'true');
            });

            video.addEventListener('leavepictureinpicture', () => {
                pipBtn.innerHTML = '<i class="fa-solid fa-clone"></i>';
                pipBtn.setAttribute('aria-expanded', 'false');
            });
        }
    }

    /**
     * Cambia al canal en el índice indicado. Si Chromecast está activo, envía
     * el canal a la TV. Si falla, intenta el siguiente o vuelve al primero.
     * @param {number} index
     * @param {boolean} immediate - Si es true, ignora el debounce
     * @returns {Promise<void>}
     */
    async changeChannel(index, immediate = false) {
        this.currentIndex = index;
        const channel = this.channels[this.currentIndex];

        // 1. Actualización visual instantánea
        if (this.sidebar) this.sidebar.render(this.channels, index);

        try {
            localStorage.setItem('sptv_last', JSON.stringify({ name: channel.name, timestamp: Date.now() }));
        } catch (e) {
            console.warn('[SPTV]', 'No se pudo guardar último canal');
        }

        // 2. Debounce para lógica pesada (Chromecast/HLS)
        if (this.zapTimeout) clearTimeout(this.zapTimeout);
        
        const applyChange = async () => {
            console.log('[SPTV]', `Cambiando a: ${channel.name}`);
            
            if (this.castManager && this.castManager.isCastAvailable) {
                const castSession = cast.framework.CastContext.getInstance().getCurrentSession();
                if (castSession) {
                    this.castManager.castChannel(channel);
                    this.player?.setCastMode(true, channel.name);
                    notifications.showSuccess(`▶️ (TV) ${channel.name}`, 2000);
                    if (this.sidebar) this.sidebar.close();
                    return;
                }
            }

            if (!this.player) return;

            this.player.retryCount = 0;
            const success = await this.player.loadChannel(channel);

            console.log('[SPTV]', `Exito: ` + success);

            if (success === 'aborted') {
                console.log('[SPTV]', 'Carga anterior abortada por cambio rápido de canal.');
                return;
            }

            if (success) {
                notifications.showSuccess(`▶️ ${channel.name}`, 2000);
                if (this.sidebar) this.sidebar.close();
            } else if (this.currentIndex + 1 < this.channels.length) {
                notifications.showError(`❌ Falló ${channel.name}, cambiando al siguiente...`);
                console.warn('[SPTV]', `Falló ${channel.name}, intentando siguiente...`);
                // Zapping automático si falla sin debounce visual
                setTimeout(() => { this.changeChannel(this.currentIndex + 1, true); }, 2000);
            } else {
                notifications.showError('No hay más canales disponibles');
                notifications.showError(`❌ Falló ${channel.name}, volviendo al inicio...`);
                console.warn('[SPTV]', `Falló ${channel.name}, volviendo al inicio...`);
                setTimeout(() => { this.changeChannel(0, true); }, 2000);
            }
        };

        if (immediate) {
            applyChange();
        } else {
            this.zapTimeout = setTimeout(applyChange, 400); // 400ms debounce
        }
    }

    /**
     * Oculta el botón de menú tras 3.5 s de inactividad del usuario.
     * @returns {void}
     */
    setupIdleTimer() {
        /** @type {ReturnType<typeof setTimeout> | undefined} */
        let idleTimeout = undefined;
        const idleTime = 3500; // ms de inactividad antes de ocultar

        const resetIdleTimer = () => {
            const controls = document.querySelectorAll('#openSidebar, #overlayActions');
            controls.forEach(el => el.classList.remove('menu-btn--idle'));
            
            if (idleTimeout) clearTimeout(idleTimeout);
            idleTimeout = setTimeout(() => {
                const sidebar = document.getElementById('sidebarChannels');
                if (!(sidebar && sidebar.classList.contains('show'))) {
                    controls.forEach(el => el.classList.add('menu-btn--idle'));
                }
            }, idleTime);
        };

        window.addEventListener('mousemove', resetIdleTimer);
        window.addEventListener('touchstart', resetIdleTimer, { passive: true });
        window.addEventListener('keydown', resetIdleTimer);
        resetIdleTimer();
    }

    /**
     * Configura navegación por teclado global (flechas, PageUp/Down, teclas de TV).
     * Solo actúa cuando el sidebar está cerrado.
     * @returns {void}
     */
    setupKeyboardNavigation() {
        window.addEventListener('keydown', /** @param {KeyboardEvent} e */ (e) => {
            const sidebar = document.getElementById('sidebarChannels');
            const isSidebarOpen = sidebar && sidebar.classList.contains('show');

            if (isSidebarOpen) return;

            switch (e.key) {
                case 'ArrowLeft':
                case 'Enter':
                    e.preventDefault();
                    if (this.sidebar) this.sidebar.open();
                    break;

                case 'ArrowUp':
                case 'PageUp':
                case 'ChannelUp':
                case 'UI_KEY_CHANNEL_UP':
                    e.preventDefault();
                    this._zapChannel(-1);
                    break;

                case 'ArrowDown':
                case 'PageDown':
                case 'ChannelDown':
                case 'UI_KEY_CHANNEL_DOWN':
                    e.preventDefault();
                    this._zapChannel(1);
                    break;

                case 'ArrowRight': {
                    e.preventDefault();
                    const channel = this.channels[this.currentIndex];
                    if (channel) notifications.showInfo(`Reproduciendo: ${channel.name}`);
                    break;
                }
            }
        });
    }

    /**
     * Avanza o retrocede un canal de forma circular.
     * @param {1 | -1} direction - `1` para siguiente, `-1` para anterior
     * @returns {void}
     */
    _zapChannel(direction) {
        let newIndex = this.currentIndex + direction;
        if (newIndex < 0) {
            newIndex = this.channels.length - 1;
        } else if (newIndex >= this.channels.length) {
            newIndex = 0;
        }
        this.changeChannel(newIndex);
    }
}

new SPTVApp().init();