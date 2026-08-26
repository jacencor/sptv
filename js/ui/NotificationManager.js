class NotificationManager {
    constructor() {
        this.toastContainer = document.getElementById('toastContainer');
    }

    showToast(message, type = 'danger', duration = 4000) {
        if (!this.toastContainer) return;

        const isDark = ['danger', 'success', 'update'].includes(type);
        const icon = { danger: 'fa-circle-exclamation', warning: 'fa-triangle-exclamation', success: 'fa-check-circle', info: 'fa-circle-info' }[type] || 'fa-bell';

        const html = `
            <div class="toast align-items-center toast-${type} border-0" role="alert" aria-live="${type === 'danger' || type === 'warning' ? 'assertive' : 'polite'}" aria-atomic="true" data-bs-autohide="true" data-bs-delay="${duration}">
                <div class="d-flex">
                    <div class="toast-body"><i class="fas ${icon} me-2"></i> ${message}</div>
                    <button type="button" class="btn-close ${isDark ? 'btn-close-white' : ''} me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button>
                </div>
            </div>`;

        this.toastContainer.insertAdjacentHTML('beforeend', html);
        const toastEl = this.toastContainer.lastElementChild;

        try {
            new bootstrap.Toast(toastEl, { animation: true, autohide: true, delay: duration }).show();
            toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
        } catch (e) {
            console.log('[SPTV]', `[${type.toUpperCase()}] ${message}`);
        }
    }

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
        const toastEl = this.toastContainer.lastElementChild;

        toastEl.querySelector('.btnUpdatePwa').addEventListener('click', (e) => {
            e.target.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Actualizando...';
            e.target.disabled = true;
            onUpdateCallback();
        });

        try {
            new bootstrap.Toast(toastEl, { animation: true, autohide: false }).show();
            toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
        } catch (e) {
            console.error('[SPTV]', 'Error toast update:', e);
        }
    }

    showError(msg) { console.error('[SPTV]', msg); this.showToast(msg, 'danger'); }
    showInfo(msg) { console.log('[SPTV]', msg); this.showToast(msg, 'info'); }
    showWarning(msg) { console.warn('[SPTV]', msg); this.showToast(msg, 'warning'); }
    showSuccess(msg) { this.showToast(msg, 'success'); }
}

export const notifications = new NotificationManager();