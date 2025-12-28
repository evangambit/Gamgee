import { StateFlow, context } from "./primitives/flow.js";
import { TopBar, TopbarItem } from "./topbar.js";
import { EditorView } from "./editor-view.js";
import { EditorModel } from "./editor-model.js";
import { View } from "./base-ui/view.js";

export enum TopLevelNavigationItemType {
  Timeline = "timeline",
}

export interface TopLevelNavigationItemBase {
  type: TopLevelNavigationItemType;
}

export interface TimelineNavigationItem extends TopLevelNavigationItemBase {
  model: EditorModel;
}

const starIcon = '/star.svg';

function make_element(tag: string, fn: (el: HTMLElement) => void): HTMLElement {
  const el = document.createElement(tag);
  fn(el);
  return el;
}

function navStackToTopbarItems(
  navStack: Array<TopLevelNavigationItemBase>,
  navStackFlow: StateFlow<Array<TopLevelNavigationItemBase>>
): Array<TopbarItem> {
  if (navStack.length === 0) {
    return [];
  }
  const items: Array<TopbarItem> = [];
  if (navStack.length > 1) {
    items.push({
      collectionItemId: "back-button",
      element: make_element("button", (btn) => {
        btn.innerText = "Back";
        btn.onclick = () => {
          navStackFlow.value = navStackFlow.value.slice(0, navStackFlow.value.length - 1);
        };
      }),
    });
  }
  const currentItem = navStack[navStack.length - 1];

  let title = "";
  switch (currentItem.type) {
    case TopLevelNavigationItemType.Timeline:
      title = `Timeline`;
      break;
  }
  items.push({
    collectionItemId: "title",
    element: make_element("div", (div) => {
      div.innerText = title;
      div.style.fontWeight = "bold";
      div.style.fontSize = "18px";
    }),
  });
  
  return items;
}

class RootNav extends View<TopLevelNavigationItemBase | null> {
  constructor(stackFlow: StateFlow<Array<TopLevelNavigationItemBase>>) {
    const topbar = new TopBar(stackFlow.map((navStack) => navStackToTopbarItems(navStack, stackFlow)));
    const lastItemFlow = (stackFlow).map(stack => stack.length > 0 ? stack[stack.length - 1] : null);
    const topBar = new TopBar(stackFlow.map((navStack) => navStackToTopbarItems(navStack, stackFlow)));
    super(lastItemFlow.consume((navItem) => {
      this.innerHTML = "";
      this.appendChild(topBar);
      if (navItem === null) {
        return;
      }
      let child: HTMLElement;
      switch (navItem.type) {
        case TopLevelNavigationItemType.Timeline:
          child = new EditorView((navItem as TimelineNavigationItem).model);
          break;
        default:
          child = document.createElement("div");
          child.innerText = "Unknown navigation item";
          break;
      }
      child.style.flex = "1";
      child.style.position = "relative";
      this.appendChild(child);      
    }));

    this.style.position = "fixed";
    this.style.top = "0";
    this.style.left = "0";
    this.style.right = "0";
    this.style.bottom = "0";
    this.style.overflow = "hidden";
    this.style.display = "flex";
    this.style.flexDirection = "column";
  }
}
customElements.define("root-nav", RootNav);

function main() {
  const navStackFlow = context.create_state_flow<Array<TopLevelNavigationItemBase>>([], "TopLevelNavStack");
  const rootNav = new RootNav(navStackFlow);

  document.body.appendChild(rootNav);
  rootNav.style.position = "fixed";
  rootNav.style.top = "0";
  rootNav.style.left = "0";
  rootNav.style.right = "0";
  rootNav.style.bottom = "0";

  const navItem = {
    collectionItemId: "timeline-1",
    type: TopLevelNavigationItemType.Timeline,
    model: new EditorModel(800, 600),
  } as TimelineNavigationItem;
  navStackFlow.value = navStackFlow.value.concat([navItem]);
}

// Initialize the app when DOM is loaded
window.addEventListener("DOMContentLoaded", () => {
    main();
});
