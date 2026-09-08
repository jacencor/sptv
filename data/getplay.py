#!/usr/bin/env python3
"""
IPTV Filter - Para archivo spa.txt
Filtra por tvg-id, omite EXTVLCOPT, Geo-blocked y URLs con IP
"""
import urllib.request
import re
import os

# ============================================================
# LISTA DE tvg-id DE LOS MEJORES CANALES (según recomendación)
# ============================================================

# Canales de Latinoamérica + Europa (los 50 mejores)
MEJORES_TVG_IDS = [
    # ARGENTINA
    "AmericaTV.ar",
    "ElTrece.ar",
    "Canal7TV.ar",
    "Telefe.ar",
    
    # CHILE
    "Canal13.cl",
    "ChileVision.cl",
    "TVN.cl",
    "LaRed.cl",
    "Mega.cl",
    "EnerGeek.cl",
    
    # COLOMBIA
    "RCNMas.co",
    "RCNNovelas.co",
    
    # MÉXICO
    "LasEstrellas.mx",
    "AztecaUno.mx",
    "Azteca7.mx",
    "ADN40.mx",
    "Canal22Nacional.mx",
    "MultimediosMonterrey.mx",
    "AztecaInternacional.mx",
    "TUDN.mx",
    
    # PERÚ
    "Latina.pe",
    "ATV.pe",
    "TVPeru.pe",
    
    # ECUADOR
    "Ecuavisa.ec",
    "Teleamazonas.ec",
    "RTS.ec",
    
    # BOLIVIA
    "BoliviaTV.bo",
    "RedUnoSantaCruz.bo",
    "UnitelSantaCruz.bo",
    
    # PARAGUAY
    "ParaguayTV.py",
    "Telefuturo.py",
    "Latele.py",
    "SNT.py",
    "Unicanal.py",
    
    # REPÚBLICA DOMINICANA
    "Telesistema11.do",
    "Telemicro.do",
    "ColorVision.do",
    "CDN.do",
    
    # VENEZUELA
    "Venevision.ve",
    "VenevisionInternacional.ve",
    
    # ESPAÑA (los mejores)
    "Antena3.es",
    "Telecinco.es",
    "LaSexta.es",
    "Cuatro.es",
    "La1.es",
    "Canal24Horas.es",
    "TV3.es",
    "CanalSurAndalucia.es",
    "AragonTV.es",
    "Telemadrid.es",
    
    # PELÍCULAS Y SERIES (de tu lista)
    "BomCine.es",
    "CineSony.us",
    "DePelicula.mx",
    "Filmex.mx",
    "AMCenEspanol.us",
    "Atrescine.es",
    "Atreseries.es",
    "Energy.es",
    "Nova.es",
    "FDF.es",
    "Neox.es",
    "13Teleseries.cl",
    "13Humor.cl",
    "13Realities.cl",
    "AnimeVision.es",
    "AnimeVisionClassics.es",
    "EnerGeek.cl",
    "Kanade.cl",
    "XtremaAccion.ar",
    "XtremaTerror.ar",
    "XtremaCineClasico.ar",
    
    # INTERNACIONALES
    "CGTNEspanol.cn",
    "DWEspanol.de",
    "France24Espanol.fr",
    "RTEspanol.ru",
    "TVEInternacionalAmerica.es",
]



def limpiar_tvg_id(tvg_id_raw):
    """
    Limpia el tvg-id eliminando sufijos como @SD, @HD, @National, etc.
    Ejemplos:
        "AnimeVision.es@SD" -> "AnimeVision.es"
        "Canal13.cl@National" -> "Canal13.cl"
        "Antena3.es@SD" -> "Antena3.es"
    """
    # Eliminar todo lo que empiece con @
    if "@" in tvg_id_raw:
        return tvg_id_raw.split("@")[0]
    return tvg_id_raw

# Patrón para detectar URL con IP (ej: http://45.184.109.10/...)
IP_URL_PATTERN = r"https?://\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}"

# ============================================================
# FUNCIÓN PRINCIPAL
# ============================================================

