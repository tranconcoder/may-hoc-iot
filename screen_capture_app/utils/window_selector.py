import tkinter as tk
from tkinter import ttk
import sys

# Get full screen dimensions based on platform
if sys.platform == 'win32':
    import win32gui
    import win32api
    def get_screen_info():
        width = win32api.GetSystemMetrics(0)  # SM_CXSCREEN
        height = win32api.GetSystemMetrics(1)  # SM_CYSCREEN
        return {
            'title': 'Full Screen',
            'left': 0,
            'top': 0,
            'width': width,
            'height': height
        }
elif sys.platform == 'darwin':  # macOS
    try:
        from AppKit import NSScreen
        def get_screen_info():
            screen = NSScreen.mainScreen()
            frame = screen.frame()
            return {
                'title': 'Full Screen',
                'left': 0,
                'top': 0,
                'width': int(frame.size.width),
                'height': int(frame.size.height)
            }
    except ImportError:
        def get_screen_info():
            # Fallback to getting screen size from tkinter
            root = tk.Tk()
            width = root.winfo_screenwidth()
            height = root.winfo_screenheight()
            root.destroy()
            return {
                'title': 'Full Screen',
                'left': 0,
                'top': 0,
                'width': width,
                'height': height
            }
else:  # Linux
    try:
        import Xlib.display
        def get_screen_info():
            display = Xlib.display.Display()
            screen = display.screen()
            width = screen.width_in_pixels
            height = screen.height_in_pixels
            return {
                'title': 'Full Screen',
                'left': 0,
                'top': 0,
                'width': width,
                'height': height
            }
    except ImportError:
        def get_screen_info():
            # Fallback to getting screen size from tkinter
            root = tk.Tk()
            width = root.winfo_screenwidth()
            height = root.winfo_screenheight()
            root.destroy()
            return {
                'title': 'Full Screen',
                'left': 0,
                'top': 0,
                'width': width,
                'height': height
            }

class WindowSelector:
    def __init__(self, parent):
        self.parent = parent
        self.selection_callback = None
        self.frame = tk.Frame(parent)
        self.frame.pack(fill=tk.BOTH, expand=True)
        
        # Create simplified UI for full screen capture
        self.label = tk.Label(
            self.frame, 
            text="Click the button below to start full screen capture:", 
            font=("Arial", 12)
        )
        self.label.pack(pady=20)
        
        # Screen info display
        self.screen_info = get_screen_info()
        info_frame = tk.Frame(self.frame)
        info_frame.pack(pady=10)
        
        tk.Label(info_frame, text=f"Screen Resolution: {self.screen_info['width']}x{self.screen_info['height']}", 
                font=("Arial", 11)).pack()
        
        # Button to start capture
        self.button_frame = tk.Frame(self.frame)
        self.button_frame.pack(fill=tk.X, pady=30)
        
        self.select_button = tk.Button(
            self.button_frame, 
            text="Start Full Screen Capture", 
            command=self.start_fullscreen_capture,
            font=("Arial", 11),
            bg="#4CAF50",
            fg="white",
            padx=20,
            pady=10
        )
        self.select_button.pack(padx=20)
    
    def refresh_windows(self):
        # This method is kept for backward compatibility
        # In the full screen version, we just refresh the screen info
        self.screen_info = get_screen_info()
    
    def start_fullscreen_capture(self):
        if self.selection_callback:
            self.selection_callback(self.screen_info)
    
    def select_window(self):
        # Backward compatibility - now just calls the full screen capture
        self.start_fullscreen_capture()
    
    def set_selection_callback(self, callback):
        self.selection_callback = callback
    
    def hide(self):
        self.frame.pack_forget()
    
    def show(self):
        self.frame.pack(fill=tk.BOTH, expand=True)
