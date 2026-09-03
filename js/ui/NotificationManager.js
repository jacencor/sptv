// @ts-check

/**
 * @typedef {'danger' | 'warning' | 'success' | 'info' | 'update'} ToastType
 */

class NotificationManager {
    constructor() {
        /** @type {HTMLElement | null} */
        this.toastContainer = document.getElementById('toastContainer');
    }

    /**
     * Crea y muestra un toast Bootstrap con el estilo y duración indicados.
     * @param {string} message
     * @param {ToastType} [type='danger']
     * @param {number} [duration=4000] - Duración en milisegundos antes de ocultarse
     * @returns {void}
     */
    showToast(message, type = 'danger', duration = 4000) {
        if (!this.toastContainer) return;

        const isDark = /** @type {ToastType[]} */ (['danger', 'success', 'update']).includes(type);
        /** @type {Record<string, string>} */
        const icons = {
            danger: 'fa-circle-exclamation',
            warning: 'fa-triangle-exclamation',
            success: 'fa-check-circle',
            info: 'fa-circle-info',
        };
        const icon = icons[type] || 'fa-bell';
        const ariaLive = (type === 'danger' || type === 'warning') ? 'assertive' : 'polite';

        const html = `
            <div class="toast align-items-center toast-${type} border-0" role="alert" aria-live="${ariaLive}" aria-atomic="true" data-bs-autohide="true" data-bs-delay="${duration}">
                <div class="d-flex">
                    <div class="toast-body"><i class="fas ${icon} me-2"></i> ${message}</div>
                    <button type="button" class="btn-close ${isDark ? 'btn-close-white' : ''} me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button>
                </div>
            </div>`;

        this.toastContainer.insertAdjacentHTML('beforeend', html);
        const toastEl = /** @type {HTMLElement} */ (this.toastContainer.lastElementChild);

        try {
            new bootstrap.Toast(toastEl, { animation: true, autohide: true, delay: duration }).show();
            toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
        } catch (e) {
            console.log('[SPTV]', `[${type.toUpperCase()}] ${message}`);
        }
    }

    /**
     * Muestra un toast especial de actualización de PWA (no se auto-oculta).
     * Llama a `onUpdateCallback` cuando el usuario confirma la actualización.
     * @param {() => void} onUpdateCallback
     * @returns {void}
     */
    showUpdateToast(onUpdateCallback) {
        if (!this.toastContainer) return;

        const html = `
            <div class="toast toast-update align-items-center border-0" role="alertdialog" aria-live="assertive" aria-atomic="true" data-bs-autohide="false">
                <div class="toast-body d-flex flex-column">
                    <div class="d-flex align-items-center mb-2"><i class="fas fa-download me-2"></i><strong>Nueva versión</strong></div>
                    <div>Actualización lista.</div>
                    <div class="mt-2 pt-2 border-top">
                        <button type="button" class="btn btn-light w-100 fw-bold btnUpdatePwa">Actualizar Ahora</button>
                        <button type="button" class="btn btn-link text-white w-100 text-decoration-none mt-1" data-bs-dismiss="toast">Quizás más tarde</button>
                    </div>
                </div>
            </div>`;

        this.toastContainer.insertAdjacentHTML('beforeend', html);
        const toastEl = /** @type {HTMLElement} */ (this.toastContainer.lastElementChild);

        const updateBtn = /** @type {HTMLButtonElement} */ (toastEl.querySelector('.btnUpdatePwa'));
        updateBtn.addEventListener('click', (e) => {
            const btn = /** @type {HTMLButtonElement} */ (e.target);
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Actualizando...';
            btn.disabled = true;
            onUpdateCallback();
        });

        try {
            new bootstrap.Toast(toastEl, { animation: true, autohide: false }).show();
            toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
        } catch (e) {
            console.error('[SPTV]', 'Error toast update:', e);
        }
    }

    /** @param {string} msg @returns {void} */
    showError(msg) { console.error('[SPTV]', msg); this.showToast(msg, 'danger'); }

    /** @param {string} msg @returns {void} */
    showInfo(msg) { console.log('[SPTV]', msg); this.showToast(msg, 'info'); }

    /** @param {string} msg @returns {void} */
    showWarning(msg) { console.warn('[SPTV]', msg); this.showToast(msg, 'warning'); }

    /** @param {string} msg @param {number} [duration] @returns {void} */
    showSuccess(msg, duration) { this.showToast(msg, 'success', duration); }
}

/** @typedef {NotificationManager} INotifications */
export const notifications = new NotificationManager();