def filtrar_lista(archivo_salida="mejores_canales.m3u"):
    """Filtra el archivo spa.txt y guarda solo los mejores canales"""
    
    print("=" * 70)
    print("FILTRANDO LISTA IPTV - MEJORES CANALES LATINOAMÉRICA + EUROPA")
    print("=" * 70)


    # Descargar lista
    print("\n📥 Descargando lista IPTV...")
    url = "https://iptv-org.github.io/iptv/languages/spa.m3u"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as response:
            content = response.read().decode("utf-8")
    except Exception as e:
        print(f"❌ Error al descargar: {e}")
        return

    print(f"✅ Descargado: {len(content):,} caracteres")

    # Parsear
    print("\n🔍 Parseando y filtrando canales...")

    lines = content.split("\n")
    print(f"📥 Archivo cargado: {len(lines)} líneas")
    
    # Diccionario para almacenar canales encontrados
    canales_encontrados = {}
    
    i = 0
    total_lines = len(lines)
    excluidos_geo = 0
    excluidos_extvlcopt = 0
    excluidos_ip = 0
    no_match = 0
    
    while i < total_lines:
        line = lines[i].strip()
        
        if line.startswith("#EXTINF"):
            extinf_line = line
            
            # Verificar Geo-blocked
            if "Geo-blocked" in extinf_line or "[Geo-blocked]" in extinf_line:
                excluidos_geo += 1
                i += 1
                continue
            
            # Buscar tvg-id (patrón original)
            tvg_id_match = re.search(r'tvg-id="([^"]+)"', extinf_line)
            
            if tvg_id_match:
                tvg_id_raw = tvg_id_match.group(1)
                tvg_id_limpio = limpiar_tvg_id(tvg_id_raw)
                
                if tvg_id_limpio in MEJORES_TVG_IDS:
                    
                    # Verificar EXTVLCOPT en líneas siguientes
                    tiene_extvlcopt = False
                    j = i + 1
                    while j < total_lines and not lines[j].strip().startswith("#EXTINF"):
                        if "#EXTVLCOPT" in lines[j]:
                            tiene_extvlcopt = True
                            excluidos_extvlcopt += 1
                            break
                        j += 1
                    
                    if tiene_extvlcopt:
                        i += 1
                        continue
                    
                    # Obtener URL
                    url_line = ""
                    k = i + 1
                    while k < total_lines:
                        next_line = lines[k].strip()
                        if next_line and not next_line.startswith("#"):
                            url_line = next_line
                            break
                        k += 1
                    
                    # Verificar URL con IP
                    if url_line and re.match(IP_URL_PATTERN, url_line):
                        excluidos_ip += 1
                        i += 1
                        continue
                    
                    # Guardar canal
                    if tvg_id_limpio not in canales_encontrados:
                        # Extraer nombre del canal (después de la última coma)
                        nombre = extinf_line.split(",")[-1].strip() if "," in extinf_line else tvg_id_limpio
                        # Limpiar etiquetas como [Not 24/7], [Geo-blocked], etc.
                        nombre = re.sub(r"\[.*?\]", "", nombre).strip()
                        # Limpiar resoluciones como (1080p)
                        nombre = re.sub(r"\(\d+p\)", "", nombre).strip()
                        
                        canales_encontrados[tvg_id_limpio] = {
                            "nombre": nombre,
                            "extinf": extinf_line,
                            "url": url_line,
                            "tvg_id_raw": tvg_id_raw
                        }
                        print(f"   ✅ {nombre} ({tvg_id_raw})")
                else:
                    no_match += 1
            else:
                # Línea EXTINF sin tvg-id
                pass
            
        i += 1
    
    # Generar archivo de salida
    print("\n" + "=" * 70)
    print("💾 Generando archivo de salida...")
    
    output_lines = ["#EXTM3U", "# ========================================================="]
    output_lines.append("# MEJORES CANALES - LATINOAMÉRICA + EUROPA")
    output_lines.append("# =========================================================")
    output_lines.append("")
    
    # Clasificar por país
    categorias = {
        "🇦🇷 Argentina": [],
        "🇨🇱 Chile": [],
        "🇨🇴 Colombia": [],
        "🇲🇽 México": [],
        "🇵🇪 Perú": [],
        "🇪🇨 Ecuador": [],
        "🇧🇴 Bolivia": [],
        "🇵🇾 Paraguay": [],
        "🇩🇴 República Dominicana": [],
        "🇻🇪 Venezuela": [],
        "🇪🇸 España": [],
        "🎬 Películas y Series": [],
        "🌐 Internacionales": [],
    }
    
    PAIS_MAP = {
        ".ar": "🇦🇷 Argentina", ".cl": "🇨🇱 Chile", ".co": "🇨🇴 Colombia",
        ".mx": "🇲🇽 México", ".pe": "🇵🇪 Perú", ".ec": "🇪🇨 Ecuador",
        ".bo": "🇧🇴 Bolivia", ".py": "🇵🇾 Paraguay", ".do": "🇩🇴 República Dominicana",
        ".ve": "🇻🇪 Venezuela", ".es": "🇪🇸 España"
    }
    
    for tvg_id, info in canales_encontrados.items():
        sufijo = "." + tvg_id.rsplit(".", 1)[-1] if "." in tvg_id else ""
        categoria = PAIS_MAP.get(sufijo, "🌐 Internacionales")
        categorias.setdefault(categoria, []).append(info)
    
    total_canales = 0
    for categoria, canales in categorias.items():
        if canales:
            output_lines.append(f"\n# ========== {categoria} ({len(canales)} canales) ==========")
            for canal in canales:
                output_lines.append(canal["extinf"])
                output_lines.append(canal["url"])
                total_canales += 1
    
    with open(archivo_salida, "w", encoding="utf-8") as f:
        f.write("\n".join(output_lines))
    
    # Estadísticas
    print("\n" + "=" * 70)
    print("✅ ¡FILTRADO COMPLETADO!")
    print("=" * 70)
    print(f"\n📊 ESTADÍSTICAS:")
    print(f"   Archivo de salida: {archivo_salida}")
    print(f"\n   ✅ Canales encontrados: {total_canales}")
    print(f"\n   🔻 Excluidos por Geo-blocked: {excluidos_geo}")
    print(f"   🔻 Excluidos por EXTVLCOPT: {excluidos_extvlcopt}")
    print(f"   🔻 Excluidos por URL con IP: {excluidos_ip}")
    print(f"   🔻 tvg-ids no encontrados en la lista blanca: {no_match}")
    
    print("\n📋 DESGLOSE:")
    for categoria, canales in categorias.items():
        if canales:
            print(f"\n   {categoria}: {len(canales)} canales")
            for c in canales[:3]:
                print(f"      - {c['nombre'][:50]}")
            if len(canales) > 3:
                print(f"      ... y {len(canales)-3} más")
    
    print("\n" + "=" * 70)
    print("🎯 CANALES FILTRADOS CON CRITERIOS EXACTOS")
    print("=" * 70)

# ============================================================
# EJECUCIÓN
# ============================================================

if __name__ == "__main__":
    filtrar_lista("mejores_canales.m3u")