import { DiffableCollectionView } from "./base-ui/diffable-collection.js";
import { View } from "./base-ui/view.js";
import { context } from "./primitives/flow.js";
import { keysDown } from "./base-ui/mouse.js";
import { Timeline, TimelineEventType, RawEventObj, TrackId, EventId } from "./crud/timeline-crud.js";
import { EditorModel } from "./timeline-model.js";
import { exportVideo } from "./export-video.js";
import { EventView, CaptionEventView, VideoEventView } from "./event-view.js";
import { TrackView } from "./track-view.js";

class TimelineView extends DiffableCollectionView<[number, Timeline, number], TrackId> {
    private timeline: Timeline | undefined;
    constructor(model: EditorModel) {
        // We need tracks to share a cache of event views so that dragging an
        // event from one track to another reuses the same EventView instance.
        // Otherwise the user's drag will break when the event moves to a new track.
        const eventViewCache: Map<string, EventView> = new Map();
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

        window.addEventListener('wheel', (e) => {
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
        });
        window.addEventListener('click', (e) => {
            const rect = this.getBoundingClientRect();
            if (e.clientY < rect.top || e.clientY > rect.bottom) {
                return;
            }
            const clickX = e.clientX - rect.left;
            const clickPercent = (clickX / rect.width);
            const timeline = this.timeline!;
            const time = clickPercent * timeline.duration;
            model.setCurrentTime(time);
        });
    }
}
customElements.define('timeline-view', TimelineView);

class EventViewer extends View<RawEventObj | null> {
    constructor(model: EditorModel) {
        super(model.getSelectedEventFlow().consume((event: RawEventObj | null) => {
            if (event === null) {
                this.innerText = "No event selected";
                return;
            }
            this.innerHTML = "";
            switch (event.type) {
                case TimelineEventType.CAPTION:
                    this.appendChild(new CaptionEventView(model, event.eventId));
                    break;
                case TimelineEventType.VIDEO:
                    this.appendChild(new VideoEventView(model, event.eventId));
                    break;
            }
        }));
    }
}
customElements.define('event-viewer', EventViewer);

class PlayButtonPanel extends View<[Timeline, number]> {
    constructor(model: EditorModel) {
        const playButton = document.createElement('button');
        const exportButton = document.createElement('button');
        exportButton.innerText = "Export Timeline to JSON";
        const timeElement = document.createElement('div');
        super(model.getTimeline().concat(model.getCurrentTimeFlow()).consume(([timeline, currentTime]: [Timeline, number]) => {
            playButton.innerText = timeline.isPlaying ? "Pause" : "Play";
            exportButton.innerText = "Export";
            timeElement.innerText = `Time: ${currentTime.toFixed(2)}s / ${timeline.duration.toFixed(2)}s`;
        }));
        playButton.addEventListener('click', () => {
            model.togglePlayPause();
        });
        exportButton.addEventListener('click', async () => {
            exportButton.disabled = true;
            exportButton.innerText = "Exporting...";
            exportVideo(model, /*fps=*/5).then(() => {
                exportButton.disabled = false;
                exportButton.innerText = "Export";
            });
        });
        this.appendChild(playButton);
        this.appendChild(exportButton);
        this.appendChild(timeElement);
        this.style.display = "flex";
        this.style.flexDirection = "row";
        this.style.justifyContent = "space-between";
    }
}
customElements.define('play-button-panel', PlayButtonPanel);

export class EditorView extends View<[HTMLCanvasElement, {width: number, height: number}]> {
    constructor(model: EditorModel) {
        const width = 800;
        const height = 600;

        const aboveTimelineSizeFlow = context.create_state_flow<{width: number, height: number}>({width: 0, height: 0}, "AboveTimelineSize");

        const aboveTimelineDiv = document.createElement('div');
        aboveTimelineDiv.style.flex = '1';
        aboveTimelineDiv.style.display = 'flex';
        aboveTimelineDiv.style.flexDirection = 'row';

        const eventInfoView = new EventViewer(model);
        eventInfoView.style.width = '30%';
        eventInfoView.style.borderBottom = '1px solid black';
        aboveTimelineDiv.appendChild(eventInfoView);

        const canvas = document.createElement('canvas');

        const canvasContainer = document.createElement('div');
        canvasContainer.style.width = '70%';
        canvasContainer.appendChild(canvas);

        aboveTimelineDiv.appendChild(canvasContainer);

        const playButtonPanel = new PlayButtonPanel(model);
        playButtonPanel.style.height = '2em';
        playButtonPanel.style.borderTop = '1px solid black';

        const timelineView = new TimelineView(model);
        timelineView.style.height = '12em';


        const resizer = new ResizeObserver((entries) => {
            const rect = canvasContainer.getBoundingClientRect();
            aboveTimelineSizeFlow.value = {
                width: rect.width,
                height: rect.height
            };
        });
        resizer.observe(canvasContainer);

        super(model.getCanvasFlow().concat(aboveTimelineSizeFlow).consume(([modelCanvas, canvasContainerSize]) => {
            canvas.width = canvasContainerSize.width;
            canvas.height = canvasContainerSize.height;
            canvas.style.width = `${canvasContainerSize.width}px`;
            canvas.style.height = `${(modelCanvas.height / modelCanvas.width) * canvasContainerSize.width}px`;
            const ctx = canvas.getContext('2d')!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(modelCanvas, 0, 0, modelCanvas.width, modelCanvas.height, 0, 0, canvas.width, canvas.height);
        }));
        
        this.appendChild(aboveTimelineDiv);
        this.appendChild(playButtonPanel);
        this.appendChild(timelineView);

        this.style.display = "flex";
        this.style.flexDirection = "column";
        this.style.overflow = "auto";

        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const clickX = (e.clientX - rect.left) / rect.width;
            const clickY = (e.clientY - rect.top) / rect.height;
            model.mouseDownOnCanvas(clickX, clickY);
        });
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const clickX = (e.clientX - rect.left) / rect.width;
            const clickY = (e.clientY - rect.top) / rect.height;
            const moveX = e.movementX / rect.width;
            const moveY = e.movementY / rect.height;
            model.mouseMoveOnCanvas(clickX, clickY, moveX, moveY);
        });
        canvas.addEventListener('mouseup', (e) => {
            const rect = canvas.getBoundingClientRect();
            const releaseX = (e.clientX - rect.left) / rect.width;
            const releaseY = (e.clientY - rect.top) / rect.height;
            model.mouseUpOnCanvas(releaseX, releaseY);
        });
    }
}
customElements.define('editor-view', EditorView);
