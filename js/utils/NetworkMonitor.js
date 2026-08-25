export class NetworkMonitor {
    constructor() {
        this.connection = navigator.connection || navigator.mozConnection || null;
    }

    start() {
        if (!this.connection) {
            console.log('[SPTV]', 'Network API no soportada, usando valores por defecto');
            return;
        }

        console.log('[SPTV]', `Red: ${this.connection.effectiveType || 'desconocido'}, ${this.connection.downlink || '?'}Mbps`);
    }

    getBufferConfig() {
        const speed = this.connection?.downlink || 2;
        if (speed < 1) return { maxBuffer: 30, startLevel: 0 };
        if (speed < 2.5) return { maxBuffer: 20, startLevel: -1 };
        if (speed < 5) return { maxBuffer: 12, startLevel: -1 };
        return { maxBuffer: 8, startLevel: -1 };
    }
}