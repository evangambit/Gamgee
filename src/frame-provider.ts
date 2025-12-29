export interface FrameProvider {
    iterateFrames(callback: (time: number, duration: number, canvas: HTMLCanvasElement) => void | Promise<void>, fps: number): Promise<void>;
}