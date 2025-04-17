import cv2
import numpy as np
import time
import threading
import socketio
import base64
from ultralytics import YOLO
import io
from PIL import Image
import queue

# --- Configuration ---
MODEL_PATH = 'yolo11n.pt'  # Using your existing model
CONFIDENCE_THRESHOLD = 0.4  # Detection confidence threshold
VEHICLE_CLASSES = ['car', 'truck', 'bus', 'motorcycle', 'bicycle']  # Vehicle classes in COCO dataset
SOCKETIO_SERVER_URL = 'http://172.28.31.150:3001'
ENABLE_TRACKING = True  # Enable object tracking functionality
ENABLE_GPU = True  # Enable GPU acceleration if available

# Add tracking-related configurations
TRAIL_DURATION = 5.0  # Duration in seconds to show vehicle trails
MAX_TRAIL_POINTS = 30  # Maximum number of points to store per trail

# Add counting line configuration
ENABLE_COUNTING_LINE = True  # Enable the vehicle counting line
# Default position for counting line (horizontal line in the middle of the frame)
COUNTING_LINE_POSITION = 0.5  # Position of the line as ratio of frame height (0-1)
# Count in both directions
BIDIRECTIONAL_COUNTING = True  # Count vehicles in both directions

# Vehicle cropping configuration
ENABLE_VEHICLE_CROPPING = True  # Enable vehicle image cropping feature
CROP_EMIT_INTERVAL = 1.0  # Minimum interval (seconds) between emissions for the same vehicle
CROP_IMAGE_QUALITY = 85  # JPEG quality for cropped images (1-100)
CROP_MAX_SIZE = 300  # Maximum dimension for cropped images

# Initialize Socket.IO client
sio = socketio.Client(reconnection=True, reconnection_attempts=0, reconnection_delay=1, reconnection_delay_max=5000)
print(f"Initializing Socket.IO client to connect to {SOCKETIO_SERVER_URL}")

# Global variables
running = True
connected = False  # Track connection status
model = None
last_frame_time = 0
MAX_FPS = 20  # Maximum frames per second

# Queue for model processing
model_frame_queue = queue.Queue(maxsize=2)

# Global variables for tracking
vehicle_tracks = {}  # Dictionary to store tracking information: {track_id: [positions]}

# Global variables for vehicle counting
counted_vehicles = {}  # Dictionary to store counted vehicle IDs to avoid double counting
# Separate counts by direction
vehicle_counts_up = {vehicle_type: 0 for vehicle_type in VEHICLE_CLASSES}
vehicle_counts_down = {vehicle_type: 0 for vehicle_type in VEHICLE_CLASSES}
total_counted_up = 0
total_counted_down = 0

# Actual counting line coordinates (will be set based on frame dimensions)
counting_line_y = None
counting_line_start_x = None
counting_line_end_x = None

# Function to check if a vehicle has crossed the counting line
def check_line_crossing(prev_pos, curr_pos, line_y):
    """Check if a vehicle has crossed the counting line between two positions"""
    prev_y = prev_pos[1]
    curr_y = curr_pos[1]
    
    # Return direction: 1 for downward, -1 for upward, 0 for no crossing
    if prev_y <= line_y and curr_y > line_y:
        return 1  # Downward crossing
    elif prev_y >= line_y and curr_y < line_y:
        return -1  # Upward crossing
    return 0  # No crossing

# Global variables for vehicle image cropping
last_vehicle_crop_times = {}  # Store last emission time for each vehicle ID

