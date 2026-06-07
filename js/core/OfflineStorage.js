import { Logger } from '../utils/Logger.js';

export class OfflineStorage {
    static async saveLastChannel(channel, index) {
        try {
            localStorage.setItem('sptv_last', JSON.stringify({
                name: channel.name,
                url: channel.source,
                poster: channel.img,
                index: index,
                timestamp: Date.now()
            }));
        } catch (e) {
            Logger.warn('No se pudo guardar último canal');
        }
    }

    static async getLastChannel() {
        try {
            const data = localStorage.getItem('sptv_last');
            if (data) {
                const parsed = JSON.parse(data);
                if (Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000) {
                    return parsed;
                }
            }
            return null;
        } catch (e) {
            return null;
        }
    }
}