#!/usr/bin/env python3
"""
Simple Python development server with live-reload capability.
Replicates the functionality of 'npm run dev' (tsc -w + live-server dist).
"""

import os
import sys
import time
import threading
import webbrowser
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler


class RangeHTTPRequestHandler(SimpleHTTPRequestHandler):
    """HTTP request handler with Range request support for video seeking."""
    
    def end_headers(self):
        """Add COOP/COEP headers required for SharedArrayBuffer (used by FFmpeg.wasm)."""
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()
    
    def translate_path(self, path):
        path = super().translate_path(self.path)
        print(path)
        if path.endswith('.ts'):
            # Redirect from dist/src/ to src/
            path = path.replace(os.path.join('dist', 'src'), 'src')
        print(path)
        print('---')
        return path
    
    def send_head(self):
        """Handle Range requests for video files."""
        path = self.translate_path(self.path)
        
        if not os.path.isfile(path):
            return super().send_head()
        
        # Check for Range header
        range_header = self.headers.get('Range')
        if range_header is None:
            return super().send_head()
        
        # Parse Range header (e.g., "bytes=0-1023")
        try:
            range_spec = range_header.replace('bytes=', '')
            start, end = range_spec.split('-')
            file_size = os.path.getsize(path)
            
            start = int(start) if start else 0
            end = int(end) if end else file_size - 1
            
            if start >= file_size:
                self.send_error(416, 'Requested Range Not Satisfiable')
                return None
            
            end = min(end, file_size - 1)
            content_length = end - start + 1
            
            # Send partial content response
            self.send_response(206)
            self.send_header('Content-Type', self.guess_type(path))
            self.send_header('Content-Length', str(content_length))
            self.send_header('Content-Range', f'bytes {start}-{end}/{file_size}')
            self.send_header('Accept-Ranges', 'bytes')
            self.end_headers()
            
            # Return file object positioned at start
            f = open(path, 'rb')
            f.seek(start)
            return _RangeFile(f, content_length)
            
        except Exception as e:
            print(f"Range request error: {e}")
            return super().send_head()
    
    def log_message(self, format, *args):
        """Log request messages."""
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")


class _RangeFile:
    """Wrapper to limit bytes read from a file."""
    def __init__(self, f, length):
        self.f = f
        self.remaining = length
    
    def read(self, size=-1):
        if self.remaining <= 0:
            return b''
        if size < 0 or size > self.remaining:
            size = self.remaining
        data = self.f.read(size)
        self.remaining -= len(data)
        return data
    
    def close(self):
        self.f.close()


class FileWatcher:
    """Simple file watcher using os.stat to detect changes."""
    
    def __init__(self, callback, watch_dir):
        self.callback = callback
        self.watch_dir = Path(watch_dir)
        self.file_times = {}
        self.watching = True
    
    def watch(self):
        """Watch for file changes in a separate thread."""
        while self.watching:
            try:
                for file_path in self.watch_dir.rglob("*"):
                    if file_path.is_file() and file_path.suffix in (".ts", ".js", ".html", ".css"):
                        try:
                            mtime = file_path.stat().st_mtime
                            if file_path not in self.file_times:
                                self.file_times[file_path] = mtime
                            elif self.file_times[file_path] != mtime:
                                print(f"[CHANGE] {file_path}")
                                self.callback()
                                self.file_times[file_path] = mtime
                        except OSError:
                            pass
                time.sleep(0.5)
            except Exception as e:
                print(f"Watch error: {e}")
                time.sleep(1)


class DevelopmentServer:
    """Simple development server."""
    
    def __init__(self, port=8080, dist_dir="dist"):
        self.port = port
        self.dist_dir = dist_dir
    
    def run(self):
        """Start the development server."""
        # Change to dist directory
        os.chdir(self.dist_dir)
        
        # Create HTTP server with Range request support
        server_address = ("", self.port)
        httpd = HTTPServer(server_address, RangeHTTPRequestHandler)
        
        # Setup file watcher in a separate thread
        watcher = FileWatcher(lambda: print("[FILE CHANGED]"), "..")
        watcher_thread = threading.Thread(target=watcher.watch, daemon=True)
        watcher_thread.start()
        
        # Print server info
        print(f"🚀 Server running at http://localhost:{self.port}")
        print(f"📁 Serving from: {os.path.abspath('.')}")
        print(f"👀 Watching for changes... (Press Ctrl+C to stop)")
        print()
        
        try:
            # Try to open browser
            webbrowser.open(f"http://localhost:{self.port}")
        except:
            pass
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n⛔ Server stopped.")
            watcher.watching = False
            sys.exit(0)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    server = DevelopmentServer(port=port)
    server.run()
