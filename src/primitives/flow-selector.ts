import { Consumer, Flow, context } from "./flow.js";

/**
 * A Flow that selects a Flow based on the value of another Flow.
 * 
 * This is not part of the core library because it allows users to construct circular flows.
 */
export class FlowSelector<K, V> extends Flow<V | null> {
    private consumer: Consumer<V> | null = null;
    private constructor(private source: Flow<K>, private func: (key: K) => Flow<V> | null) {
        super(context, [source]);
    }
    _source_changed(): boolean {
        const flow = this.func(this._sources[0]._value);
        if (this.consumer) {
            this.consumer.turn_off();
            this.consumer = null;
        }
        if (flow === null) {
            this._value = null as any;
            return true;
        }
        this.consumer = flow.consume((value: V) => {
            this._value = value;
            this._context.add_recently_updated(this);
        }).turn_on();
        return false;
    }
    _becoming_cold(): void {
        if (this.consumer) {
            this.consumer.turn_off();
            this.consumer = null;
        }
    }

    _becoming_hot(): void {
        if (this.consumer) {
            this.consumer.turn_on();
        }
    }

    static create<K, V>(source: Flow<K>, f: (key: K) => Flow<V> | null): Flow<V | null> {
        return new FlowSelector<K, V>(source, f);
    }
}
