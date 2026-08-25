import { NetworkMonitor } from './utils/NetworkMonitor.js';
import { loadChannels } from './core/ChannelManager.js';
import { PlayerManager } from './core/PlayerManager.js';
import { SidebarUI } from './ui/SidebarUI.js';
import { notifications } from './ui/NotificationManager.js';
import { CastManager } from './core/CastManager.js';

// Interceptar callback del Cast SDK antes de que el SDK termine de cargar.
// Debe estar en el scope global del módulo para ganar la carrera contra el SDK.
window.__onGCastApiAvailable = (isAvailable) => {
    window.__castApiReady = isAvailable;
};

// Al inicio de main.js, asegurar que el SW se actualice
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/serviceWorker.js');
            console.log('[SPTV] Service Worker registrado');

            // Forzar actualización al cargar
            await registration.update();

            // Escuchar cuando el nuevo ServiceWorker tome el control para recargar la página
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    refreshing = true;
                    window.location.reload();
                }
            });

            // Función para mostrar el toast de actualización
            const showUpdatePrompt = (worker) => {
                notifications.showUpdateToast(() => {
                    // Le decimos al SW que se active
                    worker.postMessage('SKIP_WAITING');
                });
            };

            // 1. Si hay un SW esperando (el usuario recargó la página sin actualizar)
            if (registration.waiting) {
                showUpdatePrompt(registration.waiting);
            }

            // 2. Escuchar cambios de estado en nuevas actualizaciones (cuando la app está abierta)
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed') {
                        if (navigator.serviceWorker.controller) {
                            // Hay una actualización disponible
                            console.log('[SPTV] Nueva versión del SW disponible, esperando confirmación');
                            showUpdatePrompt(newWorker);
                        } else {
                            console.log('[SPTV] App lista para trabajar offline');
                        }
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
        this.channels = [];
        this.currentIndex = 0;
        this.networkMonitor = new NetworkMonitor();
        this.player = null;
        this.sidebar = null;
        this.castManager = null;
        this.isChangingChannel = false; // Evitar cambios múltiples
    }

    async init() {
        console.log('[SPTV]', 'Iniciando SPTV...');

        this.networkMonitor.start();

        this.channels = await loadChannels('/data/play.m3u');

        if (!this.channels.length) {
            notifications.showError('No se pudieron cargar los canales');
            console.error('[SPTV]', 'No se cargaron canales');
            return;
        }

        const videoEl = document.getElementById('video');
        this.player = new PlayerManager(videoEl, this.networkMonitor, notifications);

        this.castManager = new CastManager((isConnected, channel) => {
            if (this.player) {
                this.player.setCastMode(isConnected, channel ? channel.name : '');
            }
        });

        this.sidebar = new SidebarUI(
            (idx) => this.changeChannel(idx)
        );

        let startIndex = 0;
        try {
            const data = localStorage.getItem('sptv_last');
            if (data) {
                const parsed = JSON.parse(data);
                if (Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000) {
                    const foundIndex = this.channels.findIndex(c => c.name === parsed.name);
                    if (foundIndex !== -1) startIndex = foundIndex;
                }
            }
        } catch (e) { /* ignore */ }

        this.sidebar.render(this.channels, startIndex);
        await this.changeChannel(startIndex);
        this.setupIdleTimer();

        console.log('[SPTV]', 'SPTV listo');
    }

    async changeChannel(index) {
        // Evitar cambios simultáneos
        if (this.isChangingChannel) {
            notifications.showWarning('Ya estamos cambiando de canal, espera...');
            console.warn('[SPTV]', 'Ya cambiando canal, ignorando');
            return;
        }

        if (index === this.currentIndex && this.player?.hls) {
            notifications.showInfo('Ya estás viendo este canal');
            console.log('[SPTV]', 'Ya en este canal');
            return;
        }

        this.isChangingChannel = true;
        this.currentIndex = index;
        const channel = this.channels[this.currentIndex];

        console.log('[SPTV]', `Cambiando a: ${channel.name}`);

        // Guardar en almacenamiento
        try {
            localStorage.setItem('sptv_last', JSON.stringify({
                name: channel.name,
                url: channel.source,
                poster: channel.img,
                index: index,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('[SPTV]', 'No se pudo guardar último canal');
        }

        // Actualizar UI del sidebar
        if (this.sidebar) {
            this.sidebar.render(this.channels, index);
        }

        // Si estamos casteando, lo enviamos al Chromecast y marcamos éxito
        if (this.castManager && this.castManager.isCastAvailable) {
            const castSession = cast.framework.CastContext.getInstance().getCurrentSession();
            if (castSession) {
                this.castManager.castChannel(channel);
                this.player.setCastMode(true, channel.name);
                notifications.showSuccess(`▶️ (TV) ${channel.name}`, 2000);
                if (this.sidebar) {
                    this.sidebar.close();
                }
                this.isChangingChannel = false;
                return;
            }
        }

        // Cargar canal localmente
        this.player.retryCount = 0;
        const success = await this.player.loadChannel(channel);

        console.log('[SPTV]', `Exito: `+success);
        if (success) {
            notifications.showSuccess(`▶️ ${channel.name}`, 2000);
            if (this.sidebar) {
                this.sidebar.close();
            }
        } else if (index + 1 < this.channels.length) {
            notifications.showError(`❌ Falló ${channel.name}, cambiando al siguiente...`);
            console.warn('[SPTV]', `Falló ${channel.name}, intentando siguiente...`);
            setTimeout(() => {
                this.changeChannel(index + 1);
            }, 2000);
        } else {
            notifications.showError('No hay más canales disponibles');
            notifications.showError(`❌ Falló ${channel.name}, volviendo al inicio...`);
            console.warn('[SPTV]', `Falló ${channel.name}, volviendo al inicio...`);
            index = 0;
            setTimeout(() => {
                this.changeChannel(index);
            }, 2000);
        }

        this.isChangingChannel = false;
    }

    setupIdleTimer() {
        let idleTimeout = null;
        const menuBtn = document.getElementById('openSidebar');
        const idleTime = 3500; // 3.5 segundos de inactividad antes de ocultar

        const resetIdleTimer = () => {
            if (!menuBtn) return;

            // 1. Mostrar el botón inmediatamente
            menuBtn.classList.remove('menu-btn--idle');

            // 2. Limpiar el temporizador anterior
            clearTimeout(idleTimeout);

            // 3. Iniciar un nuevo temporizador
            idleTimeout = setTimeout(() => {
                // Verificar si el menú de Bootstrap NO está abierto
                const sidebar = document.getElementById('sidebarChannels');
                const isSidebarOpen = sidebar && sidebar.classList.contains('show');

                // Ocultar solo si el sidebar está cerrado
                if (!isSidebarOpen) {
                    menuBtn.classList.add('menu-btn--idle');
                }
            }, idleTime);
        };

        // Escuchar eventos de interacción (ratón, táctil, teclado) en toda la ventana
        // Usamos { passive: true } para optimizar el rendimiento del scroll/touch
        // Delegación de eventos optimizada
        const activeEvents = ['mousemove', 'mousedown', 'keydown'];
        const passiveEvents = ['touchstart', 'touchmove', 'wheel'];

        activeEvents.forEach(evt => window.addEventListener(evt, resetIdleTimer));
        passiveEvents.forEach(evt => window.addEventListener(evt, resetIdleTimer, { passive: true }));
        // Disparar la primera vez para iniciar el ciclo
        resetIdleTimer();
    }
}

// Inicializar app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new SPTVApp().init());
} else {
    new SPTVApp().init();
}