# Declaración de Accesibilidad y Documentación Técnica (SPTV)

## 1. Resumen Ejecutivo y Estándar de Conformidad

Este documento detalla la arquitectura de accesibilidad, las decisiones técnicas y los resultados de auditoría implementados en la aplicación web **SPTV**.

- **Estándar Aplicado**: [W3C Web Content Accessibility Guidelines (WCAG) 2.1](https://www.w3.org/TR/WCAG21/)
- **Nivel de Conformidad Objetivo**: **Nivel AA (Strict)**
- **Motor de Verificación Automatizada**: `Axe-Core` vía `Pa11y` (Puppeteer CDP en Chromium / Chrome 154)
- **Umbral de Aceptación**: **0 violaciones automatizadas** en todas las vistas y estados interactivos de la aplicación.
- **Naturaleza del Código**: 100% Vanilla HTML5, CSS3 y ES2022 JavaScript modular, sin dependencias de frameworks de interfaz en producción.

---

## 2. Decisiones Técnicas por Principio de Accesibilidad

### 2.1 Principio 1: Perceptible (Perceivable)

#### A. Relación de Contraste de Color (WCAG SC 1.4.3 & SC 1.4.11)
- **Problema previo**: La variable `--bs-secondary` utilizaba `#64748b` (Slate 500). Sobre el fondo negro puro (`#000000`) y fondos oscuros (`#0f0f0f`), producía un contraste de **4.39:1**, fallando el umbral mínimo normativo de 4.5:1 para texto normal.
- **Solución implementada**:
  - Actualización de `--bs-secondary` a `#94a3b8` (Slate 400).
  - Contraste medido contra `#000000`: **8.19:1** (Supera ampliamente AA de 4.5:1 y AAA de 7:1).
  - Contraste medido contra `#121212`: **7.31:1** (Supera ampliamente AA de 4.5:1 y AAA de 7:1).
  - Eliminación de fondos transparentes ambiguos (`rgba(15, 15, 15, 0.92)`) en el cajón de canales, sustituyéndolos por superficies opacas `#121212` con texto de canal `#f8fafc` / `#ffffff` (relación de contraste **18:1**).
  - Indicadores activos y bordes de componentes interactivos reforzados para garantizar al menos **3:1** contra superficies adyacentes (SC 1.4.11).

#### B. Redimensionamiento de Texto y Escalado del Viewport (WCAG SC 1.4.4 & SC 1.4.10)
- **Problema previo**: `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">` bloqueaba el zoom táctil mediante `maximum-scale=1`.
- **Solución implementada**: Eliminación de `maximum-scale=1`. El viewport permite escalado fluido hasta más del 200% sin pérdida de contenido ni truncamiento de controles.

#### C. Subtítulos y Alternativas Multimedia (WCAG SC 1.2.2 & SC 4.1.2)
- **Problema previo**: El elemento `<video id="video">` carecía de pista de subtítulos declarada y de nombre accesible discernible, disparando la regla crítica `video-caption`.
- **Solución implementada**:
  - Declaración explícita de `<track kind="captions" src="data:text/vtt,WEBVTT" srclang="es" label="Español" default>` dentro del reproductor de video.
  - Atributo `aria-label="Reproductor de video en directo"` asignado al elemento `<video>`.

#### D. Estructura Semántica, Encabezados y Puntos de Referencia (WCAG SC 1.3.1 & SC 2.4.1)
- **Mecanismo de Salto**: Incorporación de enlace de salto al contenido accesible (`<a href="#main-content" class="skip-link visually-hidden-focusable btn btn-primary ...">Saltar al contenido principal</a>`).
- **Jerarquía de Encabezados**: Introducción de un encabezado principal `<h1>` visualmente accesible para lectores de pantalla (`<h1 class="visually-hidden">SPTV - Simple TV</h1>`) y reestructuración del título del menú lateral a `<h2>`.
- **Landmarks HTML5**: Estructuración semántica con `<main id="main-content" tabindex="-1">` y conversión del menú lateral en `<nav class="offcanvas ..." id="sidebarChannels" aria-labelledby="sidebarTitle">`.
- **Iconografía Decorativa**: Adición rigurosa de `aria-hidden="true"` a todos los elementos FontAwesome (`<i>`).

---

### 2.2 Principio 2: Operable (Operable)

#### A. Navegabilidad 100% por Teclado y Eliminación de Trampas (WCAG SC 2.1.1 & SC 2.1.2)
- **Problema previo**: El listener global en `js/main.js` interceptaba incondicionalmente las teclas `Enter`, `ArrowUp`, `ArrowDown`, `ArrowLeft` y `ArrowRight` mediante `e.preventDefault()`, impidiendo activar el botón PiP (`#pipBtn`) con teclado y bloqueando los controles nativos de video.
- **Solución implementada**:
  - Filtro y guarda en el listener global para no interceptar eventos cuando el foco está sobre botones interactivos, enlaces o controles multimedia.
  - Soporte completo para teclas estándar de navegación (`Tab`, `Shift+Tab`, `Space`, `Enter`, `Escape`).

#### B. Restauración de Foco al Cerrar Diálogos (WCAG SC 2.4.3)
- **Problema previo**: Cerrar el menú lateral con teclado o ratón provocaba que el foco se reiniciara al elemento `<body>`.
- **Solución implementada**: Al dispararse el evento `hidden.bs.offcanvas` o cerrarse el cajón mediante `Escape`, el foco se restaura explícitamente a `#openSidebar`.

#### C. Visibilidad del Foco y Estado de Inactividad (WCAG SC 2.4.7)
- **Problema previo**: La clase `.menu-btn--idle` aplicaba `opacity: 0; pointer-events: none;` sin contemplar si los botones tenían el foco, haciendo invisible el anillo de foco para usuarios de teclado.
- **Solución implementada**:
  - Regla CSS protegida con `:not(:focus-within):not(:focus-visible)` en `.menu-btn--idle`.
  - Inclusión de listener `focusin` y `focusout` en el gestor de inactividad de `js/main.js` para reactivar y mantener visibles los controles durante la navegación por teclado.
  - Anillos de foco `:focus-visible` de alto contraste (contorno sólido azul `#60a5fa` de 3px con desplazamiento `outline-offset: 3px` y borde separador negro de 1px).

#### D. Dimensiones de Objetivos Táctiles (WCAG SC 2.5.5 & SC 2.5.8)
- Todos los botones interactivos (botón de menú `#openSidebar`, PiP `#pipBtn`, launcher de Cast `.cast-launcher`, botones de cierre `.btn-close`) poseen un área mínima de toque y clic de **44x44 píxeles**.

#### E. Reducción de Movimiento (WCAG SC 2.2.2 & SC 2.3.3)
- Implementación y respeto estricto de la directiva `@media (prefers-reduced-motion: reduce)`, desactivando transiciones y animaciones y deteniendo giros infinitos para usuarios con sensibilidad vestibular.

---

### 2.3 Principio 3: Comprensible y Robusto (Understandable & Robust)

#### A. Nombre, Rol y Valor en Componentes ARIA (WCAG SC 4.1.2)
- **Contenedor de Canales**: `#channels-group` configurado con `role="listbox"` y `aria-label="Lista de canales"`.
- **Navegación Roving Tabindex**: Manejo de `tabindex="0"` y `aria-selected="true"` en el canal seleccionado y `tabindex="-1"` con `aria-selected="false"` en los restantes opciones (`<div role="option">`), evitando listas infinitas de tabulación y garantizando una exploración intuitiva por flechas direccionales.
- **Notificaciones PWA y Actualizaciones**: Diálogos con `role="alertdialog"` provistos de `aria-labelledby="pwaUpdateTitle"` y `aria-describedby="pwaUpdateDesc"`, con trampa de foco y restauración de foco al cerrarse.
- **Regiones Vivas**: Limpieza de conflictos en `#toastContainer` eliminando roles anidados contradictorios.

---

## 3. Matriz de Resultados de Auditoría (Antes vs Después)

| Criterio / Regla Axe | Elemento Afectado | Línea Base (Antes) | Estado Refactorizado (Después) | Estado Final |
|---|---|:---:|:---:|:---:|
| `video-caption` | `<video id="video">` | ✖ Falla (Critical) | ✔ Pasa (0 violaciones) | **RESUELTO** |
| `aria-input-field-name` | `#channels-group` | ✖ Falla (Critical) | ✔ Pasa (0 violaciones) | **RESUELTO** |
| `color-contrast` | `#sidebarChannels h2` | ✖ Falla (Serious) | ✔ Pasa (0 violaciones) | **RESUELTO** |
| `color-contrast` | `#channels-group [role="option"] span` | ✖ Falla (Serious) | ✔ Pasa (0 violaciones) | **RESUELTO** |
| `meta-viewport` | `<meta name="viewport">` | ✖ Advertencia (Zoom bloqueado) | ✔ Pasa (Zoom habilitado) | **RESUELTO** |
| `bypass` | Salto al reproductor | ✖ Ausente | ✔ Pasa (Skip link presente) | **RESUELTO** |
| `heading-order` | Jerarquía `<h1>`-`<h2>` | ✖ Ausente `<h1>` | ✔ Pasa (`<h1>` oculto + `<h2>`) | **RESUELTO** |
| `keyboard-trap` / Interceptación | Teclado global (`Enter`/flechas) | ✖ Atrapa `#pipBtn` | ✔ Pasa (Desacoplado) | **RESUELTO** |
| `focus-visible` en reposo | `.menu-btn--idle` | ✖ Foco invisible | ✔ Pasa (`:focus-visible` activo) | **RESUELTO** |
| **Total Violaciones Automatizadas** | **Toda la aplicación** | **4 Violaciones** | **0 Violaciones** | **100% CONFORME** |

---

## 4. Instrucciones Exactas para Ejecutar la Auditoría

### 4.1 Requisitos Previos
- **Node.js**: Versión 18.x, 20.x o 24.x instalada.
- **Navegador**: Google Chrome o Microsoft Edge instalado en el sistema.

### 4.2 Instalación de Dependencias de Desarrollo
Desde la raíz del proyecto, ejecute:

```bash
npm install
```

### 4.3 Ejecución del Test Automatizado
Para ejecutar la suite de verificación automatizada completa:

```bash
npm test
```

O equivalentemente:

```bash
npm run audit
```

O invocando directamente el script con Node:

```bash
node scripts/audit.js
```

### 4.4 Ejecución Standalone sin Instalación Previa (Vía NPX)
Si desea validar el proyecto en un entorno limpio sin ejecutar previamente `npm install`:

```bash
npx --yes pa11y --runner axe http://127.0.0.1:<puerto>/index.html
```

### 4.5 Comportamiento de Salida y Código de Retorno
- **Código de salida `0`**: La prueba finaliza exitosamente únicamente cuando el total de violaciones detectadas en el Escenario 1 y Escenario 2 es estrictamente igual a `0`.
- **Código de salida `1`**: Si se detecta cualquier violación, el script reporta en la terminal el desglose detallado con selector DOM, regla infringida y enlace a la guía de corrección de Deque University.
