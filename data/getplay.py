#!/usr/bin/env python3
"""
IPTV Filter - Versión PRECISA con listas explícitas
"""

import urllib.request
import ssl
import re

# ============================================================
# LISTAS EXPLÍCITAS DE CANALES (NO REGEX)
# ============================================================

# 1. CANALES DE PELÍCULAS (EXPLÍCITOS)
CINE_CHANNELS = [
    "Cinecanal",
    "Cine Sony",
    "De Película",
    "De Película Plus",
    "HBO",
    "HBO 2",
    "HBO Plus",
    "HBO Family",
    "HBO Signature",
    "TCM",
    "FXM",
    "AMC",
    "Cinemax",
    "Studio Universal",
    "Film & Arts",
    "FilmZone",
    "Sony Movies",
    "Warner TV",
    "TNT Películas",
    "Space",
    "I.Sat",
    "Golden Premier",
    "Filmex",
    "Filmex Clásico",
    "Cine Adrenalina",
    "Cine Terror",
    "Cine XOXO",
    "Cine Clásico",
    "Cine Premiere",
    "Anime Vision",
    "Anime Vision Classics"
]

# 2. CANALES DE SERIES (EXPLÍCITOS)
SERIES_CHANNELS = [
    "Atreseries",
    "FOX",
    "FOX Life",
    "FX",
    "AXN",
    "AXN White",
    "AXN Movies",
    "Warner TV",
    "TNT Series",
    "Syfy",
    "Universal TV",
    "E!",
    "Studio Universal",
    "Space",
    "I.Sat",
    "TBS",
    "USA Network",
    "TLC",
    "Discovery Channel",
    "Investigation Discovery",
    "Distrito Comedia",
    "Comedy Central",
    "13 Teleseries",
    "13 Realities",
    "bitMe",
    "Afizzionados",
    "AFV en Español",
]

# 3. PLATAFORMAS ABIERTAS / FAST CHANNELS
FAST_CHANNELS = [
    "Pluto TV",
    "Tubi",
    "Xumo",
    "Roku Channel",
    "Samsung TV Plus",
    "Freevee",
    "Plex",
    "Stirr",
    "Peacock Free",
    "The Roku Channel",
    "Samsung TV Plus",
    "Red Bull TV",
    "Bloomberg Quicktake",
    "Newsy",
    "Classic Movies",
    "Retro Crush",
    "FilmRise",
    "FailArmy",
    "People Are Awesome",
    "WeatherNation",
    "CBN Español",
    "Estrella TV",
    "Estrella News",
    "Estrella Games",
    "BabyFirst",
    "BabyFirst Spanish",
]

# 4. CANALES DE ENTRETENIMIENTO GENERAL (PRINCIPALES SOLO)
ENTERTAINMENT_CHANNELS = [
    # ESPAÑA
    "Antena 3",
    "Telecinco",
    "La Sexta",
    "Cuatro",
    "Divinity",
    # MÉXICO
    "Las Estrellas (1080p)",
    "Azteca Internacional (1080p)",
    "ADN 40 (720p)",
    # ARGENTINA
    "America TV",
    "El Trece",
    "Canal 7 Santiago del Estero",
    # CHILE
    "Mega",
    "Chilevisión",
    "Canal 13 (1080p)",
    "TVN",
    "ChileVision"
    "La Red",
    # PERÚ
    "América TV",
    "Panamericana",
    "Latina",
    "TV Perú",
    # REPÚBLICA DOMINICANA
    "Telemicro",
    "Color Visión",
    "Telesistema",
    "Antena 7",
    "CDN",
]

# 5. CANALES INTERNACIONALES
INTERNATIONAL_CHANNELS = [
    "CGTN Español",
    "DW Español",
    "DW Espanol"
    "France 24 Español",
    "Euronews Spanish",
    "BBC World News",
    "CNN International",
    "RT en Español",
    "NHK World",
    "TV5Monde",
    "RAI Italia",
    "TVE Internacional",
    "Cubavisión Internacional",
    "TV Pública",
]

# 6. TOP 10 RECOMENDADOS (LO MEJOR DE LO MEJOR)
TOP_CHANNELS = [
    "Cinecanal",
    "Atreseries",
    "HBO",
    "FOX",
    "Antena 3",
    "Caracol TV",
    "Telefe",
    "Azteca Uno",
    "CGTN Español",
    "Pluto TV Cine Clásico",
]

# ============================================================
# FUNCIÓN PRINCIPAL
# ============================================================