def crop_vehicle_image(frame, bbox, vehicle_id, vehicle_class):
    """Crop a vehicle image from the frame using bounding box coordinates"""
    # Extract bounding box coordinates
    x1, y1, x2, y2 = map(int, bbox)
    
    # Add some padding to the bounding box (10% on each side)
    h, w = frame.shape[:2]
    padding_x = int((x2 - x1) * 0.1)
    padding_y = int((y2 - y1) * 0.1)
    
    # Apply padding with bounds checking
    x1 = max(0, x1 - padding_x)
    y1 = max(0, y1 - padding_y)
    x2 = min(w, x2 + padding_x)
    y2 = min(h, y2 + padding_y)
    
    # Crop the image
    cropped_img = frame[y1:y2, x1:x2]
    
    # Resize if the cropped image is too large
    height, width = cropped_img.shape[:2]
    if width > CROP_MAX_SIZE or height > CROP_MAX_SIZE:
        scale = CROP_MAX_SIZE / max(width, height)
        new_width = int(width * scale)
        new_height = int(height * scale)
        cropped_img = cv2.resize(cropped_img, (new_width, new_height))
    
    # Convert to RGB for PIL
    cropped_img_rgb = cv2.cvtColor(cropped_img, cv2.COLOR_BGR2RGB)
    
    # Convert to PIL Image
    pil_img = Image.fromarray(cropped_img_rgb)
    
    # Convert to JPEG buffer
    buffer = io.BytesIO()
    pil_img.save(buffer, format="JPEG", quality=CROP_IMAGE_QUALITY)
    
    # Return the buffer value directly (not base64 encoded)
    buffer_value = buffer.getvalue()
    
    vehicle_data = {
        'vehicle_id': vehicle_id,
        'class': vehicle_class,
        'image_data': buffer_value,  # Raw buffer instead of base64
        'timestamp': time.time()
    }
    
    return vehicle_data

