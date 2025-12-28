import { Flow, StateFlow, context } from "../primitives/flow.js";
import { RawEventObj, TimelineDB, RawTrack, EventId, TrackId } from "../crud/timeline-crud.js";
import { AddTableRow, RemoveTableRow, UpdateTableRow } from "../crud/crud.js";

export class FlowifiedDb {
    private db: TimelineDB;
    trackFlows: Map<TrackId, StateFlow<RawTrack>> = new Map();
    eventsForTrackFlows: Map<TrackId, StateFlow<Array<EventId>>> = new Map();
    trackIds: StateFlow<Array<TrackId>>;

    addTrackHandler: (event: AddTableRow<TrackId, RawTrack>) => void;
    
    addEventToTrackHandler: (event: AddTableRow<EventId, TrackId>) => void;
    moveEventToTrackHandler: (event: UpdateTableRow<EventId, TrackId>) => void;
    removeEventFromTrackHandler: (event: RemoveTableRow<EventId>) => void;
    constructor(db: TimelineDB) {
        this.db = db;
        this.trackIds = context.create_state_flow<Array<TrackId>>(db.getTracksArray().map(t => t.trackId));
        this.addTrackHandler = (event: AddTableRow<TrackId, RawTrack>) => {
            this.trackIds.value = this.db.getTracksArray().map(t => t.trackId);
            if (this.trackFlows.has(event.key)) {
                const flow = this.trackFlows.get(event.key)!;
                flow.value = event.value;
            }
        };
        db.tracks.addEventer.addEventListener(this.addTrackHandler);
        this.addEventToTrackHandler = (event: AddTableRow<EventId, TrackId>) => {
            if (this.eventsForTrackFlows.has(event.value)) {
                const trackFlow = this.eventsForTrackFlows.get(event.value)!;
                trackFlow.value = this.db.getEventIdsOnTrack(event.value);
            }
        };
        db.event2Track.addEventer.addEventListener(this.addEventToTrackHandler);
        this.removeEventFromTrackHandler = (event: RemoveTableRow<EventId>) => {
            if (this.eventsForTrackFlows.has(event.key)) {
                const trackFlow = this.eventsForTrackFlows.get(event.key)!;
                trackFlow.value = this.db.getEventIdsOnTrack(event.key);
            }
        };
        db.event2Track.removeEventer.addEventListener(this.removeEventFromTrackHandler);
        this.moveEventToTrackHandler = (event: UpdateTableRow<EventId, TrackId>) => {
            if (this.eventsForTrackFlows.has(event.value)) {
                const newTrackFlow = this.eventsForTrackFlows.get(event.value)!;
                newTrackFlow.value = this.db.getEventIdsOnTrack(event.value);
            }
            if (this.eventsForTrackFlows.has(event.oldValue)) {
                const oldTrackFlow = this.eventsForTrackFlows.get(event.oldValue)!;
                oldTrackFlow.value = this.db.getEventIdsOnTrack(event.oldValue);
            }
        };
        db.event2Track.updateEventer.addEventListener(this.moveEventToTrackHandler);
    }

    // TODO: update these flows when the underlying DB changes.
    getTrackFlow(trackId: TrackId): Flow<RawTrack> {
        if (!this.trackFlows.has(trackId)) {
            const trackFlow = context.create_state_flow<RawTrack>(this.db.getTrack(trackId)!);
            this.trackFlows.set(trackId, trackFlow);
        }
        return this.trackFlows.get(trackId)!;
    }

    getEventsForTrackFlow(trackId: TrackId): Flow<Array<EventId>> {
        if (!this.eventsForTrackFlows.has(trackId)) {
            const eventsFlow = context.create_state_flow<Array<EventId>>(
                this.db.getEventIdsOnTrack(trackId),
            );
            this.eventsForTrackFlows.set(trackId, eventsFlow);
        }
        return this.eventsForTrackFlows.get(trackId)!;
    }
}