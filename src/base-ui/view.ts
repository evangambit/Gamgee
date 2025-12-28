import { Consumer } from "../primitives/flow.js";

export class View<T> extends HTMLElement {
  _consumer: Consumer<T> | undefined;
  constructor(consumer: Consumer<T> | undefined) {
    super();
    this._consumer = consumer;
  }
  connectedCallback() {
    if (this._consumer) {
      this._consumer.turn_on();
    }
  }
  disconnectedCallback() {
    if (this._consumer) {
      this._consumer.turn_off();
    }
  }
}