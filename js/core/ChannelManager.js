// @ts-check

/**
 * @typedef {Object} Channel
 * @property {string} name   - Nombre visible del canal
 * @property {string} source - URL del stream HLS (.m3u8)
 * @property {string} [img]  - URL del logo/thumbnail
 * @property {string} [group] - Grupo/categoría del canal (group-title en M3U)
 */

/**
 * Descarga y parsea una lista M3U usando Stale-While-Revalidate (Caché API).
 * @param {string} url
 * @returns {Promise<Channel[]>}
 */
export async function loadChannels(url) {
    const cacheName = 'sptv-m3u-v1';
    try {
        const cache = await caches.open(cacheName);
        let response = await cache.match(url);
        
        // Background fetch para actualizar la caché sin bloquear el inicio
        const fetchPromise = fetch(url, { cache: 'no-cache' }).then(async (netResponse) => {
            if (netResponse.ok) {
                await cache.put(url, netResponse.clone());
                return netResponse;
            }
            throw new Error('Network response was not ok');
        }).catch(/** @param {Error} err */ err => {
            console.warn('[SPTV]', 'Aviso: No se pudo actualizar M3U en background', err);
            return undefined;
        });

        // Si no hay respuesta en caché, esperamos la de la red
        if (!response) {
            response = await fetchPromise;
        }
        
        if (response) {
            const m3uText = await response.text();
            return parseM3U(m3uText);
        }
    } catch (error) {
        console.error('[SPTV]', 'Error procesando la lista M3U', error);
    }
    return [];
}

/**
 * Parsea un archivo M3U sin crear arrays masivos en memoria.
 * @param {string} content - Texto completo del archivo M3U
 * @returns {Channel[]}
 */
export function parseM3U(content) {
    /** @type {Channel[]} */
    const channels = [];
    /** @type {Omit<Channel, 'source'> | null} */
    let current = null;

    let cursor = 0;
    while (cursor < content.length) {
        let nextNewline = content.indexOf('\n', cursor);
        if (nextNewline === -1) nextNewline = content.length;
        
        let line = content.substring(cursor, nextNewline).trim();
        cursor = nextNewline + 1;
        
        if (!line) continue;
        
        if (line.startsWith('#EXTINF:')) {
            const logoMatch = line.match(/tvg-logo="([^"]+)"/);
            const groupMatch = line.match(/group-title="([^"]+)"/);
            
            let name = 'Canal';
            const commaIdx = line.lastIndexOf(',');
            if (commaIdx !== -1) {
                name = line.substring(commaIdx + 1).trim();
            }

            current = {
                name,
                img: logoMatch ? logoMatch[1] : 'img/app/error.png',
                group: groupMatch ? groupMatch[1] : undefined,
            };
        } else if (!line.startsWith('#') && current) {
            channels.push({ ...current, source: line });
            current = null;
        }
    }

    console.log('[SPTV]', `${channels.length} canales cargados (Optimizado)`);
    return channels;
}