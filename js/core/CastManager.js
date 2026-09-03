import { notifications } from '../ui/NotificationManager.js';

export class CastManager {
    constructor(onStateChange) {
        this.onStateChange = onStateChange; // (isConnected, channelName) => {}
        this.isCastAvailable = false;
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
            (event) => {
                const isConnected = event.sessionState === cast.framework.SessionState.SESSION_STARTED ||
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
            (error) => {
                console.error('[SPTV]', 'Error enviando a Chromecast:', error);
                notifications.showError('Fallo al transmitir a la TV');
            }
        );

        return true;
    }
}
