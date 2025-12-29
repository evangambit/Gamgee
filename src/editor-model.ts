import { Consumer, Flow, StateFlow, context } from "./primitives/flow.js";
import { FrameProvider } from "./frame-provider.js";
import { FlowSelector } from "./primitives/flow-selector.js";
import { CanvasRenderer } from "./canvas-renderer.js";
import { TimelineEventType, RawCaptionEvent, RawVideoEvent, RawEventObj, Timeline, TimelineDB, RawTrack, computeCaptionBoundingBox, TrackId, EventId, TextAlign } from "./crud/timeline-crud.js";
import { FlowifiedDb } from "./crud2flow/model2flow.js";
import { EventsAtTime } from "./crud2flow/events-at-time.js";
import { EventFlowProvider } from "./crud2flow/event-flow-provider.js";

export function copy<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
}

export class EditorScope extends String {}

export class EditorModel implements FrameProvider {
    db: TimelineDB = new TimelineDB();
    public flowifiedDb: FlowifiedDb = new FlowifiedDb(this.db);
    public eventFlowProvider: EventFlowProvider = new EventFlowProvider(this.db);

    private timelineFlow: StateFlow<Timeline>;
    private zoomFlow: StateFlow<number> = context.create_state_flow<number>(10);
    private selectedEventId: StateFlow<EventId | null> = context.create_state_flow<EventId | null>(null);
    private selectedEvent: Flow<RawEventObj | null> = 
    FlowSelector.create<EventId | null, RawEventObj | null>(this.selectedEventId, (eventId: EventId | null) => {
        if (eventId === null) {
            return null;
        }
        return this.eventFlowProvider.getEventFlow(eventId).map(event => event) as Flow<RawEventObj | null>;
    });

    private currentTime: StateFlow<number> = context.create_state_flow<number>(0);
    private currentEventsAtTime = new EventsAtTime(this.db, this.currentTime);

    // This consumer listens to changes in current time and events at that time to update the (offscreen) canvas.
    private eventsAtCurrentTimeConsumer: Consumer<[number, Array<RawEventObj>]>;

    private videos: Map<string, HTMLVideoElement> = new Map();
    private canvas: HTMLCanvasElement = document.createElement('canvas');
    private canvasFlow: StateFlow<HTMLCanvasElement> = context.create_state_flow<HTMLCanvasElement>(this.canvas);
    private canvasRenderer: CanvasRenderer;

    private isPlayingConsumer: Consumer<boolean>;

    constructor(width: number, height: number) {
        this.timelineFlow = context.create_state_flow<Timeline>({
            duration: 30,
            isPlaying: false,
            width: width,
            height: height,
        });
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvasRenderer = new CanvasRenderer(this.videos);
        this.addTrack();
        this.addVideo('./simpsons.mp4').then((video: HTMLVideoElement) => {
            const timeline = copy(this.timelineFlow.value);
            timeline.duration = video.duration;
            this.timelineFlow.value = timeline;
        });

        this.eventsAtCurrentTimeConsumer = this.currentTime.concat(this.currentEventsAtTime)
        .distinctUntilChanged(([oldTime, oldEvents], [newTime, newEvents]) => {
            if (oldTime !== newTime) {
                return false;
            }
            if (oldEvents.length !== newEvents.length) {
                return false;
            }
            for (let i = 0; i < oldEvents.length; i++) {
                // God have mercy on my soul for using JSON.stringify for deep comparison.
                if (JSON.stringify(oldEvents[i]) !== JSON.stringify(newEvents[i])) {
                    return false;
                }
            }
            return true;
        })
        .consume((eventsAtCurrentTime: [number, Array<RawEventObj>]) => {
            this.canvasRenderer.drawCanvas(
                this.canvas,
                eventsAtCurrentTime[1],
                this.currentTime.value,
                (eventId) => this.db.getTrack(this.db.trackIdForEventId(eventId))!.trackIndex
            ).then(() => {
                this.canvasFlow.value = this.canvas;
            });
        });
        this.eventsAtCurrentTimeConsumer.turn_on();

        let thread: number;
        this.isPlayingConsumer = this.timelineFlow
        .map(t => t.isPlaying)
        .distinctUntilChanged((a, b) => a === b)
        .consume((isPlaying: boolean) => {
            if (isPlaying) {
                thread = setInterval(() => {
                    const timeline = this.timelineFlow.value;
                    let newTime = this.currentTime.value + 1 / 30;
                    if (newTime > timeline.duration) {
                        newTime = 0;
                    }
                    this.setCurrentTime(newTime);
                }, 1000 / 30);
            } else {
                clearInterval(thread);
            }
        }).turn_on();
    }
    getCurrentTimeFlow(): Flow<number> {
        return this.currentTime;
    }
    setCurrentTime(time: number) {
        this.currentTime.value = time;
    }
    getSelectedEventFlow(): Flow<RawEventObj | null> {
        return this.selectedEvent;
    }
    selectEvent(eventId: EventId | null) {
        this.selectedEventId.value = eventId;
    }
    getTimeline(): Flow<Timeline> {
        return this.timelineFlow;
    }
    getTrackIdsFlow(): Flow<Array<TrackId>> {
        return this.flowifiedDb.trackIds;
    }
    togglePlayPause() {
        const timeline = this.timelineFlow.value;
        this.timelineFlow.value = {
            duration: timeline.duration,
            isPlaying: !timeline.isPlaying,
            width: timeline.width,
            height: timeline.height,
        };
    }
    addTrack() {
        const trackId = `track-${Math.random().toString(36)}` as TrackId;
        this.db.addTrack(trackId);
        return trackId;
    }
    addCaption(trackId: TrackId, name: string, start: number, end: number, resizable: boolean) {
        const eventId = `event-${Math.random().toString(36)}` as EventId;
        const event: RawCaptionEvent = {
            eventId: eventId, name, start, end, resizable, type: TimelineEventType.CAPTION,
            center: [this.canvas.width / 2, this.canvas.height * 0.9],
            fontSize: 24,
            textAlign: TextAlign.CENTER,
        };
        this.addEvent(event, trackId);
    }

