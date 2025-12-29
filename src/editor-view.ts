import { View } from "./base-ui/view.js";
import { context, Flow } from "./primitives/flow.js";
import { Timeline, TimelineEventType, RawEventObj, EventId } from "./crud/timeline-crud.js";
import { EditorModel } from "./editor-model.js";
import { exportVideo } from "./export-video.js";
import { CaptionEventView, VideoEventView } from "./event-view.js";
import { TimelineView } from "./timeline-view.js";

class EventViewer extends View<[null, null] | [EventId, TimelineEventType]> {
    constructor(model: EditorModel) {
        const selectedEventFlow = model.getSelectedEventFlow();
        const flow = selectedEventFlow.map((event: RawEventObj | null) => {
            if (event === null) {
                return [null, null];
            }
            return [event.eventId, event.type] as [EventId, TimelineEventType];
        }).distinctUntilChanged((a, b) => {
            return a[0] === b[0] && a[1] === b[1];
        });
        super(flow.consume(([eventId, eventType]) => {
            if (eventId === null || eventType === null) {
                this.innerText = "No event selected";
                return;
            }
            this.innerHTML = "";
            switch (eventType) {
                case TimelineEventType.CAPTION:
                    this.appendChild(new CaptionEventView(model, eventId));
                    break;
                case TimelineEventType.VIDEO:
                    this.appendChild(new VideoEventView(model, eventId));
                    break;
            }
        }));
    }
}
customElements.define('event-viewer', EventViewer);

function disableUiForModal(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '1000';
    overlay.style.pointerEvents = 'auto';
    overlay.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    document.body.appendChild(overlay);

    return overlay;
}

class ExportModal extends HTMLElement {
    constructor(model: EditorModel, close: () => void) {
        super();

        this.style.display = 'flex';
        this.style.flexDirection = 'column';
        this.style.gap = '10px';
        this.style.backgroundColor = 'white';
        this.style.padding = '1em';
        this.style.borderRadius = '0.5em';

        const cancelButton = document.createElement('button');
        cancelButton.innerText = "Cancel";

        const exportButton = document.createElement('button');
        exportButton.innerText = "Start Export";

        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'space-between';
        buttonContainer.style.marginTop = '10px';
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(exportButton);

        const fpsLabel = document.createElement('label');
        fpsLabel.innerText = "FPS: ";

        const fpsInput = document.createElement('input');
        fpsInput.type = 'number';
        fpsInput.valueAsNumber = 30;

        const fpsContainer = document.createElement('div');
        fpsContainer.appendChild(fpsLabel);
        fpsContainer.appendChild(fpsInput);

        const progressBar = document.createElement('progress');
        progressBar.style.width = '100%';
        progressBar.max = 1;
        progressBar.value = 0;
        this.appendChild(progressBar);

        exportButton.addEventListener('click', async () => {
            cancelButton.disabled = true;
            exportButton.disabled = true;
            await exportVideo(model, fpsInput.valueAsNumber || 30, (progress: number) => {
                progressBar.value = progress;
            });
            close();
        });
        cancelButton.addEventListener('click', () => {
            close();
        });

        this.appendChild(fpsContainer);
        this.appendChild(buttonContainer);
    }
}
customElements.define('export-modal', ExportModal);

class PlayButtonPanel extends View<[Timeline, number]> {
    constructor(model: EditorModel) {
        const playButton = document.createElement('button');
        const exportButton = document.createElement('button');
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
            const overlay = disableUiForModal();
            const modal = new ExportModal(model, () => {
                overlay.remove();
                exportButton.disabled = false;
            });
            modal.style.position = 'fixed';
            modal.style.top = '50%';
            modal.style.left = '50%';
            modal.style.transform = 'translate(-50%, -50%)';
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
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