def process_frames_thread():
    """Thread function to process frames with the model in the background"""
    global running, model, vehicle_tracks, counted_vehicles
    global vehicle_counts_up, vehicle_counts_down, total_counted_up, total_counted_down
    global counting_line_y, counting_line_start_x, counting_line_end_x
    global last_vehicle_crop_times
    
    print("Starting frame processing thread")
    
    while running:
        try:
            # Try to get a frame from the model queue, non-blocking
            try:
                frame_data = model_frame_queue.get(block=False)
                if frame_data is None:
                    time.sleep(0.01)
                    continue
            except queue.Empty:
                time.sleep(0.01)
                continue
            
            frame, timestamp = frame_data
            
            # Skip processing if model isn't loaded
            if model is None:
                time.sleep(0.01)
                continue
                
            # Process the frame with YOLO tracking instead of detection
            start_time = time.time()
            results = model.track(frame, persist=True, verbose=False) if ENABLE_TRACKING else model(frame, verbose=False)
            inference_time = (time.time() - start_time) * 1000  # Convert to milliseconds
            
            height, width = frame.shape[:2]
            
            # Initialize or update counting line coordinates if needed
            if ENABLE_COUNTING_LINE and (counting_line_y is None or counting_line_start_x is None or counting_line_end_x is None):
                counting_line_y = int(height * COUNTING_LINE_POSITION)
                counting_line_start_x = 0
                counting_line_end_x = width
                print(f"Counting line initialized at y={counting_line_y}")
            
            # Process detection results
            detected_objects = []
            current_tracks = {}  # Store current positions for each track ID
            
            # Vehicle count by type for display
            vehicle_counts = {vehicle_type: 0 for vehicle_type in VEHICLE_CLASSES}
            
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    confidence = float(box.conf[0])
                    cls_id = int(box.cls[0])
                    
                    # Check if the detected object is a vehicle and meets confidence threshold
                    if cls_id in model.names and model.names[cls_id] in VEHICLE_CLASSES and confidence >= CONFIDENCE_THRESHOLD:
                        # Get bounding box coordinates
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        
                        # Calculate center point of the bounding box for tracking
                        center_x = (x1 + x2) // 2
                        center_y = (y1 + y2) // 2
                        
                        # Get track ID if available (for tracking)
                        track_id = None
                        if ENABLE_TRACKING and hasattr(box, 'id') and box.id is not None:
                            try:
                                track_id = int(box.id[0])
                            except:
                                track_id = None
                        
                        # Calculate relative coordinates (0-1 range)
                        rel_x1 = x1 / width
                        rel_y1 = y1 / height
                        rel_x2 = x2 / width
                        rel_y2 = y2 / height
                        
                        class_name = model.names[cls_id]
                        
                        # Add detection to results with track_id if available
                        detection_info = {
                            'class': class_name,
                            'confidence': float(confidence),
                            'bbox': {
                                'x1': float(rel_x1),  # Normalized coordinates (0-1)
                                'y1': float(rel_y1),
                                'x2': float(rel_x2),
                                'y2': float(rel_y2),
                                'width': float(rel_x2 - rel_x1),
                                'height': float(rel_y2 - rel_y1)
                            }
                        }

                        # Add track_id if available
                        if track_id is not None:
                            detection_info['track_id'] = track_id
                        
                        detected_objects.append(detection_info)
                        
                        # Update vehicle count
                        vehicle_counts[class_name] += 1
                            
                        if track_id is not None:
                            # Add to current tracks
                            current_time = time.time()
                            current_tracks[track_id] = {
                                'position': (center_x, center_y),
                                'time': current_time,
                                'class': class_name
                            }
                            
                            # Emit cropped vehicle image if enabled and it's time to emit
                            if ENABLE_VEHICLE_CROPPING:
                                current_time = time.time()
                                if (track_id not in last_vehicle_crop_times or 
                                    current_time - last_vehicle_crop_times.get(track_id, 0) >= CROP_EMIT_INTERVAL):
                                    
                                    # Crop and emit vehicle image
                                    try:
                                        vehicle_img_data = crop_vehicle_image(
                                            frame, 
                                            [x1, y1, x2, y2], 
                                            track_id, 
                                            class_name
                                        )
                                        
                                        # Emit the vehicle image with its ID (raw buffer)
                                        sio.emit('car', vehicle_img_data)
                                        
                                        # Update the last emission time for this vehicle
                                        last_vehicle_crop_times[track_id] = current_time
                                        
                                        print(f"Emitted cropped image for {class_name} ID: {track_id}")
                                    except Exception as e:
                                        print(f"Error cropping/emitting vehicle image: {e}")
            
            # Update vehicle tracking history and check for line crossings
            current_time = time.time()
            new_crossings = []  # Track IDs of vehicles that just crossed the line with direction
            
            # Update positions for existing tracks
            for track_id, track_info in current_tracks.items():
                current_position = track_info['position']
                current_class = track_info['class']
                
                if track_id not in vehicle_tracks:
                    vehicle_tracks[track_id] = []
                
                # Check for line crossing if we have previous positions and counting is enabled
                if ENABLE_COUNTING_LINE and len(vehicle_tracks[track_id]) > 0 and counting_line_y is not None:
                    prev_position = vehicle_tracks[track_id][-1]['position']
                    
                    # Check if and in which direction this vehicle has crossed the line
                    crossing_direction = check_line_crossing(prev_position, current_position, counting_line_y)
                    
                    # If vehicle crossed the line in either direction
                    if crossing_direction != 0:
                        # For each track_id, we count once per direction
                        crossing_key = f"{track_id}_{crossing_direction}"
                        if crossing_key not in counted_vehicles:
                            counted_vehicles[crossing_key] = True
                            
                            # Update the appropriate counter based on direction
                            if crossing_direction == 1:  # Downward
                                vehicle_counts_down[current_class] += 1
                                total_counted_down += 1
                                crossing_name = "down"
                            else:  # Upward
                                vehicle_counts_up[current_class] += 1
                                total_counted_up += 1
                                crossing_name = "up"
                                
                            # Add to list of new crossings for highlighting
                            new_crossings.append((track_id, crossing_direction))
                            print(f"Vehicle {track_id} ({current_class}) crossed {crossing_name}. " +
                                  f"Up: {total_counted_up}, Down: {total_counted_down}")
                
                # Add new position
                vehicle_tracks[track_id].append({
                    'position': current_position,
                    'time': track_info['time'],
                    'class': current_class
                })
                
                # Keep only recent points within TRAIL_DURATION
                vehicle_tracks[track_id] = [
                    point for point in vehicle_tracks[track_id]
                    if current_time - point['time'] <= TRAIL_DURATION
                ]
                
                # Limit the number of points to prevent excessive memory use
                if len(vehicle_tracks[track_id]) > MAX_TRAIL_POINTS:
                    vehicle_tracks[track_id] = vehicle_tracks[track_id][-MAX_TRAIL_POINTS:]
            
            # Clean up old tracks that are no longer seen
            for track_id in list(vehicle_tracks.keys()):
                if not vehicle_tracks[track_id] or current_time - vehicle_tracks[track_id][-1]['time'] > TRAIL_DURATION:
                    del vehicle_tracks[track_id]
                    
            # Prepare response with detection results
            response = {
                'detections': detected_objects,
                'inference_time': inference_time,
                'image_dimensions': {
                    'width': width,
                    'height': height
                },
                'timestamp': timestamp,
                'vehicle_count': {
                    'total_up': total_counted_up,
                    'total_down': total_counted_down,
                    'by_type_up': vehicle_counts_up,
                    'by_type_down': vehicle_counts_down,
                    'current': vehicle_counts
                },
                'counting_line': {
                    'y': counting_line_y,
                    'start_x': counting_line_start_x,
                    'end_x': counting_line_end_x
                },
                'tracks': [
                    {
                        'id': track_id,
                        'positions': [
                            {'x': point['position'][0], 'y': point['position'][1], 'time': point['time']}
                            for point in track_data
                        ],
                        'class': track_data[-1]['class'] if track_data else None
                    }
                    for track_id, track_data in vehicle_tracks.items() if track_data
                ],
                'new_crossings': [
                    {'id': crossing[0], 'direction': crossing[1]}
                    for crossing in new_crossings
                ]
            }

            # Emit detection results back to the server
            sio.emit('giaothong', response)
            
            print(f"Processed image, found {len(detected_objects)} vehicles, inference time: {inference_time:.2f}ms")
            
            # Display vehicle count summary
            if detected_objects:
                count_summary = ", ".join([f"{count} {v_type}{'s' if count != 1 else ''}" 
                                         for v_type, count in vehicle_counts.items() if count > 0])
                print(f"Vehicle counts: {count_summary}")
                    
        except Exception as e:
            print(f"Error in processing thread: {e}")
            time.sleep(0.1)  # Prevent tight loop if there's an error
    
    print("Frame processing thread stopped")

