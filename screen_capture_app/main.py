import tkinter as tk
from utils.window_selector import WindowSelector
from utils.screen_recorder import ScreenRecorder
from utils.websocket_client import WebSocketClient
import threading
import sys

class ScreenCaptureApp:
    def __init__(self, root, websocket_url):
        self.root = root
        self.root.title("Screen Capture Application")
        self.root.geometry("500x300")
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)
        
        self.ws_url = websocket_url
        self.ws_client = None
        self.recorder = None
        self.recording_active = False
        
        # Create UI
        self.label = tk.Label(root, text="Select an application window to capture and stream:", font=("Arial", 12))
        self.label.pack(pady=10)
        
        # Create window selector
        self.window_selector = WindowSelector(root)
        self.window_selector.set_selection_callback(self.on_window_selected)
        
    def on_window_selected(self, window_info):
        # Initialize WebSocket client
        self.ws_client = WebSocketClient(self.ws_url)
        
        # Start recording in a separate thread
        self.recorder = ScreenRecorder(window_info, self.ws_client)
        self.recording_thread = threading.Thread(target=self.recorder.start_recording)
        self.recording_thread.daemon = True
        self.recording_thread.start()
        
        # Update UI to show recording status
        self.window_selector.hide()
        self.show_recording_ui(window_info)
    
    def show_recording_ui(self, window_info):
        self.recording_frame = tk.Frame(self.root)
        self.recording_frame.pack(fill=tk.BOTH, expand=True)
        
        status_text = f"Recording: {window_info['title']}"
        self.status_label = tk.Label(self.recording_frame, text=status_text, font=("Arial", 12))
        self.status_label.pack(pady=20)
        
        self.stop_button = tk.Button(self.recording_frame, text="Stop Recording", command=self.stop_recording)
        self.stop_button.pack(pady=10)
    
    def stop_recording(self):
        if self.recorder:
            self.recorder.stop_recording()
        
        if self.ws_client:
            self.ws_client.close()
        
        # Show window selector again
        if hasattr(self, 'recording_frame'):
            self.recording_frame.destroy()
        
        self.window_selector.show()
        self.window_selector.refresh_windows()
    
    def on_close(self):
        if self.recorder:
            self.recorder.stop_recording()
        
        if self.ws_client:
            self.ws_client.close()
        
        self.root.destroy()
        sys.exit()

def main():
    root = tk.Tk()
    app = ScreenCaptureApp(root, "ws://192.168.1.17:3000?source=esp32cam_security_gate_send_img")
    root.mainloop()

if __name__ == "__main__":
    main()
