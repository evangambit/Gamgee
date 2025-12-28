import { TimelineEventType, computeCaptionBoundingBox, RawCaptionEvent, RawVideoEvent, RawEventObj, EventId } from "./crud/timeline-crud.js";

export class CanvasRenderer {
    private videos: Map<string, HTMLVideoElement>;

    constructor(videos: Map<string, HTMLVideoElement>) {
        this.videos = videos;
    }

    drawEvent(ctx: CanvasRenderingContext2D, event: RawEventObj, currentTime: number): Promise<void> {
        const canvas = ctx.canvas;
        return new Promise((resolve) => {
            switch (event.type) {
                case TimelineEventType.CAPTION:
                    ctx.font = `${canvas.height * 0.1}px Arial`;
                    const captionEvent: RawCaptionEvent = <RawCaptionEvent> event;
                    // Potentially (lazily) update bounding box.
                    if (!captionEvent.boundingBox) {
                        captionEvent.boundingBox = computeCaptionBoundingBox(ctx, captionEvent);
                    }
                    const boundingBox = captionEvent.boundingBox!;
                    const x = boundingBox.x + boundingBox.width / 2;
                    const y = boundingBox.y + boundingBox.height / 2;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    // Drop shadow effect
                    ctx.fillStyle = 'black';
                    ctx.fillText(captionEvent.name, x + 2, y + 1);
                    ctx.fillStyle = 'black';
                    ctx.fillText(captionEvent.name, x + 1, y + 2);
                    ctx.fillStyle = 'white';
                    ctx.fillText(captionEvent.name, x, y);
                    resolve();
                    break;
                case TimelineEventType.VIDEO:
                    const videoEvent: RawVideoEvent = <RawVideoEvent> event;
                    const videoSrc = videoEvent.videoSrc;
                    const video = this.videos.get(videoSrc)!;
                    if (video.currentTime === currentTime - event.start) {
                        ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight,
                            0, 0, canvas.width, canvas.height);
                        resolve();
                        break;
                    }
                    video.currentTime = currentTime - event.start;
                    video.onseeked = () => {
                        video.onseeked = null;
                        ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight,
                            0, 0, canvas.width, canvas.height);
                        resolve();
                    };
                    break;
                default:
                    resolve();
            }
        });
    }

    drawCanvas(
        canvas: HTMLCanvasElement,
        eventsAtCurrentTime: Array<RawEventObj>,
        currentTime: number,
        getTrackIndexOfEvent: (eventId: EventId) => number
    ): Promise<void> {
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Sort by track (higher track index = drawn first, so lower tracks appear on top).
        const sortedEvents = [...eventsAtCurrentTime].sort((a, b) => {
            const trackA = getTrackIndexOfEvent(a.eventId);
            const trackB = getTrackIndexOfEvent(b.eventId);
            return trackB - trackA;
        });

        let promise = Promise.resolve();
        for (const event of sortedEvents) {
            promise = promise.then(() => this.drawEvent(ctx, event, currentTime));
        }
        return promise;
    }
}
