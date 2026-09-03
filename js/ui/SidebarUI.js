// @ts-check

/** @import { Channel } from '../core/ChannelManager.js' */

export class SidebarUI {
    /**
     * @param {(index: number) => void} onChannelSelect
     * Callback invocado cuando el usuario selecciona un canal de la lista.
     */
    constructor(onChannelSelect) {
        /** @type {HTMLElement | null} */
        this.container = document.getElementById('channels-group');

        /** @type {(index: number) => void} */
        this.onChannelSelect = onChannelSelect;

        const offcanvasElement = document.getElementById('sidebarChannels');

        /** @type {{ show(): void; hide(): void; } | null} */
        this.offcanvasInstance = offcanvasElement ? new bootstrap.Offcanvas(offcanvasElement) : null;

        if (offcanvasElement) {
            offcanvasElement.addEventListener('shown.bs.offcanvas', () => this.focusActiveChannel());
        }

        if (this.container) {
            // Delegación de click: un solo listener para todos los botones de canal
            this.container.addEventListener('click', (e) => {
                const btn = /** @type {HTMLElement | null} */ (/** @type {Element} */ (e.target).closest('button.list-group-item'));
                if (!btn) return;
                const idx = parseInt(btn.dataset.index ?? '', 10);
                if (!isNaN(idx)) {
                    this.onChannelSelect(idx);
                    this.close();
                }
            });

            // Navegación por teclado dentro del sidebar (Smart TV / accesibilidad)
            this.container.addEventListener('keydown', (e) => {
                const activeEl = /** @type {HTMLElement} */ (document.activeElement);
                if (!activeEl || activeEl.tagName !== 'BUTTON') return;

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = /** @type {HTMLElement | null} */ (activeEl.nextElementSibling);
                    if (next) { next.focus(); next.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = /** @type {HTMLElement | null} */ (activeEl.previousElementSibling);
                    if (prev) { prev.focus(); prev.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
                } else if (['ArrowRight', 'Backspace'].includes(e.key) || e.keyCode === 461 || e.keyCode === 10009) {
                    // 461 = Back en LG webOS | 10009 = Return en Samsung Tizen
                    e.preventDefault();
                    this.close();
                }
            });
        }
    }

    /**
     * Renderiza la lista de canales en el sidebar, marcando el canal activo.
     * @param {Channel[]} channels
     * @param {number} currentIndex - Índice del canal actualmente en reproducción
     * @returns {void}
     */
    render(channels, currentIndex) {
        if (!this.container) return;

        this.container.innerHTML = channels.map((channel, idx) => {
            const imgSrc = (channel.img && channel.img !== 'img/app/error.png') ? channel.img : '';
            const imgHTML = imgSrc
                ? `<img src="${imgSrc}" alt="${channel.name}" class="channel-thumb" referrerpolicy="no-referrer" onerror="this.classList.add('d-none')">`
                : '';
            const activeClass = (idx === currentIndex) ? 'channel-active' : '';

            return `<button class="list-group-item list-group-item-action d-flex align-items-center gap-3 border-0 ${activeClass}" tabindex="0" data-index="${idx}">
                ${imgHTML}
                <span>${channel.name}</span>
            </button>`;
        }).join('');

        console.log('[SPTV]', `Sidebar: ${channels.length} canales`);
    }

    /**
     * Mueve el foco al botón del canal activo (o al primero si no hay ninguno marcado).
     * Se llama automáticamente cuando el offcanvas termina de abrirse.
     * @returns {void}
     */
    focusActiveChannel() {
        const activeBtn = /** @type {HTMLElement | null} */ (
            this.container?.querySelector('.channel-active') ?? this.container?.querySelector('button')
        );
        if (activeBtn) {
            activeBtn.focus();
            activeBtn.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }

    /** @returns {void} */
    open() { if (this.offcanvasInstance) this.offcanvasInstance.show(); }

    /** @returns {void} */
    close() { if (this.offcanvasInstance) this.offcanvasInstance.hide(); }
}