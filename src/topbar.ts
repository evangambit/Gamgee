import { Flow } from "./primitives/flow.js";
import { DiffableCollectionView } from "./base-ui/diffable-collection.js";
 
export interface TopbarItem {
  collectionItemId: string;
  element: HTMLElement;
}

export class TopBar extends DiffableCollectionView<void, TopbarItem> {
  constructor(items: Flow<Array<TopbarItem>>) {
    super(items, (item: TopbarItem) => item.collectionItemId, (item: TopbarItem) => {
      return item.element;
    });
    this.content.style.display = "flex";
    this.content.style.flexDirection = "row";
    this.content.style.justifyContent = "space-around";
    this.content.style.alignItems = "center";
    this.content.style.backgroundColor = "#f0f0f0";
    this.content.style.borderBottom = "1px solid #ccc";
  }
}
customElements.define("top-bar", TopBar);
