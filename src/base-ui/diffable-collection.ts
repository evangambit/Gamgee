import { Consumer, context, Flow, NullConsumer } from "../primitives/flow.js";
import { View } from "./view.js";

export interface LevensteinOperation {
  type: 'insert' | 'delete' | 'substitute' | 'equal';
  aIndex?: number;
  bIndex?: number;
  insertedValue?: string;
}

function levenstein(a: Array<string>, b: Array<string>): Array<LevensteinOperation> {
  const dp: Array<Array<number>> = [];
  for (let i = 0; i <= a.length; i++) {
    dp[i] = [];
    for (let j = 0; j <= b.length; j++) {
      if (i === 0) {
        dp[i][j] = j;
      } else if (j === 0) {
        dp[i][j] = i;
      } else if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        );
      }
    }
  }
  const operations: Array<LevensteinOperation> = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      operations.push({ type: 'equal', aIndex: i - 1, bIndex: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j] === dp[i][j - 1] + 1)) {
      operations.push({ type: 'insert', aIndex: i, bIndex: j - 1, insertedValue: b[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j] === dp[i - 1][j] + 1)) {
      operations.push({ type: 'delete', aIndex: i - 1, bIndex: j, insertedValue: undefined });
      i--;
    } else if (i > 0 && j > 0) {
      operations.push({ type: 'substitute', aIndex: i - 1, bIndex: j - 1, insertedValue: b[j - 1] });
      i--;
      j--;
    }
  }
  operations.reverse();
  return operations;
}

export function apply_levenstein(
  operations: Array<LevensteinOperation>,
  insert_fn: (index: number, value: string) => void,
  delete_fn: (index: number) => void,
  substitute_fn: (index: number, value: string) => void) {
  let aIndex = 0;
  let bIndex = 0;
  for (const op of operations) {
    if (op.type === 'equal') {
      aIndex++;
      bIndex++;
    } else if (op.type === 'insert') {
      insert_fn(aIndex, op.insertedValue!);
      bIndex++;
      aIndex++;
    } else if (op.type === 'delete') {
      delete_fn(aIndex);
    } else if (op.type === 'substitute') {
      substitute_fn(aIndex, op.insertedValue!);
      aIndex++;
      bIndex++;
    }
  }
}

export interface DiffResults {
  operations: Array<LevensteinOperation>;
  items: Array<string>;
}

export function differ(): (itemsArr: Array<string>) => DiffResults {
  let lastArr: Array<string> = [];
  return (itemsArr: Array<string>) => {
    const r = {
      operations: levenstein(lastArr, itemsArr),
      items: itemsArr,
    };
    lastArr = itemsArr;
    return r;
  };
}

/**
 * Automatically incrementally creates/deletes children.
 */
export class DiffableCollectionView<T, Row> extends View<T> {
  content: HTMLElement;
  collectionConsumer: Consumer<DiffResults>;
  id2row: Map<string, Row> = new Map();
  constructor(items: Flow<Array<Row>>, row2id: (item: Row) => string, item2view: (item: Row) => HTMLElement, consumer?: Consumer<T>) {
    const insert_fn = (index: number, rowId: string) => {
      const view = item2view(this.id2row.get(rowId)!);
      this.content.insertBefore(view, this.content.children[index] || null);
    };
    const delete_fn = (index: number) => {
      const child = this.content.children[index];
      if (child) {
        this.content.removeChild(child);
      }
    };
    const substitute_fn = (index: number, rowId: string) => {
      const child = this.content.children[index];
      if (child) {
        this.content.replaceChild(item2view(this.id2row.get(rowId)!), child);
      }
    };
    super(consumer || new NullConsumer<T>(context));
    this.collectionConsumer = items.map(arr => {
      for (const item of arr) {
        this.id2row.set(row2id(item), item);
      }
      return arr.map(item => row2id(item));
    }).map(differ()).consume((diff: DiffResults) => {
      const operations = diff.operations;
      apply_levenstein(operations, insert_fn, delete_fn, substitute_fn);
    });
    this.content = <HTMLDivElement>document.createElement('div');
    this.appendChild(this.content);
    this.content.style.display = 'block';
  }
  connectedCallback(): void {
    super.connectedCallback();
    this.collectionConsumer.turn_on();
  }
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.collectionConsumer.turn_off();
  }
}
customElements.define("diffable-collection-view", DiffableCollectionView);
