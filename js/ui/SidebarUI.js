export class SidebarUI {
    constructor(onChannelSelect) {
        this.container = document.getElementById('channels-group');
        this.onChannelSelect = onChannelSelect;
        this.activeBtn = null;
        const offcanvasElement = document.getElementById('sidebarChannels');

        if (offcanvasElement) {
            this.offcanvasInstance = new bootstrap.Offcanvas(offcanvasElement);
            
            // Enfocar canal activo cuando se abre el menú (fundamental para Smart TV)
            offcanvasElement.addEventListener('shown.bs.offcanvas', () => {
                this.focusActiveChannel();
            });
        } else {
            console.warn('[SPTV]', 'Offcanvas element or Bootstrap not found');
        }

        // Navegación por teclado/D-pad dentro del contenedor de canales
        if (this.container) {
            this.container.addEventListener('keydown', (e) => {
                const activeEl = document.activeElement;
                if (!activeEl || activeEl.tagName !== 'BUTTON') return;

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = activeEl.nextElementSibling;
                    if (next) {
                        next.focus();
                        next.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = activeEl.previousElementSibling;
                    if (prev) {
                        prev.focus();
                        prev.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    }
                } else if (
                    e.key === 'ArrowRight' || 
                    e.key === 'Escape' || 
                    e.key === 'Backspace' || 
                    e.keyCode === 461 || // LG webOS Back
                    e.keyCode === 10009  // Samsung Tizen Back
                ) {
                    e.preventDefault();
                    this.close();
                    // Devolver el foco al botón de abrir
                    const openBtn = document.getElementById('openSidebar');
                    if (openBtn) openBtn.focus();
                }
            });
        }
    }

    render(channels, currentIndex) {
        if (!this.container) return;
        this.container.innerHTML = '';
        this.activeBtn = null;

        channels.forEach((channel, idx) => {
            const btn = document.createElement('button');
            btn.className = 'list-group-item list-group-item-action d-flex align-items-center gap-3 border-0';
            btn.setAttribute('tabindex', '0');

            // Agregar imagen si existe y no es externa problemática
            if (channel.img && channel.img !== 'img/app/error.png') {
                const img = document.createElement('img');
                img.src = channel.img;
                img.alt = channel.name;
                img.className = 'channel-thumb';
                img.referrerPolicy = 'no-referrer';

                // Manejar errores de carga de imagen
                img.onerror = () => {
                    img.classList.add('d-none');
                };

                btn.appendChild(img);
            }

            const span = document.createElement('span');
            span.textContent = channel.name;
            btn.appendChild(span);

            if (idx === currentIndex) {
                btn.classList.add('channel-active');
                this.activeBtn = btn;
            }

            btn.addEventListener('click', () => {
                this.onChannelSelect(idx);
                this.close();
            });

            this.container.appendChild(btn);
        });

        console.log('[SPTV]', `Sidebar: ${channels.length} canales`);
    }

    focusActiveChannel() {
        if (this.activeBtn) {
            this.activeBtn.focus();
            this.activeBtn.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } else {
            const firstBtn = this.container?.querySelector('button');
            if (firstBtn) firstBtn.focus();
        }
    }

    open() {
        if (this.offcanvasInstance) {
            this.offcanvasInstance.show();
        } else {
            console.warn('[SPTV]', 'Offcanvas instancia no disponible');
        }
    }

    close() {
        if (this.offcanvasInstance) {
            this.offcanvasInstance.hide();
        }
    }
}