export interface FrameProvider {
    iterateFrames(callback: (time: number, canvas: HTMLCanvasElement) => void | Promise<void>, fps: number): Promise<void>;
}