def load_model():
    global model
    print(f"Loading YOLO model: {MODEL_PATH}")
    try:
        # Check for tracking dependencies if tracking is enabled
        if ENABLE_TRACKING:
            try:
                import sys
                import subprocess
                import pkg_resources
                
                # Check if tracking packages are installed
                required_packages = {"ultralytics[track]"}
                installed = {pkg.key for pkg in pkg_resources.working_set}
                missing = required_packages - installed
                
                if missing:
                    print("Installing required packages for tracking...")
                    subprocess.check_call([sys.executable, "-m", "pip", "install", "ultralytics[track]"])
                    print("Tracking packages installed successfully!")
                
                print("Initializing model with tracking capability...")
            except Exception as e:
                print(f"Warning: Could not set up tracking dependencies: {e}")
                print("Falling back to detection-only mode.")

        # Check GPU availability
        device = 'cpu'  # Default to CPU
        if ENABLE_GPU:
            try:
                import torch
                if torch.cuda.is_available():
                    device = 'cuda'
                    gpu_name = torch.cuda.get_device_name(0)
                    print(f"CUDA is available. Using GPU: {gpu_name}")
                    print(f"CUDA version: {torch.version.cuda}")
                else:
                    print("CUDA is not available. Falling back to CPU.")
            except ImportError:
                print("PyTorch not properly installed. Falling back to CPU.")
            except Exception as e:
                print(f"Error checking GPU: {e}. Falling back to CPU.")

        # Load the model with the selected device
        print(f"Loading model on device: {device}")
        model = YOLO(MODEL_PATH)
        model.to(device)
        print(f"Model loaded successfully! Running on: {device}")
        print(f"Available classes: {model.names}")
        
        # Print vehicle classes that will be detected
        vehicle_class_ids = [id for id, name in model.names.items() if name in VEHICLE_CLASSES]
        print(f"Vehicle classes to detect (class IDs): {vehicle_class_ids}")
        print(f"Vehicle class names: {[model.names[id] for id in vehicle_class_ids]}")
        
        # Start the processing thread
        processing_thread = threading.Thread(target=process_frames_thread, daemon=True)
        processing_thread.start()
        print("Frame processing thread started")
            
        return True
    except Exception as e:
        print(f"Failed to load model: {e}")
        return False

