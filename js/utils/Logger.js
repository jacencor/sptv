export class Logger {
    static log(...args) {
        console.log('[SPTV]', ...args);
    }
    static error(...args) {
        console.error('[SPTV ERROR]', ...args);
    }
    static warn(...args) {
        console.warn('[SPTV WARN]', ...args);
    }
}