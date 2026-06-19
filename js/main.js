import { Logger } from './utils/Logger.js';
import { NetworkMonitor } from './utils/NetworkMonitor.js';
import { ChannelManager } from './core/ChannelManager.js';
import { PlayerManager } from './core/PlayerManager.js';
import { OfflineStorage } from './core/OfflineStorage.js';
import { SidebarUI } from './ui/SidebarUI.js';
import { AppState } from './core/AppState.js';
import { NotificationManager } from './ui/NotificationManager.js';
import { CastManager } from './core/CastManager.js';

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
                const notifications = NotificationManager.getInstance();
                notifications.showUpdateToast(() => {
                    // Le decimos al SW que se active
                    worker.postMessage('SKIP_WAITING');
                    worker.postMessage({ type: 'SKIP_WAITING' }); // Alternativa común
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
        this.state = AppState.getInstance();
        this.networkMonitor = new NetworkMonitor();
        this.notifications = NotificationManager.getInstance();
        this.player = null;
        this.sidebar = null;
        this.castManager = null;
        this.isChangingChannel = false; // Evitar cambios múltiples
    }

    async init() {
        Logger.log('Iniciando SPTV...');

        this.networkMonitor.start();

        this.state.setChannels(await ChannelManager.loadFromUrl('/data/play.m3u'));

        if (!this.state.channels.length) {
            this.notifications.showError('No se pudieron cargar los canales');
            Logger.error('No se cargaron canales');
            return;
        }

        const videoEl = document.getElementById('video');
        this.player = new PlayerManager(videoEl, this.networkMonitor, this.notifications);
        await this.player.init();

        this.castManager = new CastManager((isConnected, channel) => {
            if (this.player) {
                this.player.setCastMode(isConnected, channel ? channel.name : '');
            }
        });

        this.sidebar = new SidebarUI(
            (idx) => this.changeChannel(idx)
        );

        const lastChannel = await OfflineStorage.getLastChannel();
        let startIndex = 0;

        if (lastChannel) {
            const foundIndex = this.state.channels.findIndex(c => c.name === lastChannel.name);
            if (foundIndex !== -1) startIndex = foundIndex;
        }

        this.sidebar.render(this.state.channels, startIndex);
        await this.changeChannel(startIndex);
        this.setupIdleTimer();

        Logger.log('SPTV listo');
    }

    async changeChannel(index) {
        // Evitar cambios simultáneos
        if (this.isChangingChannel) {
            this.notifications.showWarning('Ya estamos cambiando de canal, espera...');
            Logger.warn('Ya cambiando canal, ignorando');
            return;
        }

        if (index === this.state.currentIndex && this.player?.hls) {
            this.notifications.showInfo('Ya estás viendo este canal');
            Logger.log('Ya en este canal');
            return;
        }

        this.isChangingChannel = true;
        this.state.currentIndex = index;
        const channel = this.state.getCurrentChannel();

        Logger.log(`Cambiando a: ${channel.name}`);

        // Guardar en almacenamiento
        await OfflineStorage.saveLastChannel(channel, index);

        // Actualizar UI del sidebar
        if (this.sidebar) {
            this.sidebar.render(this.state.channels, index);
        }

        // Si estamos casteando, lo enviamos al Chromecast y marcamos éxito
        if (this.castManager && this.castManager.isCastAvailable) {
            const castSession = cast.framework.CastContext.getInstance().getCurrentSession();
            if (castSession) {
                this.castManager.castChannel(channel);
                this.player.setCastMode(true, channel.name);
                this.notifications.showSuccess(`▶️ (TV) ${channel.name}`, 2000);
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

        Logger.log(`Exito: `+success);
        if (success) {
            this.notifications.showSuccess(`▶️ ${channel.name}`, 2000);
            if (this.sidebar) {
                this.sidebar.close();
            }
        } else if (index + 1 < this.state.channels.length) {
            this.notifications.showError(`❌ Falló ${channel.name}, cambiando al siguiente...`);
            Logger.warn(`Falló ${channel.name}, intentando siguiente...`);
            setTimeout(() => {
                this.changeChannel(index + 1);
            }, 2000);
        } else {
            this.notifications.showError('No hay más canales disponibles');
            this.notifications.showError(`❌ Falló ${channel.name}, volviendo al inicio...`);
            Logger.warn(`Falló ${channel.name}, volviendo al inicio...`);
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
            menuBtn.style.opacity = '1';
            menuBtn.style.pointerEvents = 'auto'; // Permitir clics nuevamente

            // 2. Limpiar el temporizador anterior
            clearTimeout(idleTimeout);

            // 3. Iniciar un nuevo temporizador
            idleTimeout = setTimeout(() => {
                // Verificar si el menú de Bootstrap NO está abierto
                const sidebar = document.getElementById('sidebarChannels');
                const isSidebarOpen = sidebar && sidebar.classList.contains('show');

                // Ocultar solo si el sidebar está cerrado
                if (!isSidebarOpen) {
                    menuBtn.style.opacity = '0';
                    menuBtn.style.pointerEvents = 'none'; // Evitar clics fantasmas cuando está invisible
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