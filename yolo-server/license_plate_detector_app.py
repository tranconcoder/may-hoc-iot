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
import os

# --- Configuration ---
# FILL IN YOUR LICENSE PLATE MODEL PATH HERE
LICENSE_PLATE_MODEL_PATH = './models/license_plate_detector.pt'

# SocketIO server configuration (same as in server.py)
SOCKETIO_SERVER_URL = 'wss://100.121.193.6:3000'
ENABLE_GPU = True  # Enable GPU acceleration if available

# Detection configuration
CONFIDENCE_THRESHOLD = 0.5  # License plate detection confidence threshold
MAX_FPS = 30  # Maximum frames per second to process

# Initialize Socket.IO client
sio = socketio.Client()
print(f"Initializing Socket.IO client to connect to {SOCKETIO_SERVER_URL}")

# Global variables
running = True
model = None
last_processing_time = 0
model_queue = queue.Queue(maxsize=5)  # Queue for model processing
processed_vehicle_ids = set()  # To avoid processing the same vehicle multiple times

def load_model():
    """Load the YOLO license plate detection model"""
    global model
    
    if not os.path.exists(LICENSE_PLATE_MODEL_PATH):
        print(f"ERROR: Model file not found at {LICENSE_PLATE_MODEL_PATH}")
        print("Please update the LICENSE_PLATE_MODEL_PATH variable with the correct path")
        return False
    
    print(f"Loading license plate detection model: {LICENSE_PLATE_MODEL_PATH}")
    try:
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
        model = YOLO(LICENSE_PLATE_MODEL_PATH)
        model.to(device)
        print(f"Model loaded successfully! Running on: {device}")
        
        return True
    except Exception as e:
        print(f"Failed to load model: {e}")
        return False

def emit_license_plate_detection(vehicle_id, vehicle_class, plate_img, confidence, bbox):
    """Emit license plate detection information via socket.io instead of displaying in a window"""
    try:
        # Convert the plate image to buffer for sending
        _, plate_buffer = cv2.imencode('.jpg', plate_img)
        plate_data = plate_buffer.tobytes()
        
        # Create payload for the socket event
        detection_data = {
            'vehicle_id': vehicle_id,
            'vehicle_class': vehicle_class,
            'confidence': float(confidence),
            'bbox': bbox,
            'image_data': plate_data,
            'timestamp': time.time()
        }
        
        # Emit the license plate detection information
        sio.emit('license_plate', detection_data)
        
        print(f"Emitted 'license_plate_detected' event for vehicle {vehicle_id} ({vehicle_class}) - Confidence: {confidence:.2f}")
        return True
    except Exception as e:
        print(f"Error emitting license plate detection: {e}")
        return False

