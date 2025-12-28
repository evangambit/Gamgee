import { Consumer } from "../primitives/flow.js";

export class View<T> extends HTMLElement {
  _consumer: Consumer<T>;
  constructor(consumer: Consumer<T>) {
    super();
    this._consumer = consumer;
  }
  connectedCallback() {
    this._consumer.turn_on();
  }
  disconnectedCallback() {
    this._consumer.turn_off();
  }
}