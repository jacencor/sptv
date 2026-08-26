export async function loadChannels(url) {
    try {
        const response = await fetch(url, { cache: 'no-cache' });
        const m3uText = await response.text();
        return parseM3U(m3uText);
    } catch (error) {
        console.error('[SPTV]', 'Error descargando la lista M3U', error);
        return [];
    }
}

export function parseM3U(content) {
    const lines = content.split(/\r?\n/);
    const channels = [];
    let current = null;

    for (const line of lines) {
        const tLine = line.trim();
        if (tLine.startsWith('#EXTINF:')) {
            const [, logo] = tLine.match(/tvg-logo="([^"]+)"/) || [];
            current = { name: tLine.split(',').pop().trim() || 'Canal', img: logo || 'img/app/error.png' };
        } else if (tLine && !tLine.startsWith('#') && current) {
            channels.push({ ...current, source: tLine });
            current = null;
        }
    }

    console.log('[SPTV]', `${channels.length} canales limpios cargados`);
    return channels;
}