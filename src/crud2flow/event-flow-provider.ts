import { Flow, StateFlow, context } from "../primitives/flow.js";
import { RawEventObj, TimelineDB, EventId } from "../crud/timeline-crud.js";
import { AddTableRow, RemoveTableRow, UpdateTableRow } from "../crud/crud.js";

export class EventFlowProvider {
    private db: TimelineDB;
    eventFlows: Map<EventId, StateFlow<RawEventObj>> = new Map();

    addEventHandler: (event: AddTableRow<EventId, RawEventObj>) => void;
    removeEventHandler: (event: RemoveTableRow<EventId, RawEventObj>) => void;
    updateEventHandler: (event: UpdateTableRow<EventId, RawEventObj>) => void;

    constructor(db: TimelineDB) {
        this.db = db;

        this.addEventHandler = (event: AddTableRow<EventId, RawEventObj>) => {
            if (this.eventFlows.has(event.value.eventId)) {
                const flow = this.eventFlows.get(event.value.eventId)!;
                flow.value = event.value;
            }
        };
        db.events.addEventer.addEventListener(this.addEventHandler);

        this.removeEventHandler = (event: RemoveTableRow<EventId, RawEventObj>) => {
            if (this.eventFlows.has(event.key)) {
                this.eventFlows.delete(event.key);
                // TODO: set value to undefined?
            }
        };
        db.events.removeEventer.addEventListener(this.removeEventHandler);

        this.updateEventHandler = (event: UpdateTableRow<EventId, RawEventObj>) => {
            if (this.eventFlows.has(event.value.eventId)) {
                const flow = this.eventFlows.get(event.value.eventId)!;
                flow.value = event.value;
            }
        };
        db.events.updateEventer.addEventListener(this.updateEventHandler);
    }

    getEventFlow(eventId: EventId): Flow<RawEventObj> {
        if (!this.eventFlows.has(eventId)) {
            const eventFlow = context.create_state_flow<RawEventObj>(this.db.getEvent(eventId));
            this.eventFlows.set(eventId, eventFlow);
        }
        return this.eventFlows.get(eventId)!;
    }
}
