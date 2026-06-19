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

    showUpdateToast(onUpdateCallback) {
        if (!this.toastContainer) return;

        const toastEl = document.createElement('div');
        toastEl.className = `toast align-items-center text-white text-bg-primary border-0`;
        toastEl.setAttribute('role', 'alert');
        toastEl.setAttribute('aria-live', 'assertive');
        toastEl.setAttribute('aria-atomic', 'true');
        toastEl.setAttribute('data-bs-autohide', 'false'); // No ocultar auto

        toastEl.innerHTML = `
            <div class="toast-body d-flex flex-column">
                <div class="d-flex align-items-center mb-2">
                    <i class="fas fa-download me-2"></i> 
                    <strong>Nueva versión disponible</strong>
                </div>
                <div>Una nueva versión de SPTV está lista para instalarse.</div>
                <div class="mt-2 pt-2 border-top">
                    <button type="button" class="btn btn-light btn-sm w-100 fw-bold" id="btnUpdatePwa">Actualizar Ahora</button>
                    <button type="button" class="btn btn-link btn-sm text-white w-100 text-decoration-none mt-1" data-bs-dismiss="toast">Quizás más tarde</button>
                </div>
            </div>
        `;

        this.toastContainer.appendChild(toastEl);
        
        toastEl.querySelector('#btnUpdatePwa').addEventListener('click', (e) => {
            const btn = e.target;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Actualizando...';
            btn.disabled = true;
            onUpdateCallback();
        });

        try {
            const bsToast = new bootstrap.Toast(toastEl, {
                animation: true,
                autohide: false
            });
            bsToast.show();

            toastEl.addEventListener('hidden.bs.toast', () => {
                toastEl.remove();
            });
        } catch (error) {
            Logger.error('Error al crear toast de update:', error);
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