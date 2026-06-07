export class AppState {
    static #instance = null;
    
    constructor() {
        if (AppState.#instance) return AppState.#instance;
        this.channels = [];
        this.currentIndex = 0;
        AppState.#instance = this;
    }

    static getInstance() {
        if (!this.#instance) this.#instance = new AppState();
        return this.#instance;
    }

    setChannels(channels) {
        this.channels = channels;
    }

    getCurrentChannel() {
        return this.channels[this.currentIndex];
    }
}