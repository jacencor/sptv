export class SidebarUI {
    constructor(onChannelSelect) {
        this.container = document.getElementById('channels-group');
        this.onChannelSelect = onChannelSelect;
        const offcanvasElement = document.getElementById('sidebarChannels');

        if (offcanvasElement) {
            this.offcanvasInstance = new bootstrap.Offcanvas(offcanvasElement);
        } else {
            console.warn('[SPTV]', 'Offcanvas element or Bootstrap not found');
        }
    }

    render(channels, currentIndex) {
        if (!this.container) return;
        this.container.innerHTML = '';

        channels.forEach((channel, idx) => {
            const btn = document.createElement('button');
            btn.className = 'list-group-item list-group-item-action d-flex align-items-center gap-3 border-0';

            // Agregar imagen si existe y no es externa problemática
            if (channel.img && channel.img !== 'img/app/error.png') {
                const img = document.createElement('img');
                img.src = channel.img;
                img.alt = channel.name;
                img.className = 'channel-thumb';

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
            }

            btn.addEventListener('click', () => {
                this.onChannelSelect(idx);
                this.close();
            });

            this.container.appendChild(btn);
        });

        console.log('[SPTV]', `Sidebar: ${channels.length} canales`);
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