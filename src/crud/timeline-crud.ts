    import { CrudTable, CrudTransaction } from "./crud.js";

export enum TimelineEventType {
    CAPTION,
    VIDEO,
}


export class EventId extends String {}
export class TrackId extends String {}

export interface RawEventObj {
    eventId: EventId;
    name: string;
    start: number;  // seconds from start of timeline
    end: number;    // seconds from start of timeline
    resizable: boolean;
    type: TimelineEventType;
}

export interface RawCaptionEvent extends RawEventObj {
    type: TimelineEventType.CAPTION;
    boundingBox: { x: number; y: number; width: number; height: number; };
}

export interface RawVideoEvent extends RawEventObj {
    type: TimelineEventType.VIDEO;
    videoSrc: string;
}

export interface RawTrack {
    trackId: TrackId;
    trackIndex: number;
}

export interface Timeline {
    duration: number;
    isPlaying: boolean;
    width: number;
    height: number;
}


export function computeCaptionBoundingBox(
    ctx: CanvasRenderingContext2D,
    event: RawCaptionEvent
): { x: number; y: number; width: number; height: number } {
    const canvas = ctx.canvas;
    ctx.font = `${canvas.height * 0.1}px Arial`;
    const width = ctx.measureText(event.name).width;
    return {
        x: canvas.width / 2 - width / 2,
        y: canvas.height * 0.9 - (canvas.height * 0.1) / 2,
        width: width,
        height: canvas.height * 0.1,
    };
}

export class TimelineDB {
    public events: CrudTable<EventId, RawEventObj> = new CrudTable();
    public readonly tracks: CrudTable<TrackId, RawTrack> = new CrudTable();
    public readonly event2Track: CrudTable<EventId, TrackId> = new CrudTable();
    public readonly trackArray: Array<RawTrack> = [];  // The order of the tracks (consistent with trackIndex).

    /**
     * Add a new event.
     * @param event The event to add.
     * @param trackId The ID of the track to add the event to.
     */
    addEvent(event: RawEventObj, trackId: TrackId) {
        // Use a transaction to ensure both tables are updated before events are dispatched.
        // This way event listeners can rely on both tables being in sync.
        const transaction = new CrudTransaction();
        this.events.add(event.eventId, event, transaction);
        this.event2Track.add(event.eventId, trackId, transaction);
        transaction.commit();
    }

    /**
     * Add a new track.
     * @param track The track to add.
     */
    addTrack(trackId: TrackId, events: Array<RawEventObj> = []): RawTrack {
        const track: RawTrack = {
            trackId: trackId as string,
            trackIndex: this.trackArray.length,
        };
        this.trackArray.push(track);
        this.tracks.add(trackId, track);
        return track;
    }

    getTracksArray(): Array<RawTrack> {
        return this.trackArray;
    }

    getEventIdsOnTrack(trackId: TrackId): Array<EventId> {
        const track = this.tracks.get(trackId);
        if (!track) {
            throw new Error(`Track with ID ${trackId} does not exist`);
        }
        const eventObjs: Array<EventId> = [];
        for (const [eventId, tId] of this.event2Track.entries()) {
            if (tId === trackId) {
                eventObjs.push(eventId);
            }
        }
        return eventObjs;
    }

    /**
     * Update an existing event.
     * @param event The event to update.
     */
    updateEvent(event: RawEventObj) {
        this.events.update(event.eventId, event);
    }

    /**
     * Move an event to a different track.
     * @param eventId The ID of the event to move.
     * @param oldTrackId The ID of the track the event is currently on.
     * @param newTrackId The ID of the track to move the event to.
     */
    moveEventToTrack(eventId: EventId, oldTrackId: TrackId, newTrackId: TrackId) {
        this.event2Track.update(eventId, newTrackId);
    }

    removeEvent(eventId: EventId) {
        this.events.remove(eventId);
        this.event2Track.remove(eventId);
    }

    /**
     * Get all events that are active at the given time.
     * @param time The time in seconds.
     * @returns An array of RawEventObj that are active at the given time.
     */
    getEventsAtTime(time: number): Array<RawEventObj> {
        const eventsAtTime: Array<RawEventObj> = [];
        for (const event of this.events.values()) {
            if (event.start <= time && event.end >= time) {
                eventsAtTime.push(event);
            }
        }
        return eventsAtTime;
    }

    getEvent(eventId: EventId): RawEventObj {
        const event = this.events.get(eventId);
        if (!event) {
            throw new Error(`Event with ID ${eventId} does not exist`);
        }
        return event;
    }

    trackIdForEventId(eventId: EventId): TrackId {
        const trackId = this.event2Track.get(eventId);
        if (!trackId) {
            throw new Error(`Event with ID ${eventId} is not assigned to any track`);
        }
        return trackId;
    }

    getTrack(trackId: TrackId): RawTrack | undefined {
        return this.tracks.get(trackId);
    }
}
