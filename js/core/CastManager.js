import { notifications } from '../ui/NotificationManager.js';

export class CastManager {
    constructor(onStateChange) {
        this.onStateChange = onStateChange; // (isConnected, channelName) => {}
        this.isCastAvailable = false;
        this.currentChannel = null;

        // El SDK de Cast carga de forma asíncrona, interceptamos el callback
        window.__onGCastApiAvailable = (isAvailable) => {
            if (isAvailable) {
                this.#initializeCastApi();
            }
        };
    }

    #initializeCastApi() {
        const castContext = cast.framework.CastContext.getInstance();
        
        castContext.setOptions({
            // Usar el ID genérico para streams de video (soporta HLS/M3U8)
            receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
            autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
        });

        this.isCastAvailable = true;
        console.log('[SPTV]', 'Google Cast API inicializada');

        // Escuchar cambios de estado (Conectando, Conectado, Desconectado)
        castContext.addEventListener(
            cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
            (event) => {
                const isConnected = event.sessionState === cast.framework.SessionState.SESSION_STARTED ||
                                    event.sessionState === cast.framework.SessionState.SESSION_RESUMED;
                
                if (isConnected && this.currentChannel) {
                    // Si nos acabamos de conectar y hay un canal local sonando, lo enviamos a la TV
                    this.castChannel(this.currentChannel);
                }
                
                // Avisamos a main.js/PlayerManager del cambio
                if (this.onStateChange) {
                    this.onStateChange(isConnected, this.currentChannel);
                }

                if (event.sessionState === cast.framework.SessionState.SESSION_ENDED) {
                     notifications.showInfo('Desconectado de Chromecast');
                }
            }
        );
    }

    // Método para ser llamado desde main.js cuando se cambia de canal
    castChannel(channel) {
        this.currentChannel = channel;

        if (!this.isCastAvailable) return false;

        const castSession = cast.framework.CastContext.getInstance().getCurrentSession();
        if (!castSession) {
            // No estamos conectados a la TV, devuelve false para que se reproduzca localmente
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

        return true; // Se está enviando a la TV
    }
}
