import { Logger } from '../utils/Logger.js';

export class NotificationManager {
    static #instance = null;

    constructor() {
        if (NotificationManager.#instance) return NotificationManager.#instance;
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.toastContainer = document.getElementById('toastContainer');
        NotificationManager.#instance = this;
    }

    static getInstance() {
        if (!this.#instance) this.#instance = new NotificationManager();
        return this.#instance;
    }

    /**
     * Muestra un toast
     * @param {string} message - Texto del mensaje
     * @param {string} type - 'danger' | 'warning' | 'success' | 'info' (colores de Bootstrap)
     * @param {number} duration - Duración en milisegundos
     */
    showToast(message, type = 'danger', duration = 4000) {
        if (!this.toastContainer) return;

        Logger.log('=== DEBUG TOAST ===');
        Logger.log('Mensaje:', message);
        Logger.log('Contenedor existe?', !!this.toastContainer);
        Logger.log('Bootstrap disponible?', typeof bootstrap !== 'undefined');
        Logger.log('Tipo:', type);

        const toastEl = document.createElement('div');
        toastEl.className = `toast align-items-center text-white text-bg-${type} border-0`;
        toastEl.setAttribute('role', 'alert');
        toastEl.setAttribute('aria-live', 'assertive');
        toastEl.setAttribute('aria-atomic', 'true');
        toastEl.setAttribute('data-bs-autohide', 'true');
        toastEl.setAttribute('data-bs-delay', duration);

        toastEl.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas ${this.#getIconByType(type)} me-2"></i> ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;

        this.toastContainer.appendChild(toastEl);
        try {
            const bsToast = new bootstrap.Toast(toastEl, {
                animation: true,
                autohide: true,
                delay: duration
            });
            bsToast.show();

            // Limpiar del DOM después de ocultar
            toastEl.addEventListener('hidden.bs.toast', () => {
                toastEl.remove();
            });
        } catch (error) {
            Logger.error('Error al crear toast:', error);
            // Fallback: mostrar en consola
            Logger.info(`[${type.toUpperCase()}] ${message}`);
        }
    }

    showError(message) {
        Logger.error(message);
        this.showToast(message, 'danger');
    }

    showInfo(message) {
        Logger.log(message);
        this.showToast(message, 'info');
    }

    showWarning(message) {
        Logger.warn(message);
        this.showToast(message, 'warning');
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    #getIconByType(type) {
        const icons = {
            danger: 'fa-circle-exclamation',
            warning: 'fa-triangle-exclamation',
            success: 'fa-check-circle',
            info: 'fa-circle-info'
        };
        return icons[type] || 'fa-bell';
    }
}