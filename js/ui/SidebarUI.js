// @ts-check

/** @import { Channel } from '../core/ChannelManager.js' */

export class SidebarUI {
    /**
     * @param {(index: number) => void} onChannelSelect
     * Callback invocado cuando el usuario selecciona un canal de la lista.
     */
    constructor(onChannelSelect) {
        /** @type {HTMLElement | null} */
        this.scrollContainer = document.querySelector('.offcanvas-body');
        
        /** @type {HTMLElement | null} */
        this.container = document.getElementById('channels-group');
        
        /** @type {(index: number) => void} */
        this.onChannelSelect = onChannelSelect;
        
        /** @type {Channel[]} */
        this.channels = [];
        
        this.currentIndex = -1;
        this.itemHeight = 56; // Altura fija aproximada para Virtual Scrolling
        this.visibleCount = 25;
        this.lastRenderedStart = -1;

        const offcanvasElement = document.getElementById('sidebarChannels');

        /** @type {{ show(): void; hide(): void; } | null} */
        this.offcanvasInstance = offcanvasElement ? new bootstrap.Offcanvas(offcanvasElement) : null;

        if (offcanvasElement) {
            offcanvasElement.addEventListener('shown.bs.offcanvas', () => this.focusActiveChannel());
        }

        if (this.scrollContainer && this.container) {
            this.container.style.position = 'relative';
            this.container.setAttribute('role', 'listbox');

            // Optimización: Virtual Scrolling
            this.scrollContainer.addEventListener('scroll', () => {
                this._renderChunk();
            }, { passive: true });

            // Delegación de click
            this.container.addEventListener('click', /** @param {MouseEvent} e */ (e) => {
                const btn = /** @type {HTMLElement | null} */ (/** @type {Element} */ (e.target).closest('button.list-group-item'));
                if (!btn) return;
                const idx = parseInt(btn.dataset.index ?? '', 10);
                if (!isNaN(idx)) {
                    this.onChannelSelect(idx);
                    this.close();
                }
            });

            // Navegación por teclado (Smart TV / Accesibilidad - Roving Tabindex pattern)
            this.container.addEventListener('keydown', /** @param {KeyboardEvent} e */ (e) => {
                const activeEl = /** @type {HTMLElement} */ (document.activeElement);
                if (!activeEl || activeEl.tagName !== 'BUTTON') return;

                const currentIdx = parseInt(activeEl.dataset.index ?? '', 10);

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this._focusIndex(currentIdx + 1);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this._focusIndex(currentIdx - 1);
                } else if (['ArrowRight', 'Backspace'].includes(e.key) || e.keyCode === 461 || e.keyCode === 10009) {
                    // 461 = Back en LG webOS | 10009 = Return en Samsung Tizen
                    e.preventDefault();
                    this.close();
                }
            });
        }
    }

    /**
     * @param {number} index
     */
    _focusIndex(index) {
        if (index < 0 || index >= this.channels.length || !this.scrollContainer || !this.container) return;
        
        const top = index * this.itemHeight;
        if (top < this.scrollContainer.scrollTop || top > this.scrollContainer.scrollTop + this.scrollContainer.clientHeight - this.itemHeight) {
             this.scrollContainer.scrollTop = top - (this.scrollContainer.clientHeight / 2);
        }
        
        // Esperar el re-render por scroll
        setTimeout(() => {
            const btn = /** @type {HTMLElement | null} */ (this.container?.querySelector(`button[data-index="${index}"]`));
            if (btn) btn.focus();
        }, 10);
    }

    /**
     * Renderiza o actualiza la lista de canales.
     * @param {Channel[]} channels
     * @param {number} currentIndex
     * @returns {void}
     */
    render(channels, currentIndex) {
        const isInitial = this.channels !== channels;
        this.channels = channels;
        this.currentIndex = currentIndex;

        if (!this.container) return;

        if (isInitial) {
            this.container.style.height = `${this.channels.length * this.itemHeight}px`;
            this.lastRenderedStart = -1; 
            this._renderChunk();
        } else {
            this._updateActiveClass();
        }
    }

    /** @returns {void} */
    _renderChunk() {
        if (!this.scrollContainer || !this.container) return;
        
        const scrollTop = this.scrollContainer.scrollTop;
        const startNode = Math.max(0, Math.floor(scrollTop / this.itemHeight) - 5);
        
        if (Math.abs(this.lastRenderedStart - startNode) < 3 && this.lastRenderedStart !== -1) {
            return; // Prevenir re-renders innecesarios
        }

        this.lastRenderedStart = startNode;
        const endNode = Math.min(this.channels.length, startNode + this.visibleCount + 10);

        let html = '';
        for (let i = startNode; i < endNode; i++) {
            const channel = this.channels[i];
            
            // XSS Prevention
            const escapeHTML = (/** @type {string} */ str) => str.replace(/[&<>'"]/g, tag => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
            }[tag] || tag));

            const safeName = escapeHTML(channel.name);
            const safeImg = escapeHTML((channel.img && channel.img !== 'img/app/error.png') ? channel.img : '');
            
            const imgHTML = safeImg
                ? `<img src="${safeImg}" loading="lazy" alt="" class="channel-thumb rounded" referrerpolicy="no-referrer" onerror="this.classList.add('d-none')">`
                : `<div class="channel-thumb rounded bg-secondary d-flex justify-content-center align-items-center text-light"><i class="fas fa-tv"></i></div>`;
            
            const isActive = (i === this.currentIndex);
            const activeClass = isActive ? 'channel-active' : '';
            const ariaSelected = isActive ? 'aria-selected="true"' : 'aria-selected="false"';
            const tabIndex = isActive ? '0' : '-1';

            html += `<button role="option" ${ariaSelected} class="list-group-item list-group-item-action d-flex align-items-center gap-3 border-0 ${activeClass}" tabindex="${tabIndex}" data-index="${i}" style="position: absolute; top: ${i * this.itemHeight}px; width: 100%; height: ${this.itemHeight}px; outline-offset: -2px;">
                ${imgHTML}
                <span class="text-truncate fw-medium">${safeName}</span>
            </button>`;
        }
        
        this.container.innerHTML = html;
        this._updateActiveClass();
    }

    /** @returns {void} */
    _updateActiveClass() {
        if (!this.container) return;
        const currentActive = this.container.querySelector('.channel-active');
        if (currentActive) {
            currentActive.classList.remove('channel-active');
            currentActive.setAttribute('aria-selected', 'false');
            currentActive.setAttribute('tabindex', '-1');
        }

        const newActive = this.container.querySelector(`button[data-index="${this.currentIndex}"]`);
        if (newActive) {
            newActive.classList.add('channel-active');
            newActive.setAttribute('aria-selected', 'true');
            newActive.setAttribute('tabindex', '0');
        }
    }

    /**
     * Mueve el foco al botón del canal activo (o al primero).
     * @returns {void}
     */
    focusActiveChannel() {
        if (!this.scrollContainer) return;
        const top = this.currentIndex * this.itemHeight;
        this.scrollContainer.scrollTop = Math.max(0, top - (this.scrollContainer.clientHeight / 2) + (this.itemHeight / 2));
        
        setTimeout(() => {
            const activeBtn = /** @type {HTMLElement | null} */ (
                this.container?.querySelector('.channel-active') ?? this.container?.querySelector('button')
            );
            if (activeBtn) {
                activeBtn.focus();
            }
        }, 50);
    }

    /** @returns {void} */
    open() { if (this.offcanvasInstance) this.offcanvasInstance.show(); }

    /** @returns {void} */
    close() { if (this.offcanvasInstance) this.offcanvasInstance.hide(); }
}