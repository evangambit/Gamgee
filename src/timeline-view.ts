import { DiffableCollectionView } from "./base-ui/diffable-collection.js";
import { keysDown } from "./base-ui/mouse.js";
import { EventId, Timeline, TrackId } from "./crud/timeline-crud.js";
import { EditorModel } from "./editor-model.js";
import { EventView } from "./event-view.js";
import { TrackView } from "./track-view.js";

export class TimelineView extends DiffableCollectionView<[number, Timeline, number], TrackId> {
    private timeline: Timeline | undefined;
    private wheelHandler: (e: WheelEvent) => void;
    private clickHandler: (e: MouseEvent) => void;
    constructor(model: EditorModel) {
        // We need tracks to share a cache of event views so that dragging an
        // event from one track to another reuses the same EventView instance.
        // Otherwise the user's drag will break when the event moves to a new track.
        const eventViewCache: Map<EventId, EventView> = new Map();
        const timeCursor = document.createElement('div');
        timeCursor.style.position = "absolute";
        timeCursor.style.top = "0";
        timeCursor.style.bottom = "0";
        timeCursor.style.width = "2px";
        timeCursor.style.backgroundColor = "red";
        timeCursor.style.pointerEvents = "none";
        timeCursor.style.zIndex = "10";

        super(model.getTrackIdsFlow(), trackId => trackId as string, (trackId: TrackId) => {
            return new TrackView(model, trackId, eventViewCache);
        }, model.zoomFlowState.concat2(model.getTimeline(), model.getCurrentTimeFlow()).consume(
            ([zoom, timeline, time]: [number, Timeline, number]) => {
                this.timeline = timeline;
                this.style.width = (zoom * timeline.duration).toString() + "px";
                const timePercent = time / timeline.duration;
                timeCursor.style.left = `calc(${timePercent * 100}% - 1px)`;
            }
        ));
        this.appendChild(timeCursor);

        this.style.position = "relative";
        this.style.overflowY = 'auto';

        this.wheelHandler = (e: WheelEvent) => {
            if (e.deltaY === 0) {
                return;
            }
            if (!keysDown.has('Shift')) {
                return;
            }
            e.preventDefault();
            const zoom = model.zoomFlowState.value;
            if (e.deltaY < 0) {
                model.zoomFlowState.value = zoom * 1.1;
            } else {
                model.zoomFlowState.value = zoom / 1.1;
            }
        };
        window.addEventListener('wheel', this.wheelHandler);
        this.clickHandler = (e: MouseEvent) => {
            const rect = this.getBoundingClientRect();
            if (e.clientY < rect.top || e.clientY > rect.bottom) {
                return;
            }
            const clickX = e.clientX - rect.left;
            const clickPercent = (clickX / rect.width);
            const timeline = this.timeline;
            if (!timeline) {
                return;
            }
            const time = clickPercent * timeline.duration;
            model.setCurrentTime(time);
        };
        window.addEventListener('click', this.clickHandler);
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('wheel', this.wheelHandler);
        window.removeEventListener('click', this.clickHandler);
    }
}
customElements.define('timeline-view', TimelineView);
