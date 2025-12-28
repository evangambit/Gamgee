import { View } from "./base-ui/view.js";
import { gMouse } from "./base-ui/mouse.js";
import { Timeline, RawEventObj, EventId } from "./crud/timeline-crud.js";
import { EditorModel } from "./editor-model.js";

export class EventView extends View<[RawEventObj, Timeline]> {
    private eventObj!: RawEventObj;
    private timeline!: Timeline;
    constructor(model: EditorModel, eventId: EventId) {
        const leftEnd = document.createElement('div');
        const middle = document.createElement('div');
        const rightEnd = document.createElement('div');
        super(model.eventFlowProvider.getEventFlow(eventId).concat(model.getTimeline()).consume(([eventObj, timeline]) => {
            this.eventObj = eventObj;
            this.timeline = timeline;
            this.style.position = "absolute";
            const timelineDuration = timeline.duration;
            const startPercent = (eventObj.start / timelineDuration) * 100;
            const endPercent = (eventObj.end / timelineDuration) * 100;
            this.style.left = `calc(${startPercent}%)`;
            this.style.width = `${endPercent - startPercent}%`;
            middle.innerText = eventObj.name;
        }));
        this.appendChild(leftEnd);
        this.appendChild(middle);
        this.appendChild(rightEnd);

        middle.style.flex = "1";
        middle.style.overflow = "hidden";

        leftEnd.style.width = "5px";
        leftEnd.style.height = "100%";
        leftEnd.style.cursor = "ew-resize";

        rightEnd.style.width = "5px";
        rightEnd.style.height = "100%";
        rightEnd.style.cursor = "ew-resize";

        this.style.top = "5px";
        this.style.height = "calc(100% - 10px)";
        this.style.backgroundColor = "lightblue";
        this.style.border = "1px solid blue";
        this.style.userSelect = "none";
        this.style.display = "flex";

        window.addEventListener('mousemove', (e) => {
            if (!gMouse.down) {
                return;
            }
            if (this.parentElement === null) {
                return;
            }
            if (![leftEnd, middle, rightEnd].includes(gMouse.downTarget as HTMLDivElement)) {
                return;
            }
            const dt = e.movementX / this.parentElement!.getBoundingClientRect().width * this.timeline.duration;
            const rect = this.trackRect;
            const dy = Math.floor((e.clientY - rect.top) / rect.height);
            if (gMouse.downTarget === leftEnd && this.eventObj.resizable) {
                // Resizing left edge
                const newStart = this.eventObj.start + dt;
                const clampedStart = Math.min(newStart, this.eventObj.end - 0.1);
                const delta = clampedStart - this.eventObj.start;
                model.moveEvent(eventId, delta, 0, -delta);
            } else if (gMouse.downTarget === rightEnd && this.eventObj.resizable) {
                // Resizing right edge
                const newEnd = this.eventObj.end + dt;
                const clampedEnd = Math.max(newEnd, this.eventObj.start + 0.1);
                const delta = clampedEnd - this.eventObj.end;
                model.moveEvent(eventId, 0, 0, delta);
            } else if (gMouse.downTarget === middle) {
                model.moveEvent(eventId, dt, Math.round(dy));
            }
        });
        this.addEventListener('click', (e) => {
            model.selectEvent(eventId);
        });
    }
    get trackRect() {
        return this.parentElement!.parentElement!.getBoundingClientRect();
    }
}
customElements.define('event-view', EventView);

export class CaptionEventView extends View<RawEventObj> {
    constructor(model: EditorModel, eventId: EventId) {
        super(model.eventFlowProvider.getEventFlow(eventId).consume((eventObj) => {
            this.innerText = `Caption Event: ${eventObj.name}`;
        }));
    }
}
customElements.define('caption-event-view', CaptionEventView);

export class VideoEventView extends View<RawEventObj> {
    constructor(model: EditorModel, eventId: EventId) {
        super(model.eventFlowProvider.getEventFlow(eventId).consume((eventObj) => {
        }));
    }
}
customElements.define('video-event-view', VideoEventView);
