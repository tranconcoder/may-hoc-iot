import cv2
import numpy as np
import time
import threading
import socketio
import base64
import io
from PIL import Image
import queue
import os
import sys
from pathlib import Path
from openvino.runtime import Core, Type, Layout
from openvino.preprocess import PrePostProcessor, ResizeAlgorithm

# --- Configuration ---
# OpenVINO model paths
MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'yolo11n_openvino_model')
DETECTION_MODEL_XML = os.path.join(MODEL_DIR, 'yolo11n.xml')
DETECTION_MODEL_BIN = os.path.join(MODEL_DIR, 'yolo11n.bin')

CONFIDENCE_THRESHOLD = 0.5
VEHICLE_CLASSES = ['car', 'truck', 'bus', 'motorcycle', 'bicycle']
SOCKETIO_SERVER_URL = 'wss://172.28.31.150:3000'
ENABLE_TRACKING = True
ENABLE_GPU = True

# Add tracking-related configurations
TRAIL_DURATION = 5.0
MAX_TRAIL_POINTS = 30

# Add counting line configuration
ENABLE_COUNTING_LINE = True
COUNTING_LINE_POSITION = 0.5
BIDIRECTIONAL_COUNTING = True

# Vehicle cropping configuration
ENABLE_VEHICLE_CROPPING = True
CROP_EMIT_INTERVAL = 1.0
CROP_IMAGE_QUALITY = 85
CROP_MAX_SIZE = 300

# Initialize Socket.IO client
sio = socketio.Client(reconnection=True, reconnection_attempts=0, reconnection_delay=1, reconnection_delay_max=5000, ssl_verify=False)
print(f"Initializing Socket.IO client to connect to {SOCKETIO_SERVER_URL}")

# Global variables
running = True
connected = False
model = None
last_frame_time = 0
MAX_FPS = 30

# Dictionary to manage queues and threads for each camera
camera_queues = {}
camera_threads = {}

# Global variables for vehicle counting
counted_vehicles = {}
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

