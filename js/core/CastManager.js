// @ts-check

/** @import { Channel } from './ChannelManager.js' */
import { notifications } from '../ui/NotificationManager.js';

export class CastManager {
    /**
     * @param {(isConnected: boolean, channel: Channel | null) => void} onStateChange
     * Callback invocado cuando cambia el estado de la sesión de Chromecast.
     */
    constructor(onStateChange) {
        /** @type {(isConnected: boolean, channel: Channel | null) => void} */
        this.onStateChange = onStateChange;

        /** @type {boolean} Indica si la API de Cast está inicializada y disponible */
        this.isCastAvailable = false;

        /** @type {Channel | null} Canal que se está transmitiendo actualmente */
        this.currentChannel = null;

        // Toma el control del callback (reemplaza el interceptor temporal de main.js).
        // También actualiza __castApiReady para que el flag quede siempre sincronizado.
        window.__onGCastApiAvailable = (isAvailable) => {
            window.__castApiReady = isAvailable;
            if (isAvailable) this._initializeCastApi();
        };

        // El SDK ya disparó el callback antes de que CastManager fuera instanciado
        if (window.__castApiReady) {
            this._initializeCastApi();
        }
    }

    /**
     * Configura el contexto de Cast y suscribe el listener de cambios de sesión.
     * Solo debe llamarse una vez que `window.cast` esté disponible.
     * @returns {void}
     */
    _initializeCastApi() {
        const castContext = cast.framework.CastContext.getInstance();

        castContext.setOptions({
            // Usar el ID genérico para streams de video (soporta HLS/M3U8)
            receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
            autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
        });

        this.isCastAvailable = true;
        console.log('[SPTV]', 'Google Cast API inicializada');

        castContext.addEventListener(
            cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
            /** @param {any} event */
            (event) => {
                const isConnected =
                    event.sessionState === cast.framework.SessionState.SESSION_STARTED ||
                    event.sessionState === cast.framework.SessionState.SESSION_RESUMED;

                if (isConnected && this.currentChannel) {
                    this.castChannel(this.currentChannel);
                }

                if (this.onStateChange) {
                    this.onStateChange(isConnected, this.currentChannel);
                }

                if (event.sessionState === cast.framework.SessionState.SESSION_ENDED) {
                    notifications.showInfo('Desconectado de Chromecast');
                }
            }
        );
    }

    /**
     * Envía un canal a reproducir en el dispositivo Chromecast activo.
     * @param {Channel} channel
     * @returns {boolean} `true` si se envió la solicitud, `false` si no hay sesión activa.
     */
    castChannel(channel) {
        this.currentChannel = channel;

        if (!this.isCastAvailable) return false;

        const castSession = cast.framework.CastContext.getInstance().getCurrentSession();
        if (!castSession) {
            return false;
        }

        console.log('[SPTV]', `Enviando canal a Chromecast: ${channel.name}`);

        const mediaInfo = new chrome.cast.media.MediaInfo(channel.source, 'application/x-mpegurl');
        mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
        mediaInfo.metadata.metadataType = chrome.cast.media.MetadataType.GENERIC;
        mediaInfo.metadata.title = channel.name;
        if (channel.img) {
            mediaInfo.metadata.images = [{ url: channel.img }];
        }

        const request = new chrome.cast.media.LoadRequest(mediaInfo);

        castSession.loadMedia(request).then(
            () => {
                console.log('[SPTV]', 'Carga en Chromecast exitosa');
                notifications.showSuccess(`Enviado a TV: ${channel.name}`);
            },
            /** @param {Error} error */
            (error) => {
                console.error('[SPTV]', 'Error enviando a Chromecast:', error);
                notifications.showError('Fallo al transmitir a la TV');
            }
        );

        return true;
    }
}
