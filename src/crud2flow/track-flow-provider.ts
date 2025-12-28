import { Flow, StateFlow, context } from "../primitives/flow.js";
import { RawTrack, TimelineDB, TrackId } from "../crud/timeline-crud.js";
import { AddTableRow, RemoveTableRow, UpdateTableRow } from "../crud/crud.js";

export class EventFlowProvider {
    private db: TimelineDB;
    eventFlows: Map<TrackId, StateFlow<RawTrack>> = new Map();

    addEventHandler: (event: AddTableRow<TrackId, RawTrack>) => void;
    removeEventHandler: (event: RemoveTableRow<TrackId>) => void;
    updateEventHandler: (event: UpdateTableRow<TrackId, RawTrack>) => void;

    constructor(db: TimelineDB) {
        this.db = db;

        this.addEventHandler = (event: AddTableRow<TrackId, RawTrack>) => {
            if (this.eventFlows.has(event.value.collectionItemId)) {
                const flow = this.eventFlows.get(event.value.collectionItemId)!;
                flow.value = event.value;
            }
        };
        db.tracks.addEventer.addEventListener(this.addEventHandler);

        this.removeEventHandler = (event: RemoveTableRow<TrackId>) => {
            if (this.eventFlows.has(event.key)) {
                const flow = this.eventFlows.get(event.key)!;
                flow.value = undefined as any;
            }
        };
        db.tracks.removeEventer.addEventListener(this.removeEventHandler);

        this.updateEventHandler = (event: UpdateTableRow<TrackId, RawTrack>) => {
            if (this.eventFlows.has(event.value.collectionItemId)) {
                const flow = this.eventFlows.get(event.value.collectionItemId)!;
                flow.value = event.value;
            }
        };
        db.tracks.updateEventer.addEventListener(this.updateEventHandler);
    }

    getTrackFlow(trackId: TrackId): Flow<RawTrack> {
        if (!this.eventFlows.has(trackId)) {
            const eventFlow = context.create_state_flow<RawTrack>(this.db.getTrack(trackId)!);
            this.eventFlows.set(trackId, eventFlow);
        }
        return this.eventFlows.get(trackId)!;
    }
}
