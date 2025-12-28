import { DiffableCollectionView } from "./base-ui/diffable-collection.js";
import { Flow } from "./primitives/flow.js";
import { gMouse, keysDown } from "./base-ui/mouse.js";
import { Timeline, RawTrack, EventId, TrackId } from "./crud/timeline-crud.js";
import { EditorModel } from "./editor-model.js";
import { EventView } from "./event-view.js";

export class TrackView extends DiffableCollectionView<[RawTrack, Timeline], EventId> {
    _track: RawTrack | undefined;
    _timeline: Timeline | undefined;
    constructor(model: EditorModel, trackId: TrackId, eventViewCache: Map<EventId, EventView>) {
        const events: Flow<Array<EventId>> = model.flowifiedDb.getEventsForTrackFlow(trackId);
        super(events, eventId => eventId as string, (eventId: EventId) => {
            const cachedView = eventViewCache.get(eventId);
            if (cachedView) {
                return cachedView;
            }
            const newView = new EventView(model, eventId);
            eventViewCache.set(eventId, newView);
            return newView;
        }, model.flowifiedDb.getTrackFlow(trackId).concat(model.getTimeline()).consume(([track, timeline]: [RawTrack, Timeline]) => {
            this._timeline = timeline;
            this.style.backgroundColor = track.trackIndex % 2 === 0 ? "#f0f0f0" : "#e0e0e0";
            this._track = track;
        }));
        this.style.height = "3em";
        this.style.width = "100%";
        this.style.display = "block";
        this.style.position = "relative";
        this.style.userSelect = "none";
        // Add new event on click.
        this.addEventListener('click', (e) => {
            if (e.target !== this) {
                return;
            }
            if (e.clientX != gMouse.downPos.x || e.clientY != gMouse.downPos.y) {
                return;
            }
            if (!keysDown.has('Shift')) {
                return;
            }
            const track = this._track!;
            const rect = this.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickPercent = (clickX / rect.width);
            const timeline = this._timeline!;
            const start = clickPercent * timeline.duration;
            const duration = timeline.duration * 0.1;
            const end = start + duration;
            model.addCaption(trackId, `Event ${(Math.random() * 1000) | 0}`, start, end, true);
        });
    }
}
customElements.define('track-view', TrackView);
