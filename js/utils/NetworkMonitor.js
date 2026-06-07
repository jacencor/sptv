import { Logger } from './Logger.js';

export class NetworkMonitor {
    constructor() {
        this.connection = navigator.connection || navigator.mozConnection || null;
        this.listeners = [];
    }

    start() {
        if (!this.connection) {
            Logger.log('Network API no soportada, usando valores por defecto');
            return;
        }

        Logger.log(`Red: ${this.connection.effectiveType || 'desconocido'}, ${this.connection.downlink || '?'}Mbps`);
        this.connection.addEventListener('change', () => this.#notifyChange());
    }

    #notifyChange() {
        if (!this.connection) return;
        Logger.log(`Red cambiada: ${this.connection.effectiveType}, ${this.connection.downlink}Mbps`);
        this.listeners.forEach(fn => fn(this.connection));
    }

    onchange(callback) {
        if (typeof callback === 'function') {
            this.listeners.push(callback);
        }
    }

    getBufferConfig() {
        const speed = this.connection?.downlink || 2;
        if (speed < 1) return { maxBuffer: 30, startLevel: 0 };
        if (speed < 2.5) return { maxBuffer: 20, startLevel: -1 };
        if (speed < 5) return { maxBuffer: 12, startLevel: -1 };
        return { maxBuffer: 8, startLevel: -1 };
    }
}