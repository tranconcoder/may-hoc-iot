import asyncio
import websockets
import threading
import time
import queue

class WebSocketClient:
    def __init__(self, uri):
        self.uri = uri
        self.websocket = None
        self.is_connected = False
        self.is_running = True
        self.frame_queue = queue.Queue(maxsize=10)
        
        # Start connection in a separate thread
        self.thread = threading.Thread(target=self._run_client)
        self.thread.daemon = True
        self.thread.start()
    
    def _run_client(self):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        while self.is_running:
            try:
                loop.run_until_complete(self._connect_and_process())
            except Exception as e:
                print(f"WebSocket error: {e}")
                time.sleep(2)  # Reconnection delay
    
    async def _connect_and_process(self):
        try:
            async with websockets.connect(self.uri) as ws:
                self.websocket = ws
                self.is_connected = True
                print(f"Connected to WebSocket server: {self.uri}")
                
                # Process frames from queue
                while self.is_running:
                    if not self.frame_queue.empty():
                        frame = self.frame_queue.get()
                        await ws.send(frame)
                    else:
                        await asyncio.sleep(0.01)  # Small delay to prevent CPU hogging
                        
        except Exception as e:
            print(f"WebSocket connection error: {e}")
            self.is_connected = False
            self.websocket = None
    
    def send_frame(self, frame_data):
        if self.is_connected:
            try:
                # Add frame to queue, discard if queue is full to prevent memory issues
                if not self.frame_queue.full():
                    self.frame_queue.put(frame_data, block=False)
            except queue.Full:
                pass  # Skip frame if queue is full
    
    def close(self):
        self.is_running = False
        self.is_connected = False
