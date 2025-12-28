import { Flow } from "../primitives/flow.js";
import { EventId, RawEventObj, TimelineDB } from "../crud/timeline-crud.js";
import { AddTableRow, RemoveTableRow, UpdateTableRow } from "../crud/crud.js";

export class EventsAtTime extends Flow<Array<RawEventObj>> {
    private db: TimelineDB;
    private timeFlow: Flow<number>;
    private onAddEvent: (event: AddTableRow<EventId, RawEventObj>) => void;
    private onRemoveEvent: (event: RemoveTableRow<EventId>) => void;
    private onUpdateEvent: (event: UpdateTableRow<EventId, RawEventObj>) => void;

    constructor(db: TimelineDB, timeFlow: Flow<number>) {
        super(timeFlow._context, [timeFlow]);
        this.db = db;
        this.timeFlow = timeFlow;
        this.onAddEvent = (event: AddTableRow<EventId, RawEventObj>) => {
            if (this._value === undefined) {
                return;
            }
            if (this.timeFlow._value === undefined) {
                return;
            }
            const value = this._value!;
            const time = this.timeFlow._value!;
            if (event.value.start <= time && event.value.end >= time) {
                this.setValue(value.concat([event.value]));
            }
        };
        this.onRemoveEvent = (event: RemoveTableRow<EventId>) => {
            if (this._value === undefined) {
                return;
            }
            const value = this._value!;
            const newValue = value.filter(e => e.eventId !== event.key);
            if (newValue.length !== value.length) {
                this.setValue(newValue);
            }
        };
        this.onUpdateEvent = (event: UpdateTableRow<EventId, RawEventObj>) => {
            if (this._value === undefined) {
                return;
            }
            if (this.timeFlow._value === undefined) {
                return;
            }
            const value = this._value!;
            const time = this.timeFlow._value!;
            const isInTime = event.value.start <= time && event.value.end >= time;
            if (!isInTime) {
                return;
            }
            const newValue = value.filter(e => e.eventId !== event.key).concat([event.value]);
            this.setValue(newValue);
        };
    }
    _source_changed(): boolean {
        this.setValue(this.db.getEventsAtTime(this.timeFlow._value!));
        return true;
    }
    _becoming_hot(): void {
        this.db.events.addEventer.addEventListener(this.onAddEvent);
        this.db.events.removeEventer.addEventListener(this.onRemoveEvent);
        this.db.events.updateEventer.addEventListener(this.onUpdateEvent);
        this._value = this.db.getEventsAtTime(this.timeFlow._value!);
        this._context.add_recently_updated(this);
    }
    _becoming_cold(): void {
        this.db.events.addEventer.removeEventListener(this.onAddEvent);
        this.db.events.removeEventer.removeEventListener(this.onRemoveEvent);
        this.db.events.updateEventer.removeEventListener(this.onUpdateEvent);
    }
    private setValue(newValue: Array<RawEventObj>) {
        // Sort by track index.
        newValue.sort((a, b) => {
            const trackAId = this.db.trackIdForEventId(a.eventId);
            const trackBId = this.db.trackIdForEventId(b.eventId);
            if (!trackAId || !trackBId) {
                throw new Error("Event is not assigned to a track");
            }
            const trackA = this.db.getTrack(trackAId);
            const trackB = this.db.getTrack(trackBId);
            if (!trackA || !trackB) {
                throw new Error("Track does not exist");
            }
            return trackA.trackIndex - trackB.trackIndex;
        });
        this._value = newValue;
        this._context.add_recently_updated(this);
    }
}
