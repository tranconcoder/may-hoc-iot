import time
import io
import sys
import numpy as np
from PIL import Image, ImageGrab
import mss
import mss.tools

class ScreenRecorder:
    def __init__(self, window_info, websocket_client, fps=15):
        self.window_info = window_info
        self.websocket_client = websocket_client
        self.fps = fps
        self.is_recording = False
        self.platform = sys.platform
    
    def start_recording(self):
        self.is_recording = True
        
        # Wait for WebSocket to connect
        while not self.websocket_client.is_connected:
            time.sleep(0.5)
            
        if self.platform == 'win32':
            self._record_windows()
        elif self.platform == 'darwin':
            self._record_macos()
        else:
            self._record_linux()
    
    def stop_recording(self):
        self.is_recording = False
    
    def _record_windows(self):
        import win32gui
        hwnd = self.window_info['hwnd']
        
        with mss.mss() as sct:
            while self.is_recording:
                start_time = time.time()
                
                # Get window position and size
                rect = win32gui.GetWindowRect(hwnd)
                x, y, right, bottom = rect
                width = right - x
                height = bottom - y
                
                # Capture screenshot
                monitor = {"top": y, "left": x, "width": width, "height": height}
                screenshot = sct.grab(monitor)
                
                # Convert to JPEG
                img = Image.frombytes("RGB", screenshot.size, screenshot.bgra, "raw", "BGRX")
                self._send_image(img)
                
                # Maintain FPS
                self._sleep_for_fps(start_time)
    
    def _record_macos(self):
        while self.is_recording:
            start_time = time.time()
            
            # On macOS we can only capture the entire screen for now
            # Future improvement: use PyObjC for window-specific capture
            screenshot = ImageGrab.grab()
            self._send_image(screenshot)
            
            # Maintain FPS
            self._sleep_for_fps(start_time)
    
    def _record_linux(self):
        with mss.mss() as sct:
            # On Linux we need window geometry
            # This is a simplified version, might need adjustment based on window manager
            monitor = sct.monitors[1]  # Default to first monitor
            
            while self.is_recording:
                start_time = time.time()
                
                screenshot = sct.grab(monitor)
                img = Image.frombytes("RGB", screenshot.size, screenshot.bgra, "raw", "BGRX")
                self._send_image(img)
                
                # Maintain FPS
                self._sleep_for_fps(start_time)
    
    def _send_image(self, img):
        # Resize if the image is too large (optional)
        max_dim = 640
        if img.width > max_dim or img.height > max_dim:
            ratio = min(max_dim / img.width, max_dim / img.height)
            new_width = int(img.width * ratio)
            new_height = int(img.height * ratio)
            img = img.resize((new_width, new_height), Image.LANCZOS)
        
        # Convert to bytes
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=70)
        img_bytes = buffer.getvalue()
        
        # Send via WebSocket
        self.websocket_client.send_frame(img_bytes)
    
    def _sleep_for_fps(self, start_time):
        frame_time = 1.0 / self.fps
        elapsed = time.time() - start_time
        sleep_time = max(0, frame_time - elapsed)
        if sleep_time > 0:
            time.sleep(sleep_time)
