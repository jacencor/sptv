import { loadChannels } from './core/ChannelManager.js';
import { PlayerManager } from './core/PlayerManager.js';
import { SidebarUI } from './ui/SidebarUI.js';
import { notifications } from './ui/NotificationManager.js';
import { CastManager } from './core/CastManager.js';

// Interceptar callback del Cast SDK para ganar la carrera de inicialización
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

            const showUpdatePrompt = (worker) => {
                notifications.showUpdateToast(() => worker.postMessage('SKIP_WAITING'));
            };

            // SW en espera (recarga sin actualizar)
            if (registration.waiting) showUpdatePrompt(registration.waiting);

            // Nuevas actualizaciones
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
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
        this.channels = [];
        this.currentIndex = 0;
        this.player = null;
        this.sidebar = null;
        this.castManager = null;

    }

    async init() {
        console.log('[SPTV]', 'Iniciando SPTV...');

        this.channels = await loadChannels('/data/play.m3u');

        if (!this.channels.length) {
            notifications.showError('No se pudieron cargar los canales');
            console.error('[SPTV]', 'No se cargaron canales');
            return;
        }

        const videoEl = document.getElementById('video');
        this.player = new PlayerManager(videoEl, notifications);

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
        this.setupKeyboardNavigation();

        console.log('[SPTV]', 'SPTV listo');
    }

    async changeChannel(index) {
        this.currentIndex = index;
        const channel = this.channels[this.currentIndex];

        console.log('[SPTV]', `Cambiando a: ${channel.name}`);

        try {
            localStorage.setItem('sptv_last', JSON.stringify({ name: channel.name, timestamp: Date.now() }));
        } catch (e) {
            console.warn('[SPTV]', 'No se pudo guardar último canal');
        }

        if (this.sidebar) this.sidebar.render(this.channels, index);

        if (this.castManager && this.castManager.isCastAvailable) {
            const castSession = cast.framework.CastContext.getInstance().getCurrentSession();
            if (castSession) {
                this.castManager.castChannel(channel);
                this.player.setCastMode(true, channel.name);
                notifications.showSuccess(`▶️ (TV) ${channel.name}`, 2000);
                if (this.sidebar) this.sidebar.close();
                return;
            }
        }

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
            setTimeout(() => {
                this.changeChannel(0);
            }, 2000);
        }

    }

    setupIdleTimer() {
        let idleTimeout = null;
        const menuBtn = document.getElementById('openSidebar');
        const idleTime = 3500; // 3.5 segundos de inactividad antes de ocultar

        const resetIdleTimer = () => {
            if (!menuBtn) return;
            menuBtn.classList.remove('menu-btn--idle');
            clearTimeout(idleTimeout);
            idleTimeout = setTimeout(() => {
                const sidebar = document.getElementById('sidebarChannels');
                if (!(sidebar && sidebar.classList.contains('show'))) {
                    menuBtn.classList.add('menu-btn--idle');
                }
            }, idleTime);
        };

        window.addEventListener('mousemove', resetIdleTimer);
        window.addEventListener('touchstart', resetIdleTimer, { passive: true });
        window.addEventListener('keydown', resetIdleTimer);
        resetIdleTimer();
    }

    setupKeyboardNavigation() {
        window.addEventListener('keydown', (e) => {
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

                case 'ArrowRight':
                    e.preventDefault();
                    const channel = this.channels[this.currentIndex];
                    if (channel) notifications.showInfo(`Reproduciendo: ${channel.name}`);
                    break;
            }
        });
    }

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