    addEvent(event: RawEventObj, trackId: TrackId) {
        this.db.addEvent(event, trackId);
    }


    addVideo(src: string): Promise<HTMLVideoElement> {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'auto';  // Ensure video data is loaded
            video.muted = true;      // Muted videos can autoplay and seek more freely
            video.style.display = 'none';  // Hide the video element
            document.body.appendChild(video);  // Add to DOM so browser actually loads it
            video.oncanplay = () => {
                video.oncanplay = null;
                const videoEvent: RawVideoEvent = {
                    eventId: `event-${Math.random().toString(36)}` as EventId,
                    name: 'Video Event',
                    videoSrc: src,
                    start: 0,
                    end: video.duration,
                    resizable: false,
                    type: TimelineEventType.VIDEO,
                }
                this.addEvent(videoEvent, this.addTrack());
                resolve(video);
            };
            video.src = src;
            this.videos.set(src, video);
        });
    }

    /**
     * Move an event by deltaStart seconds and deltaTrack tracks, and optionally change its duration.
     * @param eventId The ID of the event to move.
     * @param deltaStart The amount of time to move the event by, in seconds.
     * @param deltaTrack The number of tracks to move the event by.
     * @param deltaDuration The amount to change the event's duration by, in seconds.
     */
    moveEvent(eventId: EventId, deltaStart: number, deltaTrack: number, deltaDuration: number = 0) {
        const eventObj = this.db.getEvent(eventId);
        if (eventObj.start + deltaStart < 0) {
            deltaStart = -eventObj.start;
        }

        const timelineDuration = this.timelineFlow.value!.duration;
        if (eventObj.end + deltaStart >= timelineDuration) {
            deltaDuration -= (eventObj.end + deltaStart) - timelineDuration;
            deltaStart -= (eventObj.end + deltaStart) - timelineDuration;
        }

        // Desired new start and end times. We may need to adjust these to avoid overlaps.
        let newStart = eventObj.start + deltaStart;
        let newEnd = Math.max(newStart, eventObj.end + deltaStart + deltaDuration);

        const currentTrackId = this.db.trackIdForEventId(eventId);
        
        const tracks: Array<RawTrack> = this.db.getTracksArray();
        const trackIds = tracks.map(t => t.trackId) as Array<TrackId>;
        const currentIndex = trackIds.indexOf(currentTrackId);
        const newIndex = Math.max(0, Math.min(trackIds.length - 1, currentIndex + deltaTrack));
        const newTrackId = trackIds[newIndex];

        // Grab all sibling events in the new track (excluding the event being moved).
        const newTrackEventIds = this.db.getEventIdsOnTrack(newTrackId).filter(id => id !== eventId);
        const newTrackEvents = newTrackEventIds.map(id => this.db.getEvent(id));

        const wouldOverlap = newTrackEvents.some(e => !(newEnd <= e.start || newStart >= e.end));

        // We need to move the event *without* having it overlap with existing events.
        // The below logic updates newStart and newEnd as needed to avoid overlaps.
        if (wouldOverlap) {
            if (deltaTrack !== 0) {
                // Can't move to new track due to overlap. Try moving within the same track instead.
                this.moveEvent(eventId, deltaStart, 0);
                return;
            } else {
                // Move as far as possible without overlapping.
                const duration = eventObj.end - eventObj.start;

                if (deltaStart > 0) {
                    // Dragging Right: Find the closest event that starts after our original start
                    const followingEvents = newTrackEvents
                        .filter(e => e.start >= eventObj.end)
                        .sort((a, b) => a.start - b.start);
                    
                    const limit = followingEvents.length > 0 
                        ? followingEvents[0].start 
                        : Infinity;

                    newEnd = Math.min(newEnd, limit);
                    newStart = newEnd - duration;
                } else {
                    // Dragging Left: Find the closest event that ends before our original end
                    const precedingEvents = newTrackEvents
                        .filter(e => e.end <= eventObj.start)
                        .sort((a, b) => b.end - a.end); // Sort descending to get closest
                    
                    const limit = precedingEvents.length > 0 
                        ? precedingEvents[0].end 
                        : 0;

                    newStart = Math.max(newStart, limit);
                    newEnd = newStart + duration;
                }
            }
        }

        let newEventObj: RawVideoEvent | RawCaptionEvent;
        switch (eventObj.type) {
            case TimelineEventType.VIDEO:
                newEventObj = {
                    eventId: eventObj.eventId,
                    name: eventObj.name,
                    start: newStart,
                    end: newEnd,
                    resizable: eventObj.resizable,
                    videoSrc: (eventObj as RawVideoEvent).videoSrc,
                    type: TimelineEventType.VIDEO,
                };
                break;
            case TimelineEventType.CAPTION:
                newEventObj = {
                    eventId: eventObj.eventId,
                    name: eventObj.name,
                    start: newStart,
                    end: newEnd,
                    resizable: eventObj.resizable,
                    type: TimelineEventType.CAPTION,
                    center: (eventObj as RawCaptionEvent).center,
                    fontSize: (eventObj as RawCaptionEvent).fontSize,
                    textAlign: (eventObj as RawCaptionEvent).textAlign,
                };
                break;
        }
        if (deltaTrack !== 0) {
            // Remove from current track
            this.db.moveEventToTrack(eventId, currentTrackId, newTrackId);
        } else {
            this.db.updateEvent(newEventObj);
        }
    }
    get zoomFlowState(): StateFlow<number> {
        return this.zoomFlow;
    }

    getCanvasFlow(): Flow<HTMLCanvasElement> {
        return this.canvasFlow;
    }

    /**
     * 
     * @param callback 
     */
    async iterateFrames(callback: (time: number, duration: number, canvas: HTMLCanvasElement) => void | Promise<void>, fps: number) {
        const canvas = document.createElement('canvas');
        const timeline = this.timelineFlow.value!;
        canvas.width = timeline.width;
        canvas.height = timeline.height;
        
        for (let time = 0; time <= timeline.duration; time += 1 / fps) {
            const allEvents = this.db.getEventsAtTime(time);
            const eventsAtCurrentTime: RawEventObj[] = allEvents.filter((event) => {
                return event.start <= time && event.end >= time;
            });
            await this.canvasRenderer.drawCanvas(
                canvas,
                eventsAtCurrentTime,
                time,
                (eventId) => this.db.getTrack(this.db.trackIdForEventId(eventId))!.trackIndex
            );
            await callback(time, timeline.duration, canvas);
        }
    }

    private mouseTarget: EventId | null = null;
    mouseDownOnCanvas(x: number, y: number) {
        x *= this.canvas.width;
        y *= this.canvas.height;
        const currentEventsAtTime = this.db.getEventsAtTime(this.currentTime.value);
        for (const event of currentEventsAtTime) {
            if (event.type !== TimelineEventType.CAPTION) {
                continue;
            }
            const captionEvent = event as RawCaptionEvent;
            const box = computeCaptionBoundingBox(captionEvent, this.canvas.getContext('2d')!);
            if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) {
                this.mouseTarget = event.eventId;
                this.selectEvent(this.mouseTarget);
                break;
            }
        }
    }
    mouseMoveOnCanvas(x: number, y: number, dx: number, dy: number) {
        x *= this.canvas.width;
        y *= this.canvas.height;
        dx *= this.canvas.width;
        dy *= this.canvas.height;
        const currentEventsAtTime = this.db.getEventsAtTime(this.currentTime.value);
        if (this.mouseTarget) {
            // Move the selected event.
            currentEventsAtTime
                .filter(event => event.eventId === this.mouseTarget)
                .filter(event => event.type === TimelineEventType.CAPTION)
                .forEach(event => {
                    const captionEvent = event as RawCaptionEvent;
                    const newEvent: RawCaptionEvent = copy(captionEvent);
                    newEvent.center = [
                        captionEvent.center[0] + dx,
                        captionEvent.center[1] + dy,
                    ];
                    this.db.updateEvent(newEvent);
                });
        }
    }
    mouseUpOnCanvas(x: number, y: number) {
        x *= this.canvas.width;
        y *= this.canvas.height;
        this.mouseTarget = null;
    }
}