@sio.event
def connect():
    global connected
    connected = True
    print(f"Successfully connected to Socket.IO server: {SOCKETIO_SERVER_URL}")
    print("Waiting for 'image' events...")

@sio.event
def connect_error(error):
    print(f"Connection error: {error}")

@sio.event
def disconnect():
    global connected
    connected = False
    print("Disconnected from Socket.IO server")
    print("Will attempt to reconnect automatically...")

@sio.on('image')
def on_image(data):
    global last_frame_time
    
    # Limit frame processing rate to avoid overload
    current_time = time.time()
    if current_time - last_frame_time < 1.0/MAX_FPS:
        return  # Skip this frame to maintain reasonable frame rate
    
    last_frame_time = current_time
    
    try:
        # Convert image data from buffer to numpy array
        if isinstance(data, dict) and 'image' in data:
            # If data is a dictionary with 'image' key
            image_data = data['image']
        else:
            # If data is directly the image buffer
            image_data = data
        
        # Convert the received image data to numpy array
        if isinstance(image_data, str):
            # If it's a base64 encoded string
            image_bytes = base64.b64decode(image_data)
        else:
            # If it's already a binary
            image_bytes = image_data
        
        # Convert bytes to image
        try:
            image = Image.open(io.BytesIO(image_bytes))
            # Convert PIL image to OpenCV format (RGB to BGR)
            frame = np.array(image)
            frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        except Exception as e:
            print(f"Error decoding image: {e}")
            return
        
        # Get frame dimensions
        height, width = frame.shape[:2]
        
        # Resize the frame if it's too large to save memory
        max_dimension = 1280  # Maximum dimension to process
        if width > max_dimension or height > max_dimension:
            scale = max_dimension / max(width, height)
            frame = cv2.resize(frame, (int(width * scale), int(height * scale)))
        
        # Add the frame to the model processing queue
        try:
            model_frame_queue.put((frame.copy(), time.time()), block=False)
        except queue.Full:
            # If model queue is full, just discard this frame for processing
            pass
    
    except Exception as e:
        print(f"Error processing image: {e}")
        # Send error response
        sio.emit('giaothong', {'error': str(e)})

def maintain_connection():
    """Thread to manage Socket.IO connection and auto-reconnect"""
    global connected, running
    
    while running:
        try:
            if not connected:
                try:
                    print(f"Attempting to connect to Socket.IO server at {SOCKETIO_SERVER_URL}...")
                    sio.connect(SOCKETIO_SERVER_URL, transports=['websocket'], wait=False)
                except Exception as e:
                    print(f"Failed to connect: {e}")
                    time.sleep(5)  # Wait before retry
            time.sleep(1)  # Check connection status periodically
        except Exception as e:
            print(f"Connection manager error: {e}")
            time.sleep(1)

def main():
    global running
    
    # Load YOLO model
    if not load_model():
        print("Failed to load model. Exiting...")
        return
    
    # Start connection manager thread
    connection_thread = threading.Thread(target=maintain_connection, daemon=True)
    connection_thread.start()
    print("Connection manager started")
    
    # Keep the main thread running
    try:
        while running:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Interrupted by user. Shutting down...")
    finally:
        running = False
        try:
            if sio.connected:
                sio.disconnect()
        except Exception as e:
            print(f"Error during disconnect: {e}")
        print("Server stopped.")

if __name__ == "__main__":
    main()
