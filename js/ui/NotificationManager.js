class NotificationManager {
    constructor() {
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.toastContainer = document.getElementById('toastContainer');
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
        toastEl.setAttribute('aria-live', this.#getAriaLive(type));
        toastEl.setAttribute('aria-atomic', 'true');
        toastEl.setAttribute('data-bs-autohide', 'true');
        toastEl.setAttribute('data-bs-delay', duration);

        toastEl.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas ${this.#getIconByType(type)} me-2"></i> ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar notificación"></button>
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
            console.error('[SPTV]', 'Error al crear toast:', error);
            // Fallback: mostrar en consola
            console.log('[SPTV]', `[${type.toUpperCase()}] ${message}`);
        }
    }

    showUpdateToast(onUpdateCallback) {
        if (!this.toastContainer) return;

        const toastEl = document.createElement('div');
        toastEl.className = 'toast toast-update align-items-center text-white text-bg-primary border-0';
        toastEl.setAttribute('role', 'alertdialog');
        toastEl.setAttribute('aria-live', 'assertive');
        toastEl.setAttribute('aria-atomic', 'true');
        toastEl.setAttribute('data-bs-autohide', 'false');

        toastEl.innerHTML = `
            <div class="toast-body d-flex flex-column">
                <div class="d-flex align-items-center mb-2">
                    <i class="fas fa-download me-2"></i> 
                    <strong>Nueva versión disponible</strong>
                </div>
                <div>Una nueva versión de SPTV está lista para instalarse.</div>
                <div class="mt-2 pt-2 border-top">
                    <button type="button" class="btn btn-light w-100 fw-bold" id="btnUpdatePwa">Actualizar Ahora</button>
                    <button type="button" class="btn btn-link text-white w-100 text-decoration-none mt-1" data-bs-dismiss="toast" aria-label="Posponer actualización">Quizás más tarde</button>
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
            console.error('[SPTV]', 'Error al crear toast de update:', error);
        }
    }

    showError(message) {
        console.error('[SPTV]', message);
        this.showToast(message, 'danger');
    }

    showInfo(message) {
        console.log('[SPTV]', message);
        this.showToast(message, 'info');
    }

    showWarning(message) {
        console.warn('[SPTV]', message);
        this.showToast(message, 'warning');
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    // SC 4.1.3: errores/warnings son urgentes (assertive), info/success son informativos (polite)
    #getAriaLive(type) {
        return (type === 'danger' || type === 'warning') ? 'assertive' : 'polite';
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

export const notifications = new NotificationManager();