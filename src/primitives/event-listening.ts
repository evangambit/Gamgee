
export interface Subscribable<T> {
    addEventListener(listener: (event: T) => void): void;
    removeEventListener(listener: (event: T) => void): void;
}

export interface Dispatchable<T> {
    dispatchEvent(event: T): void;
}

export interface Listenable <T> extends Subscribable<T>, Dispatchable<T> {}

/**
 * An alternative to EventTarget that is typed and uses WeakRefs for listeners.
 */
export class Eventer<T> implements Listenable<T> {
    private listeners: Set<WeakRef<(event: T) => void>> = new Set();

    constructor() {}
    
    addEventListener(listener: (event: T) => void) {
        this.listeners.add(new WeakRef(listener));
    }

    removeEventListener(listener: (event: T) => void) {
        for (const ref of this.listeners) {
            const fn = ref.deref();
            if (fn === undefined) {
                this.listeners.delete(ref);
            } else if (fn === listener) {
                this.listeners.delete(ref);
                break;
            }
        }
    }

    dispatchEvent(event: T) {
        for (const ref of this.listeners) {
            const fn = ref.deref();
            if (fn === undefined) {
                this.listeners.delete(ref);
            } else {
                fn(event);
            }
        }
    }
}
