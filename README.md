
This project is an ode to

1. Reactive programming: data changes, pure functions compute things, and the UI automatically updates.

2. Vanilla HTML/JavaScript.

It's a demonstration that React through the baby out with the bath water whe it invented the virtual DOM.

## Views

Views inherit from a simple base class::

```
class BaseView<T> extends HTMLElement {
  private _consumer: Consumer<T>
  constructor(flow: Flow<T>, update: (T) => void) {
    super();
    this._consumer = flow.consume(update);
  }
  connectedCallback() {
    // Causes all upstream flows to start working.
    this._consumer.turn_on();
  }
  disconnectedCallback() {
    // Turns off all upstream flows.
    this._consumer.turn_off();
  }
}
```

Every view has a single consumer. No view has public members.

This means the only thing that distinguishes one view from another
is the constructor.

### Collection Views

Collection views are no exception. Typically you pass a flow of a
list of the minimum amount of data each cell in your collection needs
(e.g. the row ID of the data it represents, etc).

The cell then grabs the rest of the data it needs from the model.

Because the only distinguishing feature of a view is its constructor,
we can pass a function that constructs a cell from an item, and our
collection is completely decoupled from its cell:

```
class MyCollectionView extends HTMLElement {
  private _consumer: Consumer<MyItem>
  constructor(itemsFlow: Flow<MyItem>, item2view: (MyItem) => HTMLElement) {
    super(itemsFlow, (items) => {
      // A trivial example. More sophisticated/efficient updates
      // are possible.
      this.innerHTML = '';
      for (let item of items) {
        this.appendChild(item2view(item));
      }
    });
  }
}

let myInboxView = new MyCollectionView(model.inboxItems(), (item) => {
  return new InboxCell(item);
});
```

## No Virtual DOM.

Views on the screen are persistent, so the most natural way to model
views in your code is as persistant objects.

This was common before React, which insisted that developers represent persistent
objects with transient objects, thus inventing the demand for a virtual DOM.

This project demonstrates that reactive programmming works perfectly well within
a traditional DOM framework, with "diffing" happening completely naturally.

## Appendix

Commands:

```
$ npm run build

$ npm run dev
```