class YOLODetector:
    """Class for YOLO model detection with OpenVINO based on official OpenVINO notebooks"""
    def __init__(self, model_xml, model_bin=None, device="GPU", conf_threshold=0.5):
        self.conf_threshold = conf_threshold
        self.class_names = VEHICLE_CLASSES
        self.input_size = (640, 640)  # Default YOLO input size
        
        # Load OpenVINO model
        self.ie = Core()
        self.load_model(model_xml, device)
        print(f"Available devices: {self.ie.available_devices}")
        
        # Dictionary for tracking
        self.tracks = {}
        self.next_id = 1

    def load_model(self, model_xml, device):
        """Load the OpenVINO IR model, handling both static and dynamic shapes"""
        try:
            # Read the model and weights from file
            print(f"Loading model on {device}...")
            model = self.ie.read_model(model=model_xml)
            
            # Force reshape for models with dynamic shapes
            # Find the input with dynamic shapes and set it to a fixed size
            for input in model.inputs:
                if input.partial_shape.is_dynamic:
                    print(f"Reshaping input {input.get_any_name()} to static shape")
                    model.reshape({input.get_any_name(): [1, 3, 640, 640]})
            
            # Compile the model for the specified device
            self.compiled_model = self.ie.compile_model(model=model, device_name=device)
            
            # Get input and output layers
            self.input_layer = next(iter(self.compiled_model.inputs))
            self.output_layer = next(iter(self.compiled_model.outputs))
            
            # Set input size based on the model
            self.input_h, self.input_w = 640, 640  # Default size
            
            # Try to get the actual shape if it's not dynamic
            try:
                shape = self.input_layer.shape
                if len(shape) == 4:  # NCHW format
                    _, _, self.input_h, self.input_w = shape
            except Exception as e:
                print(f"Could not get input shape (using default): {e}")
            
            self.input_size = (self.input_w, self.input_h)
            print(f"Model loaded successfully with input size: {self.input_size}")
            print(f"Model output shape: {self.output_layer.shape}")
            
        except Exception as e:
            print(f"Error loading the model: {e}")
            raise

    def preprocess(self, frame):
        """Preprocess the input frame for inference"""
        # Convert to RGB (OpenVINO models typically expect RGB)
        if frame.shape[2] == 3:
            input_img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        else:
            input_img = frame
        
        # Resize preserving aspect ratio and pad if necessary
        input_h, input_w = self.input_size
        h, w = frame.shape[:2]
        
        # Calculate scale and new dimensions
        scale = min(input_h / h, input_w / w)
        new_h, new_w = int(h * scale), int(w * scale)
        
        # Resize the image
        resized = cv2.resize(input_img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        
        # Create padded version (top, bottom, left, right)
        pad_h = input_h - new_h
        pad_w = input_w - new_w
        top = pad_h // 2
        bottom = pad_h - top
        left = pad_w // 2
        right = pad_w - left
        
        # Add padding
        padded = cv2.copyMakeBorder(
            resized, top, bottom, left, right, 
            cv2.BORDER_CONSTANT, value=(114, 114, 114)
        )
        
        # Convert to float32 and normalize to 0-1
        padded = padded.astype(np.float32) / 255.0
        
        # Transpose to NCHW format (batch, channels, height, width)
        input_tensor = np.transpose(padded, (2, 0, 1))
        input_tensor = np.expand_dims(input_tensor, 0)
        
        return input_tensor, (scale, (top, left))

    def postprocess(self, predictions, original_shape, preprocess_info):
        """Process output from the model to get bounding boxes"""
        scale, (pad_t, pad_l) = preprocess_info
        orig_h, orig_w = original_shape[:2]
        
        boxes = []
        
        # YOLOv8 output format (assumes standard YOLOv8 output)
        if len(predictions.shape) == 3 and predictions.shape[2] > 5:  # [batch, num_detections, 5+num_classes]
            for i in range(predictions.shape[1]):
                confidence = float(predictions[0, i, 4])
                
                if confidence < self.conf_threshold:
                    continue
                
                # Get class with highest confidence
                class_scores = predictions[0, i, 5:]
                class_id = int(np.argmax(class_scores))
                class_conf = float(class_scores[class_id])
                
                if class_id >= len(VEHICLE_CLASSES):
                    # Skip classes not in our VEHICLE_CLASSES list
                    continue
                    
                # Only keep vehicle classes we're interested in (mapping COCO to our vehicle classes)
                coco_vehicle_ids = {2: 'car', 5: 'bus', 7: 'truck', 3: 'motorcycle', 1: 'bicycle'}
                if class_id not in coco_vehicle_ids:
                    continue
                    
                # Map class_id from COCO to our vehicle class index
                mapped_class = None
                for idx, v_class in enumerate(VEHICLE_CLASSES):
                    if v_class == coco_vehicle_ids.get(class_id):
                        mapped_class = idx
                        break
                
                if mapped_class is None:
                    continue
                
                # Bounding box coordinates (normalized 0-1)
                x, y, w, h = predictions[0, i, 0:4]
                
                # Convert from center format to corner format
                x1 = (x - w/2)
                y1 = (y - h/2)
                x2 = (x + w/2)
                y2 = (y + h/2)
                
                # Remove padding and rescale to original image dimensions
                x1 = (x1 * self.input_size[0] - pad_l) / scale
                y1 = (y1 * self.input_size[1] - pad_t) / scale
                x2 = (x2 * self.input_size[0] - pad_l) / scale
                y2 = (y2 * self.input_size[1] - pad_t) / scale
                
                # Clip bounding box to image
                x1 = max(0, min(x1, orig_w))
                y1 = max(0, min(y1, orig_h))
                x2 = max(0, min(x2, orig_w))
                y2 = max(0, min(y2, orig_h))
                
                # Save the detection
                boxes.append([x1, y1, x2, y2, confidence * class_conf, mapped_class])
        
        return boxes

    def detect(self, frame, verbose=False):
        """Detect objects in a frame"""
        original_shape = frame.shape
        
        # Preprocess the frame
        input_tensor, preprocess_info = self.preprocess(frame)
        
        # Run inference
        start_time = time.time()
        results = self.compiled_model([input_tensor])[self.output_layer]
        if verbose:
            print(f"Inference time: {(time.time() - start_time) * 1000:.2f} ms")
        
        # Process detections
        boxes = self.postprocess(results, original_shape, preprocess_info)
        
        return boxes

    def track(self, frame, persist=True, verbose=False):
        """Track objects across frames"""
        boxes = self.detect(frame, verbose)
        height, width = frame.shape[:2]
        
        # Current detections for assignment
        current_detections = []
        for box in boxes:
            x1, y1, x2, y2, confidence, class_id = box
            # Calculate center point for tracking
            center_x = (x1 + x2) / 2
            center_y = (y1 + y2) / 2
            current_detections.append({
                'bbox': [x1, y1, x2, y2],
                'center': (center_x, center_y),
                'confidence': confidence,
                'class_id': class_id,
                'assigned': False  # Flag for tracking assignment
            })
        
        # Simple tracking based on center distance
        # First, update existing tracks with new detections
        current_time = time.time()
        active_track_ids = []
        
        # Match detections to existing tracks
        for track_id, track in self.tracks.items():
            if current_time - track['last_seen'] > 1.0 and not persist:  # Remove tracks not seen for more than 1 second
                continue
                
            closest_detection_idx = -1
            min_distance = float('inf')
            
            # Find the closest detection to this track
            for i, detection in enumerate(current_detections):
                if detection['assigned']:
                    continue
                    
                # Calculate distance between track and detection
                track_center = track['center']
                detection_center = detection['center']
                distance = np.sqrt((track_center[0] - detection_center[0])**2 + 
                                   (track_center[1] - detection_center[1])**2)
                
                # If the distance is below threshold, consider it a match
                if distance < min(width, height) * 0.1 and distance < min_distance:  # 10% of image size as threshold
                    min_distance = distance
                    closest_detection_idx = i
            
            # If a match is found, update the track
            if closest_detection_idx >= 0:
                detection = current_detections[closest_detection_idx]
                self.tracks[track_id] = {
                    'bbox': detection['bbox'],
                    'center': detection['center'],
                    'confidence': detection['confidence'],
                    'class_id': detection['class_id'],
                    'last_seen': current_time
                }
                current_detections[closest_detection_idx]['assigned'] = True
                active_track_ids.append(track_id)
            elif persist:  # Keep the track if persistence is enabled
                active_track_ids.append(track_id)
                self.tracks[track_id]['last_seen'] = current_time  # Update last seen time
        
        # Create new tracks for unassigned detections
        for detection in current_detections:
            if not detection['assigned']:
                self.tracks[self.next_id] = {
                    'bbox': detection['bbox'],
                    'center': detection['center'],
                    'confidence': detection['confidence'],
                    'class_id': detection['class_id'],
                    'last_seen': current_time
                }
                active_track_ids.append(self.next_id)
                self.next_id += 1
        
        # Format results similar to YOLO output
        results = []
        for track_id in active_track_ids:
            track = self.tracks[track_id]
            # Create a result object with boxes property
            result = {
                'boxes': {
                    'xyxy': [track['bbox']],
                    'conf': [track['confidence']],
                    'cls': [track['class_id']],
                    'id': [track_id]
                }
            }
            results.append(result)
        
        return results

def process_frames_thread(camera_id):
    """Thread function to process frames for a specific camera"""
    global running, model
    # Each camera will have its own tracking/counter state
    vehicle_tracks = {}
    counted_vehicles = {}
    vehicle_counts_up = {vehicle_type: 0 for vehicle_type in VEHICLE_CLASSES}
    vehicle_counts_down = {vehicle_type: 0 for vehicle_type in VEHICLE_CLASSES}
    total_counted_up = 0
    total_counted_down = 0
    counting_line_y = None
    counting_line_start_x = None
    counting_line_end_x = None
    last_vehicle_crop_times = {}
    print(f"Starting frame processing thread for camera {camera_id}")
    while running:
        try:
            try:
                frame_data = camera_queues[camera_id].get(block=True, timeout=0.1)
                if frame_data is None:
                    time.sleep(0.01)
                    continue
            except queue.Empty:
                continue
            frame, cameraId, imageId, created_at, track_line_y = frame_data
            # Skip processing if model isn't loaded
            if model is None:
                time.sleep(0.01)
                continue
            
            # Process the frame with OpenVINO tracking
            start_time = time.time()
            results = model.track(frame, persist=True, verbose=False) if ENABLE_TRACKING else model.detect(frame, verbose=False)
            inference_time = (time.time() - start_time) * 1000  # Convert to milliseconds
            
            height, width = frame.shape[:2]
            
            # Initialize or update counting line coordinates if needed
            if ENABLE_COUNTING_LINE and (counting_line_y is None or counting_line_start_x is None or counting_line_end_x is None):
                counting_line_y = int(height * COUNTING_LINE_POSITION)
                counting_line_start_x = 0
                counting_line_end_x = width
                print(f"[Camera {camera_id}] Counting line initialized at y={counting_line_y}")
            
            # Process detection results
            detected_objects = []
            current_tracks = {}  # Store current positions for each track ID
            
            # Vehicle count by type for display
            vehicle_counts = {vehicle_type: 0 for vehicle_type in VEHICLE_CLASSES}
            
            # For detect mode (not tracking)
            if not ENABLE_TRACKING:
                # Process raw detections
                for box in results:
                    x1, y1, x2, y2, confidence, cls_id = box
                    
                    # Check confidence threshold
                    if confidence < CONFIDENCE_THRESHOLD:
                        continue
                    
                    # Make sure class ID is valid
                    if cls_id >= len(VEHICLE_CLASSES):
                        continue
                    
                    # Calculate center point of the bounding box
                    center_x = (x1 + x2) // 2
                    center_y = (y1 + y2) // 2
                    
                    # Calculate relative coordinates (0-1 range)
                    rel_x1 = x1 / width
                    rel_y1 = y1 / height
                    rel_x2 = x2 / width
                    rel_y2 = y2 / height
                    
                    class_name = VEHICLE_CLASSES[int(cls_id)]
                    
                    # Add detection to results
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
                    
                    detected_objects.append(detection_info)
                    
                    # Update vehicle count
                    vehicle_counts[class_name] += 1
            
            # For tracking mode
            else:
                for result in results:
                    boxes = result['boxes']
                    for i in range(len(boxes['xyxy'])):
                        confidence = float(boxes['conf'][i])
                        cls_id = int(boxes['cls'][i])
                        
                        # Check if the detected object is a vehicle and meets confidence threshold
                        if cls_id < len(VEHICLE_CLASSES) and confidence >= CONFIDENCE_THRESHOLD:
                            # Get bounding box coordinates
                            x1, y1, x2, y2 = map(int, boxes['xyxy'][i])
                            
                            # Calculate center point of the bounding box for tracking
                            center_x = (x1 + x2) // 2
                            center_y = (y1 + y2) // 2
                            
                            # Get track ID if available (for tracking)
                            track_id = None
                            if ENABLE_TRACKING and 'id' in boxes and boxes['id'] is not None:
                                try:
                                    track_id = int(boxes['id'][i])
                                except:
                                    track_id = None
                            
                            # Calculate relative coordinates (0-1 range)
                            rel_x1 = x1 / width
                            rel_y1 = y1 / height
                            rel_x2 = x2 / width
                            rel_y2 = y2 / height
                            
                            class_name = VEHICLE_CLASSES[cls_id]
                            
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
                                detection_info['id'] = track_id
                            
                            detected_objects.append(detection_info)
                            
                            # Update vehicle count
                            vehicle_counts[class_name] += 1
                                
                            if track_id is not None:
                                # Add to current tracks
                                current_tracks[track_id] = {
                                    'position': (center_x, center_y),
                                    'time': created_at,
                                    'class': class_name
                                }
            
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
                            print(f"[Camera {camera_id}] Vehicle {track_id} ({current_class}) crossed {crossing_name}. " +
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
                'camera_id': cameraId,
                'image_id': imageId,
                'track_line_y': track_line_y,
                'detections': detected_objects,
                'inference_time': inference_time,
                'image_dimensions': {
                    'width': width,
                    'height': height
                },
                'created_at': created_at,
                'vehicle_count': {
                    'total_up': total_counted_up,
                    'total_down': total_counted_down,
                    'by_type_up': vehicle_counts_up,
                    'by_type_down': vehicle_counts_down,
                    'current': vehicle_counts
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
            if len(detected_objects) > 0:
                sio.emit('car_detected', response)
            print(f"[Camera {camera_id}] Processed image, found {len(detected_objects)} vehicles, inference time: {inference_time:.2f}ms")
            
            # Display vehicle count summary
            if detected_objects:
                count_summary = ", ".join([f"{count} {v_type}{'s' if count != 1 else ''}" 
                                         for v_type, count in vehicle_counts.items() if count > 0])
                print(f"[Camera {camera_id}] Vehicle counts: {count_summary}")
                    
        except Exception as e:
            print(f"[Camera {camera_id}] Error in processing thread: {e}")
            import traceback
            print(traceback.format_exc())
            time.sleep(0.1)  # Prevent tight loop if there's an error
    
    print(f"[Camera {camera_id}] Frame processing thread stopped")

def load_model():
    global model
    print(f"Loading OpenVINO YOLO model: {DETECTION_MODEL_XML}")
    try:
        # Check for OpenVINO
        try:
            from openvino.runtime import Core
        except ImportError:
            print("Error: OpenVINO not installed. Please install it with:")
            print("pip install openvino openvino-dev")
            return False

        # Check device availability
        device = "CPU"  # Default to CPU
        if ENABLE_GPU:
            try:
                ie = Core()
                if "GPU" in ie.available_devices:
                    device = "GPU"
                    print(f"Intel GPU is available. Using device: {device}")
                else:
                    print("Intel GPU is not available. Available devices:")
                    for dev in ie.available_devices:
                        print(f" - {dev}")
                    print("Falling back to CPU.")
            except Exception as e:
                print(f"Error checking GPU: {e}. Falling back to CPU.")

        # Load the model with the selected device
        print(f"Loading model on device: {device}")
        
        # Check if the model file exists
        if not os.path.exists(DETECTION_MODEL_XML):
            print(f"Error: Model XML file not found at {DETECTION_MODEL_XML}")
            return False
            
        # Initialize our custom YOLODetector with OpenVINO
        model = YOLODetector(DETECTION_MODEL_XML, device=device, conf_threshold=CONFIDENCE_THRESHOLD)
        
        print(f"Model loaded successfully! Running on: {device}")
        print(f"Available classes: {VEHICLE_CLASSES}")
        
        # Start the processing thread
        for cameraId in camera_queues.keys():
            t = threading.Thread(target=process_frames_thread, args=(cameraId,), daemon=True)
            camera_threads[cameraId] = t
            t.start()
        print("Frame processing threads started")
            
        return True
    except Exception as e:
        print(f"Failed to load model: {e}")
        import traceback
        print(traceback.format_exc())
        return False

@sio.event
def connect():
    global connected
    connected = True
    print(f"Successfully connected to Socket.IO server: {SOCKETIO_SERVER_URL}")
    print("Waiting for 'image' events...")

    sio.emit("join_all_camera")

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
    
    image = data['buffer']
    cameraId = data['cameraId']
    imageId = data['imageId']
    created_at = data['created_at']
    track_line_y = data['track_line_y']
    
    try:
        # Convert image data from buffer to numpy array
        if isinstance(image, dict) and 'image' in image:
            # If data is a dictionary with 'image' key
            image_data = image['image']
        else:
            # If data is directly the image buffer
            image_data = image
        
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
        
        # Create queue and thread for new cameraId if not exist
        if cameraId not in camera_queues:
            camera_queues[cameraId] = queue.Queue(maxsize=10)
            t = threading.Thread(target=process_frames_thread, args=(cameraId,), daemon=True)
            camera_threads[cameraId] = t
            t.start()
        
        # Add the frame to the model processing queue
        try:
            camera_queues[cameraId].put((frame.copy(), cameraId, imageId, created_at, track_line_y), block=False)
        except queue.Full:
            # If model queue is full, just discard this frame for processing
            pass
    
    except Exception as e:
        print(f"Error processing image: {e}")
        import traceback
        print(traceback.format_exc())

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

def export_model_to_openvino():
    """
    Export PyTorch YOLO model to OpenVINO format.
    This function should be used once to convert your model.
    """
    try:
        from ultralytics import YOLO
        
        # Path to your YOLO model
        yolo_model_path = '../yolo11n.pt'
        
        print(f"Exporting YOLO model {yolo_model_path} to OpenVINO format...")
        
        # Load the YOLO model
        model = YOLO(yolo_model_path)
        
        # Define the output directory
        output_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        # Export the model to OpenVINO format
        success = model.export(format="openvino", dynamic=False, half=False, imgsz=640)
        
        if success:
            print(f"Model successfully exported to OpenVINO format in {output_dir}")
            print("You can now use the exported model with this script.")
            return True
        else:
            print("Failed to export model to OpenVINO format.")
            return False
            
    except Exception as e:
        print(f"Error exporting model to OpenVINO format: {e}")
        import traceback
        print(traceback.format_exc())
        return False

def main():
    global running
    
    # Check if OpenVINO model files exist, if not try to export from PyTorch
    if not os.path.exists(DETECTION_MODEL_XML):
        print("OpenVINO model files not found. Attempting to export from PyTorch model...")
        if not export_model_to_openvino():
            print("Could not export model to OpenVINO format. Please export manually or check paths.")
            print(f"Expected model files at: {DETECTION_MODEL_XML}")
            return
    
    # Load OpenVINO model
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