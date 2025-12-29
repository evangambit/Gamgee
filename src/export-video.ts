import { FrameProvider } from "./frame-provider.js";

export async function exportVideo(model: FrameProvider, fps: number = 30, progressCallback?: (progress: number) => void): Promise<void> {
    if (!progressCallback) {
        progressCallback = (progress: number) => {};
    }
    try {
        console.log('Starting export...');
        
        // Use older ffmpeg.wasm version (0.11.x) which has simpler loading
        const loadFFmpegScript = (): Promise<void> => {
            return new Promise((resolve, reject) => {
                if ((window as any).FFmpeg) {
                    resolve();
                    return;
                }
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js';
                script.onload = () => resolve();
                script.onerror = () => reject(new Error('Failed to load FFmpeg script'));
                document.head.appendChild(script);
            });
        };
        
        console.log('Loading FFmpeg script...');
        await loadFFmpegScript();
        console.log('FFmpeg script loaded.');
        
        const { createFFmpeg, fetchFile } = (window as any).FFmpeg;
        const ffmpeg = createFFmpeg({ 
            log: true,
            corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
            progress: ({ ratio }: { ratio: number }) => {
                // Map FFmpeg progress (0.0 to 1.0) to second half of overall progress
                progressCallback!(0.5 + ratio * 0.5);
            }
        });
        console.log('FFmpeg instance created.');
        
        console.log('Loading FFmpeg core...');
        await ffmpeg.load();
        console.log('FFmpeg core loaded.');
        
        const frames: Uint8Array[] = [];
        
        // Collect all frames
        await model.iterateFrames(async (time: number, duration: number, canvas: HTMLCanvasElement) => {
            const blob = await new Promise<Blob>((resolve) => {
                canvas.toBlob((b) => resolve(b!), 'image/png');
            });
            const arrayBuffer = await blob.arrayBuffer();
            frames.push(new Uint8Array(arrayBuffer));
            progressCallback(time / duration * 0.5); // First half progress for frame capture
        }, fps);
        
        console.log(`Captured ${frames.length} frames`);
        
        if (frames.length === 0) {
            throw new Error('No frames were captured');
        }
        
        // Write frames to FFmpeg virtual filesystem (0.11.x API uses FS)
        for (let i = 0; i < frames.length; i++) {
            const paddedIndex = String(i).padStart(6, '0');
            ffmpeg.FS('writeFile', `frame_${paddedIndex}.png`, frames[i]);
        }
        console.log('Frames written to virtual filesystem');
        
        // Run FFmpeg to create video from frames (0.11.x uses run() not exec())
        // Use the same fps for input as we captured
        console.log('Running FFmpeg encoding...');
        await ffmpeg.run(
            '-framerate', fps.toString(),
            '-i', 'frame_%06d.png',
            '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            'output.mp4'
        );
        console.log('FFmpeg encoding complete');
        
        // Check if output file exists
        try {
            const data = ffmpeg.FS('readFile', 'output.mp4');
            console.log(`Output file size: ${data.length} bytes`);
            const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
            const url = URL.createObjectURL(videoBlob);
            
            // Trigger download
            const a = document.createElement('a');
            a.href = url;
            a.download = 'timeline_export.mp4';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (readError) {
            console.error('Failed to read output file. FFmpeg may have failed.');
            // List files in virtual filesystem to debug
            try {
                const files = ffmpeg.FS('readdir', '/');
                console.log('Files in virtual filesystem:', files);
            } catch (e) {
                console.error('Could not list files:', e);
            }
            throw new Error('FFmpeg encoding failed - no output file produced. Check console for FFmpeg logs.');
        }
        
        // Cleanup FFmpeg filesystem (non-critical, ignore errors)
        try {
            for (let i = 0; i < frames.length; i++) {
                const paddedIndex = String(i).padStart(6, '0');
                ffmpeg.FS('unlink', `frame_${paddedIndex}.png`);
            }
            ffmpeg.FS('unlink', 'output.mp4');
        } catch (cleanupError) {
            console.log('Cleanup warning (non-critical):', cleanupError);
        }
        
    } catch (error) {
        console.error('Export failed:', error);
        alert('Export failed: ' + (error as Error).message);
    }
}
