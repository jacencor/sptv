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

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('#EXTINF:')) {
            const lastCommaIndex = line.lastIndexOf(',');
            const name = lastCommaIndex !== -1 ? line.substring(lastCommaIndex + 1).trim() : 'Canal Desconocido';
            
            const logoMatch = line.match(/tvg-logo="([^"]+)"/);
            
            current = {
                name: name,
                img: logoMatch ? logoMatch[1] : 'img/app/error.png',
                source: ''
            };
        }
        // Ignoramos directivas de VLC u otras metadatos
        else if (line && !line.startsWith('#') && current) {
            current.source = line;
            channels.push(current);
            current = null;
        }
    }
    
    console.log('[SPTV]', `${channels.length} canales limpios cargados`);
    return channels;
}