def process_license_plates_thread():
    """Background thread to process vehicle images for license plates"""
    global running, model
    
    print("Starting license plate detection thread")
    
    while running:
        try:
            # Try to get a car event from the queue, non-blocking
            try:
                car_img, cameraId, imageId, vehicleId, violationType = model_queue.get(block=False)
            except queue.Empty:
                time.sleep(0.01)
                continue
            
            # Skip processing if model isn't loaded
            if model is None:
                time.sleep(0.01)
                continue
            
            if not car_img or not vehicleId:
                continue  # Skip if missing required data
            
            # Convert buffer to image
            try:
                # Convert bytes to numpy array
                nparr = np.frombuffer(car_img, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if img is None:
                    print(f"Error: Could not decode image for vehicle {vehicleId}")
                    continue
            except Exception as e:
                print(f"Error decoding image: {e}")
                continue
            
            # Create a copy of the original image for visualization
            original_img = img.copy()
            
            # Process the frame with YOLO for license plate detection
            start_time = time.time()
            results = model(img, verbose=False)
            inference_time = (time.time() - start_time) * 1000  # ms
            
            # Get image dimensions
            height, width = img.shape[:2]
            
            # Process detection results
            license_plate = None

            print(results)
            
            for result in results:
                max_confidence = 0
                box = None

                for box in result.boxes:
                    confidence = float(box.conf[0])

                    if confidence > max_confidence:
                        max_confidence = confidence
                        box = box

                    confidence = float(box.conf[0])
                    
                    # Check if confidence meets threshold
                    if confidence >= CONFIDENCE_THRESHOLD:
                        # Get bounding box coordinates
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        
                        # Calculate normalized coordinates (0-1 range)
                        rel_x1 = x1 / width
                        rel_y1 = y1 / height
                        rel_x2 = x2 / width
                        rel_y2 = y2 / height
                        
                        # Draw bounding box on the original image
                        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
                        
                        # Add confidence text
                        conf_text = f"{confidence:.2f}"
                        cv2.putText(img, conf_text, (x1, y1-10), 
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                        
                        # Crop the license plate
                        plate_img = original_img[y1:y2, x1:x2]
                        
                        # Convert to buffer for sending
                        _, buffer = cv2.imencode('.jpg', plate_img)
                        plate_buffer = buffer.tobytes()
                        
                        # Create plate detection info
                        plate_info = {
                            'vehicle_id': vehicle_id,
                            'image_id': image_id,
                            'confidence': float(confidence),
                            'bbox': {
                                'x1': float(rel_x1),
                                'y1': float(rel_y1),
                                'x2': float(rel_x2),
                                'y2': float(rel_y2),
                                'width': float(rel_x2 - rel_x1),
                                'height': float(rel_y2 - rel_y1)
                            },
                        }
                        
                        license_plates.append(plate_info)
                        
                        # Emit license plate detection instead of displaying in a window
                        bbox_data = plate_info['bbox']
                        emit_license_plate_detection(vehicle_id, vehicle_class, plate_img, confidence, bbox_data)
            
            # Prepare response with detection results and include the original vehicle image
            response = {
                'vehicle_id': vehicle_id,
                'vehicle_class': vehicle_class,
                'timestamp': timestamp,
                'inference_time': inference_time,
                'license_plates': license_plates,
                'image_dimensions': {
                    'width': width,
                    'height': height
                },
                'vehicle_image': image_data  # Include the original vehicle image data
            }
            
            # Emit license plate detection results using 'license_plate' event
            sio.emit('license_plate', response)
            
            # Print detection summary
            plate_count = len(license_plates)
            if plate_count > 0:
                print(f"Vehicle {vehicle_id} ({vehicle_class}): Found {plate_count} license plate(s), inference time: {inference_time:.2f}ms")
                print(f"Emitted 'license_plate' event with license plate data")
            else:
                print(f"Vehicle {vehicle_id} ({vehicle_class}): No license plates detected")
                
        except Exception as e:
            print(f"Error in license plate detection thread: {e}")
            time.sleep(0.1)  # Prevent tight loop if there's an error
    
    print("License plate detection thread stopped")

@sio.event
def connect():
    print(f"Successfully connected to Socket.IO server: {SOCKETIO_SERVER_URL}")
    print("Waiting for 'car' events with vehicle images...")

@sio.event
def disconnect():
    print("Disconnected from Socket.IO server")
    global running
    running = False

@sio.on('violation_detect')
def on_violation_detect(data):
    global last_processing_time

    current_time = time.time()
    if current_time - last_processing_time < 1.0/MAX_FPS:
        return  # Skip this frame to maintain reasonable frame rate

    cameraId = data.get('camera_id')
    imageId = data.get('image_id')
    violations = data.get('violations')
    buffer = data.get('buffer')
    detections = data.get('detections')

    last_processing_time = current_time
    
    try:
        # Check if we have a valid car event with image data
        if not isinstance(data, dict):
            print("Warning: Received car event with invalid data format")
            return
        
        image = Image.open(io.BytesIO(buffer))

        frame = np.array(image)
        frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)

        height, width = frame.shape[:2]

        # Crop car detection
        for detection in detections:
            x1, y1, x2, y2 = detection['bbox']
            x1 = int(x1 * width)
            y1 = int(y1 * height)
            x2 = int(x2 * width)
            y2 = int(y2 * height)

            # Crop car detection
            car_img = frame[y1:y2, x1:x2]

            # Add car data to processing queue
            violation = next((x for x in violations if x['id'] == detection["id"]), None)

            if violation:
                try:
                    model_queue.put((car_img.copy(), cameraId, imageId, detection['id'], violation['type']), block=False)
                except queue.Full:
                    pass

    
    except Exception as e:
        print(f"Error handling car event: {e}")

def main():
    global running
    
    # Load YOLO model for license plate detection
    if not load_model():
        print("Failed to load license plate detection model. Exiting...")
        return
    
    # Start the processing thread
    processing_thread = threading.Thread(target=process_license_plates_thread, daemon=True)
    processing_thread.start()
    print("License plate detection thread started")
    
    # Connect to Socket.IO server
    try:
        print(f"Connecting to Socket.IO server at {SOCKETIO_SERVER_URL}")
        sio.connect(SOCKETIO_SERVER_URL, transports=['websocket'])
    except Exception as e:
        print(f"Failed to connect to Socket.IO server: {e}")
        return
    
    # Keep the main thread running
    try:
        while running:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Interrupted by user. Shutting down...")
    finally:
        if sio.connected:
            sio.disconnect()
        print("License plate detector stopped.")

if __name__ == "__main__":
    main()
