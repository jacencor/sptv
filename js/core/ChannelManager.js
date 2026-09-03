// @ts-check

/**
 * @typedef {Object} Channel
 * @property {string} name   - Nombre visible del canal
 * @property {string} source - URL del stream HLS (.m3u8)
 * @property {string} [img]  - URL del logo/thumbnail
 * @property {string} [group] - Grupo/categoría del canal (group-title en M3U)
 */

/**
 * Descarga y parsea una lista M3U desde una URL.
 * @param {string} url
 * @returns {Promise<Channel[]>}
 */
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

/**
 * Parsea el contenido de texto de un archivo M3U y devuelve una lista de canales.
 * @param {string} content - Texto completo del archivo M3U
 * @returns {Channel[]}
 */
export function parseM3U(content) {
    const lines = content.split(/\r?\n/);
    /** @type {Channel[]} */
    const channels = [];
    /** @type {Omit<Channel, 'source'> | null} */
    let current = null;

    for (const line of lines) {
        const tLine = line.trim();
        if (tLine.startsWith('#EXTINF:')) {
            const [, logo] = tLine.match(/tvg-logo="([^"]+)"/) || [];
            const [, group] = tLine.match(/group-title="([^"]+)"/) || [];
            current = {
                name: tLine.split(',').pop()?.trim() || 'Canal',
                img: logo || 'img/app/error.png',
                group: group || undefined,
            };
        } else if (tLine && !tLine.startsWith('#') && current) {
            channels.push({ ...current, source: tLine });
            current = null;
        }
    }

    console.log('[SPTV]', `${channels.length} canales limpios cargados`);
    return channels;
}