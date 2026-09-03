// Declaraciones globales de tipos para VS Code / TypeScript JSDoc
// Este archivo NO se carga en el navegador ni requiere compilador; solo proporciona
// definiciones de tipos globales al editor para objetos de CDNs y extensiones de Window.

// ── Extensiones de Window (Google Cast SDK) ──────────────────────────────────
interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    __castApiReady?: boolean;
    /** Clase Hls cargada por CDN (hls.js) */
    Hls?: HlsStatic;
}

// ── hls.js (CDN) — interfaz mínima de uso real ───────────────────────────────
interface HlsStatic {
    new (config?: object): HlsInstance;
    isSupported(): boolean;
    Events: Record<string, string>;
    ErrorTypes: { NETWORK_ERROR: string; MEDIA_ERROR: string; [key: string]: string };
}

interface HlsInstance {
    attachMedia(el: HTMLVideoElement): void;
    loadSource(src: string): void;
    startLoad(): void;
    stopLoad(): void;
    destroy(): void;
    recoverMediaError(): void;
    on(event: string, cb: (event: string, data: HlsErrorData) => void): void;
}

interface HlsErrorData {
    fatal: boolean;
    type: string;
    details: string;
    [key: string]: unknown;
}

// ── Bootstrap 5 (CDN) — clases de uso real en el proyecto ────────────────────
declare const bootstrap: {
    Offcanvas: new (element: Element, options?: object) => {
        show(): void;
        hide(): void;
    };
    Toast: new (element: Element, options?: object) => {
        show(): void;
    };
};

// ── Google Cast SDK (CDN) ─────────────────────────────────────────────────────
declare const cast: any;
declare const chrome: any;