def download_and_filter():
    """Descarga y filtra la lista IPTV"""

    print("=" * 70)
    print("IPTV FILTER - VERSIÓN PRECISA (LISTAS EXPLÍCITAS)")
    print("=" * 70)

    # Configurar SSL
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    # Descargar lista
    print("\n📥 Descargando lista IPTV...")
    url = "https://iptv-org.github.io/iptv/languages/spa.m3u"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=30) as response:
            content = response.read().decode("utf-8")
    except Exception as e:
        print(f"❌ Error al descargar: {e}")
        return

    print(f"✅ Descargado: {len(content):,} caracteres")

    # Parsear
    print("\n🔍 Parseando y filtrando canales...")

    lines = content.split("\n")

    # Diccionario para almacenar canales por categoría
    categorized = {
        "🎬 CANALES DE PELÍCULAS": [],
        "📺 CANALES DE SERIES": [],
        "📡 PLATAFORMAS ABIERTAS / FAST CHANNELS": [],
        "📢 CANALES DE ENTRETENIMIENTO GENERAL": [],
        "🌐 CANALES INTERNACIONALES": [],
        "⭐ TOP 10 RECOMENDADOS": [],
    }

    current_extinf = ""

    for line in lines:
        line = line.strip()

        if line.startswith("#EXTINF:"):
            current_extinf = line
        elif line and not line.startswith("#") and current_extinf:
            # Extraer nombre del canal
            if "," in current_extinf:
                raw_name = current_extinf.split(",")[-1].strip()

                # Limpiar nombre
                name = clean_channel_name(raw_name)

                # Buscar en listas EXPLÍCITAS
                found = False

                # 1. TOP 10 primero
                for top in TOP_CHANNELS:
                    if matches_channel(name, top):
                        categorized["⭐ TOP 10 RECOMENDADOS"].append(
                            (name, current_extinf, line)
                        )
                        found = True
                        break

                if not found:
                    # 2. Cine
                    for cine in CINE_CHANNELS:
                        if matches_channel(name, cine):
                            categorized["🎬 CANALES DE PELÍCULAS"].append(
                                (name, current_extinf, line)
                            )
                            found = True
                            break

                if not found:
                    # 3. Series
                    for series in SERIES_CHANNELS:
                        if matches_channel(name, series):
                            categorized["📺 CANALES DE SERIES"].append(
                                (name, current_extinf, line)
                            )
                            found = True
                            break

                if not found:
                    found = False
                    # 4. Fast channels
                    # for fast in FAST_CHANNELS:
                    #    if matches_channel(name, fast):
                    #        categorized[
                    #            "📡 PLATAFORMAS ABIERTAS / FAST CHANNELS"
                    #        ].append((name, current_extinf, line))
                    #        found = True
                    #        break

                if not found:
                    found = False
                    # 5. Entretenimiento
                    for ent in ENTERTAINMENT_CHANNELS:
                        if matches_channel(name, ent):
                            categorized["📢 CANALES DE ENTRETENIMIENTO GENERAL"].append(
                                (name, current_extinf, line)
                            )
                            found = True
                            break

                if not found:
                    # 6. Internacionales
                    for intl in INTERNATIONAL_CHANNELS:
                        if matches_channel(name, intl):
                            categorized["🌐 CANALES INTERNACIONALES"].append(
                                (name, current_extinf, line)
                            )
                            found = True
                            break

            current_extinf = ""

    # Generar archivo M3U
    print("\n💾 Generando archivo M3U...")

    output_lines = [
        "#EXTM3U",
        "# =========================================================",
        "# CANALES IPTV FILTRADOS - VERSIÓN PRECISA",
        "# Listas explícitas, sin regex ambiguas",
        "# =========================================================",
        "",
    ]

    total_channels = 0

    for category, channels in categorized.items():
        if channels:
            # Ordenar alfabéticamente
            channels.sort(key=lambda x: x[0].lower())

            # Agregar sección
            output_lines.extend([f"# {category}", "#" + "=" * 60, ""])

            # Agregar canales
            for name, extinf, url in channels:
                output_lines.extend([extinf, url])
                total_channels += 1

            output_lines.append("")

    # Guardar archivo
    output_content = "\n".join(output_lines)

    with open("precise_iptv.m3u", "w", encoding="utf-8") as f:
        f.write(output_content)

    # Mostrar estadísticas
    print("\n" + "=" * 70)
    print("✅ ¡LISTA GENERADA EXITOSAMENTE!")
    print("=" * 70)
    print(f"\n📊 ESTADÍSTICAS:")
    print(f"   Archivo: precise_iptv.m3u")
    print(f"   Canales totales: {total_channels}")
    print(f"\n📋 DESGLOSE POR CATEGORÍA:")

    for category, channels in categorized.items():
        if channels:
            print(f"\n   {category}: {len(channels)} canales")
            print("   " + "-" * 40)

            # Mostrar primeros 5 canales
            for i, (name, _, _) in enumerate(channels[:5]):
                print(f"   {i+1:2d}. {name[:45]}")

            if len(channels) > 5:
                print(f"   ... y {len(channels)-5} más")

    print("\n" + "=" * 70)
    print("🎯 Canales PRECISOS, sin falsos positivos")
    print("=" * 70)


def clean_channel_name(name):
    """Limpia el nombre del canal"""
    # Remover resoluciones
    name = re.sub(r"\(\d+p\)", "", name)
    name = re.sub(r"\d{3,4}p", "", name)

    # Remover notas
    name = re.sub(r"\[Not 24/7\]", "", name)
    name = re.sub(r"\[Geo-blocked\]", "", name)
    name = re.sub(r"\[.*?\]", "", name)

    # Remover user-agent strings
    name = re.sub(r'http-user-agent="[^"]+"', "", name)
    name = re.sub(r"#EXTVLCOPT.*?,\s*", "", name)
    name = re.sub(r"Mozilla/.*$", "", name)

    # Limpiar espacios
    name = re.sub(r"\s+", " ", name)
    name = name.strip(' ,"')

    return name


def matches_channel(channel_name, target_name):
    """
    Compara si un canal coincide con un nombre objetivo.
    Más inteligente que un simple 'in'.
    """
    channel_lower = channel_name.lower()
    target_lower = target_name.lower()

    # 1. Coincidencia exacta (sin espacios adicionales)
    if target_lower == channel_lower:
        return True

    # 2. El nombre objetivo está contenido en el nombre del canal
    # pero no como parte de otra palabra
    if target_lower in channel_lower:
        # Verificar que no sea parte de otra palabra
        pattern = rf"\b{re.escape(target_lower)}\b"
        if re.search(pattern, channel_lower):
            return True

    # 3. Para nombres cortos, verificar al inicio
    if len(target_name) <= 10:
        if channel_lower.startswith(target_lower):
            return True

    return False


# ============================================================
# EJECUCIÓN
# ============================================================

if __name__ == "__main__":
    download_and_filter()
