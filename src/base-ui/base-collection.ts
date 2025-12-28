import { Flow } from "../primitives/flow.js";
import { View } from "./view.js";


/**
 * A base collection view that displays a collection of items.
 * 
 * Intended for small collections where diffing is not necessary.
 */
export class BaseCollectionView<Row> extends View<Array<Row>> {
  constructor(stackFlow: Flow<Array<Row>>, item2view: (item: Row) => HTMLElement) {
    super(stackFlow.consume((stack) => {
      this._update(stack, item2view);
    }, "NavigationViewConsumer"));
  }
  protected _update(stack: Array<Row>, item2view: (item: Row) => HTMLElement) {
    throw new Error("Implement in subclass");
  }
}
