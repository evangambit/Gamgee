import { TimelineEventType, computeCaptionBoundingBox, RawCaptionEvent, RawVideoEvent, RawEventObj, EventId, TextAlign } from "./crud/timeline-crud.js";

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
                    const captionEvent: RawCaptionEvent = <RawCaptionEvent> event;
                    const fontSize = captionEvent.fontSize;
                    ctx.font = `${fontSize}px Arial`;
                    const lines = captionEvent.name.split('\n');

                    const lineWidths = lines.map(line => ctx.measureText(line).width);
                    console.log('Line widths:', lineWidths);
                    const widestLineWidth = Math.max(...lineWidths);

                    ctx.textBaseline = 'middle';
                    for (let i = 0; i < lines.length; i++) {
                        ctx.fillStyle = 'white';
                        let dx = 0;
                        switch (captionEvent.textAlign) {
                            case TextAlign.LEFT:
                                dx = 0;
                                break;
                            case TextAlign.CENTER:
                                dx = (widestLineWidth - lineWidths[i]) / 2;
                                break;
                            case TextAlign.RIGHT:
                                dx = widestLineWidth - lineWidths[i];
                                break;
                        }
                        const x = Math.floor(captionEvent.center[0] - (widestLineWidth / 2) + dx);
                        const y = Math.floor(captionEvent.center[1] - (lines.length - 1) * (fontSize / 2) + i * fontSize);

                        ctx.fillStyle = 'black';
                        ctx.fillText(lines[i], x + fontSize / 30, y + fontSize / 30);
                        ctx.fillStyle = 'white';
                        ctx.fillText(lines[i], x, y);
                    }

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
