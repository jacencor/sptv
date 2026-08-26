export class SidebarUI {
    constructor(onChannelSelect) {
        this.container = document.getElementById('channels-group');
        this.onChannelSelect = onChannelSelect;
        
        const offcanvasElement = document.getElementById('sidebarChannels');
        this.offcanvasInstance = offcanvasElement ? new bootstrap.Offcanvas(offcanvasElement) : null;
        if (offcanvasElement) offcanvasElement.addEventListener('shown.bs.offcanvas', () => this.focusActiveChannel());

        if (this.container) {
            // Event delegation para clicks
            this.container.addEventListener('click', (e) => {
                const btn = e.target.closest('button.list-group-item');
                if (!btn) return;
                const idx = parseInt(btn.dataset.index, 10);
                if (!isNaN(idx)) {
                    this.onChannelSelect(idx);
                    this.close();
                }
            });

            this.container.addEventListener('keydown', (e) => {
                const activeEl = document.activeElement;
                if (!activeEl || activeEl.tagName !== 'BUTTON') return;

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    var next = activeEl.nextElementSibling;
                    if (next) { next.focus(); next.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    var prev = activeEl.previousElementSibling;
                    if (prev) { prev.focus(); prev.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
                } else if (['ArrowRight', 'Backspace'].includes(e.key) || e.keyCode === 461 || e.keyCode === 10009) {
                    e.preventDefault();
                    this.close();
                }
            });
        }
    }

    render(channels, currentIndex) {
        if (!this.container) return;
        
        this.container.innerHTML = channels.map((channel, idx) => {
            const imgSrc = (channel.img && channel.img !== 'img/app/error.png') ? channel.img : '';
            const imgHTML = imgSrc ? `<img src="${imgSrc}" alt="${channel.name}" class="channel-thumb" referrerpolicy="no-referrer" onerror="this.classList.add('d-none')">` : '';
            const activeClass = (idx === currentIndex) ? 'channel-active' : '';
            
            return `<button class="list-group-item list-group-item-action d-flex align-items-center gap-3 border-0 ${activeClass}" tabindex="0" data-index="${idx}">
                ${imgHTML}
                <span>${channel.name}</span>
            </button>`;
        }).join('');

        console.log('[SPTV]', `Sidebar: ${channels.length} canales`);
    }

    focusActiveChannel() {
        var activeBtn = (this.container ? this.container.querySelector('.channel-active') : null) || (this.container ? this.container.querySelector('button') : null);
        if (activeBtn) {
            activeBtn.focus();
            activeBtn.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }

    open() { if (this.offcanvasInstance) this.offcanvasInstance.show(); }
    close() { if (this.offcanvasInstance) this.offcanvasInstance.hide(); }
}