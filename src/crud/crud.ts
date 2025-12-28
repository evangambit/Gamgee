import { Eventer } from "../primitives/event-listening.js";

export class CrudTransaction {
    private callbacks: Array<() => void> = [];
    addCallback(callback: () => void) {
        this.callbacks.push(callback);
    }
    commit() {
        for (const callback of this.callbacks) {
            callback();
        }
    }
}

export interface AddTableRow<K, V> {
    key: K;
    value: V;
}

export interface UpdateTableRow<K, V> {
    key: K;
    value: V;
    oldValue: V;
}

export interface RemoveTableRow<K> {
    key: K;
}

export class CrudTable<K, V> {
    private table: Map<K, V> = new Map();

    public addEventer: Eventer<AddTableRow<K, V>> = new Eventer();
    public updateEventer: Eventer<UpdateTableRow<K, V>> = new Eventer();
    public removeEventer: Eventer<RemoveTableRow<K>> = new Eventer();

    add(key: K, value: V, transaction: CrudTransaction | null = null) {
        this.table.set(key, value);
        if (transaction) {
            transaction.addCallback(() => {
                this.addEventer.dispatchEvent({ key, value });
            });
        } else {
            this.addEventer.dispatchEvent({ key, value });
        }
    }

    update(key: K, value: V, transaction: CrudTransaction | null = null) {
        if (!this.table.has(key)) {
            throw new Error(`Key ${key} does not exist in table`);
        }
        this.table.set(key, value);
        if (transaction) {
            transaction.addCallback(() => {
                this.updateEventer.dispatchEvent({ key, value, oldValue: this.table.get(key)! });
            });
        } else {
            this.updateEventer.dispatchEvent({ key, value, oldValue: this.table.get(key)! });
        }
    }

    remove(key: K, transaction: CrudTransaction | null = null) {
        this.table.delete(key);
        if (transaction) {
            transaction.addCallback(() => {
                this.removeEventer.dispatchEvent({ key });
            });
        } else {
            this.removeEventer.dispatchEvent({ key });
        }
    }

    get(key: K): V | undefined {
        return this.table.get(key);
    }

    has(key: K): boolean {
        return this.table.has(key);
    }

    values(): IterableIterator<V> {
        return this.table.values();
    }

    entries(): IterableIterator<[K, V]> {
        return this.table.entries();
    }
}

