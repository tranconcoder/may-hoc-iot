import cv2
import numpy as np
import time
import threading
import socketio
import base64
import torch
import io
from PIL import Image
import queue
import os
import sys

# Add YOLOv5 to the path if needed
if not os.path.exists('yolov5'):
    print("YOLOv5 repository not found, attempting to clone...")
    os.system('git clone https://github.com/ultralytics/yolov5.git')

# --- Configuration ---
LP_DETECTOR_MODEL = './models/LP_detector_nano_61.pt'  # Model for license plate detection (YOLOv5)
LP_OCR_MODEL = './models/LP_ocr_nano_62.pt'  # Model for license plate OCR (YOLOv5)
USE_OCR = False  # Set to True if OCR model is available
CONFIDENCE_THRESHOLD = 0.45  # Detection confidence threshold
SOCKETIO_SERVER_URL = 'http://192.168.38.32:3001'  # Same server as in server.py
ENABLE_GPU = True  # Enable GPU acceleration if available
MAX_FPS = 20  # Maximum frames per second

# Initialize Socket.IO client
sio = socketio.Client()
print(f"Initializing Socket.IO client to connect to {SOCKETIO_SERVER_URL}")

# Global variables
running = True
detector_model = None
ocr_model = None
last_frame_time = 0

# Queue for model processing
model_frame_queue = queue.Queue(maxsize=2)

# Helper function for license plate rotation/deskewing (simplified version)
def deskew_plate(plate_img, angle=0):
    """Apply rotation to the license plate image to help with OCR accuracy"""
    if angle == 0:
        return plate_img
    
    # Get image dimensions
    h, w = plate_img.shape[:2]
    center = (w // 2, h // 2)
    
    # Calculate rotation matrix
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(plate_img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    
    return rotated

def process_frames_thread():
    """Thread function to process frames with the model in the background"""
    global running, detector_model, ocr_model
    
    print("Starting license plate detection thread")
    
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
            
            # Skip processing if detector model isn't loaded
            if detector_model is None:
                time.sleep(0.01)
                continue
                
            # Step 1: Detect license plates with YOLOv5
            start_time = time.time()
            results = detector_model(frame, size=640)  # YOLOv5 inference
            inference_time = (time.time() - start_time) * 1000  # Convert to milliseconds
            
            height, width = frame.shape[:2]
            
            # Process detection results for YOLOv5
            license_plates = []
            
            # Get detections from YOLOv5 results format
            detections = results.xyxy[0]  # Get detection boxes in xyxy format
            
            # Convert tensor to numpy if needed
            if isinstance(detections, torch.Tensor):
                detections = detections.cpu().numpy()
            
            for detection in detections:
                # YOLOv5 detection format: [x1, y1, x2, y2, confidence, class]
                x1, y1, x2, y2, confidence, class_id = detection
                
                # Check if the detection meets confidence threshold
                if confidence >= CONFIDENCE_THRESHOLD:
                    # Convert to integers for image cropping
                    x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
                    
                    # Calculate relative coordinates (0-1 range)
                    rel_x1 = x1 / width
                    rel_y1 = y1 / height
                    rel_x2 = x2 / width
                    rel_y2 = y2 / height
                    
                    # Extract the license plate region
                    license_plate_img = frame[y1:y2, x1:x2]
                    
                    # Skip if the region is empty
                    if license_plate_img.size == 0:
                        continue
                    
                    # Step 2: Apply OCR on the detected license plate if enabled
                    plate_text = "unknown"
                    ocr_confidence = 0.0
                    
                    if USE_OCR and ocr_model is not None:
                        try:
                            # Try multiple orientations for better OCR accuracy
                            angles = [0, -3, 3, -5, 5]  # Different rotation angles to try
                            
                            for angle in angles:
                                # Apply rotation/deskew
                                rotated_plate = deskew_plate(license_plate_img, angle)
                                
                                # Run OCR model on the rotated plate with YOLOv5
                                ocr_results = ocr_model(rotated_plate, size=640)
                                
                                # Process OCR results from YOLOv5
                                if len(ocr_results.xyxy[0]) > 0:
                                    # Extract detected characters and their positions
                                    chars = []
                                    
                                    ocr_detections = ocr_results.xyxy[0]
                                    if isinstance(ocr_detections, torch.Tensor):
                                        ocr_detections = ocr_detections.cpu().numpy()
                                    
                                    for ocr_det in ocr_detections:
                                        # Format: [x1, y1, x2, y2, confidence, class]
                                        ocr_x1, ocr_y1, ocr_x2, ocr_y2, char_conf, char_class = ocr_det
                                        
                                        # Get class name from model names
                                        if int(char_class) < len(ocr_model.names):
                                            char = ocr_model.names[int(char_class)]
                                            # Calculate character center for sorting
                                            x_center = (ocr_x1 + ocr_x2) / 2
                                            chars.append((char, x_center, float(char_conf)))
                                    
                                    # Sort characters by x-position (left to right)
                                    chars.sort(key=lambda x: x[1])
                                    
                                    # Combine characters to form plate text
                                    if chars:
                                        plate_text = ''.join([c[0] for c in chars])
                                        ocr_confidence = sum([c[2] for c in chars]) / len(chars)
                                        
                                        # If we got a valid plate, stop trying different angles
                                        if plate_text != "unknown" and len(plate_text) >= 5:
                                            break
                        except Exception as e:
                            print(f"OCR Error: {e}")
                        
                    # Convert the license plate image to base64 for sending
                    _, buffer = cv2.imencode('.jpg', license_plate_img)
                    img_str = base64.b64encode(buffer).decode('utf-8')
                    
                    # Add detection to results
                    plate_info = {
                        'confidence': float(confidence),
                        'bbox': {
                            'x1': float(rel_x1),  # Normalized coordinates (0-1)
                            'y1': float(rel_y1),
                            'x2': float(rel_x2),
                            'y2': float(rel_y2),
                            'width': float(rel_x2 - rel_x1),
                            'height': float(rel_y2 - rel_y1)
                        },
                        'plate_image': img_str
                    }
                    
                    # Add OCR results if available
                    if USE_OCR:
                        plate_info['plate_text'] = plate_text
                        plate_info['ocr_confidence'] = float(ocr_confidence)
                    
                    license_plates.append(plate_info)
            
            # Prepare response with detection results
            response = {
                'license_plates': license_plates,
                'inference_time': inference_time,
                'image_dimensions': {
                    'width': width,
                    'height': height
                },
                'timestamp': timestamp,
                'count': len(license_plates)
            }

            # Emit detection results back to the server
            sio.emit('biensoxe', response)
            
            if license_plates:
                print(f"Processed image, found {len(license_plates)} license plates, inference time: {inference_time:.2f}ms")
                for plate in license_plates:
                    plate_msg = f"License plate detected (confidence: {plate['confidence']:.2f})"
                    if USE_OCR and 'plate_text' in plate:
                        plate_msg += f", Text: {plate['plate_text']} (conf: {plate['ocr_confidence']:.2f})"
                    print(plate_msg)
                    
        except Exception as e:
            print(f"Error in processing thread: {e}")
            time.sleep(0.1)  # Prevent tight loop if there's an error
    
    print("License plate detection thread stopped")

def load_model():
    global detector_model, ocr_model
    
    # Load license plate detector model
    print(f"Loading license plate detector model: {LP_DETECTOR_MODEL}")
    try:
        # Check if detector model file exists
        if not os.path.isfile(LP_DETECTOR_MODEL):
            print(f"ERROR: Detector model file not found at '{LP_DETECTOR_MODEL}'")
            print(f"Current working directory: {os.getcwd()}")
            print("Available files in current directory:", os.listdir())
            if os.path.exists('models'):
                print("Files in models directory:", os.listdir('models'))
            else:
                print("'models' directory not found. Create it and add your model file.")
            return False
            
        # Check GPU availability
        device = 'cpu'  # Default to CPU
        if ENABLE_GPU:
            try:
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

        # Load the detector model with YOLOv5
        print(f"Loading YOLOv5 license plate detector on device: {device}")
        try:
            # Use torch.hub to load YOLOv5 model
            detector_model = torch.hub.load('yolov5', 'custom', 
                                           path=LP_DETECTOR_MODEL, 
                                           source='local')
            # Set model to evaluation mode and move to appropriate device
            detector_model.to(device)
            detector_model.eval()
            
            # Configure model settings
            detector_model.conf = CONFIDENCE_THRESHOLD  # Set confidence threshold
            detector_model.classes = None  # Detect all classes
            detector_model.max_det = 100  # Maximum detections
            
            print(f"YOLOv5 license plate detector model loaded successfully! Running on: {device}")
        except Exception as e:
            print(f"Failed to load YOLOv5 license plate detector: {e}")
            return False
            
        # Load OCR model if enabled
        if USE_OCR:
            print(f"Loading OCR model: {LP_OCR_MODEL}")
            if not os.path.isfile(LP_OCR_MODEL):
                print(f"WARNING: OCR model file not found at '{LP_OCR_MODEL}', OCR will be disabled")
                USE_OCR = False
            else:
                try:
                    # Use torch.hub to load YOLOv5 OCR model
                    ocr_model = torch.hub.load('yolov5', 'custom', 
                                              path=LP_OCR_MODEL,
                                              source='local')
                    ocr_model.to(device)
                    ocr_model.eval()
                    ocr_model.conf = CONFIDENCE_THRESHOLD
                    
                    print(f"OCR model loaded successfully!")
                    if hasattr(ocr_model, 'names'):
                        print(f"Available OCR classes: {ocr_model.names}")
                except Exception as e:
                    print(f"Failed to load OCR model: {e}, OCR will be disabled")
                    USE_OCR = False
        
        # Start the processing thread
        processing_thread = threading.Thread(target=process_frames_thread, daemon=True)
        processing_thread.start()
        print("License plate detection thread started")
            
        return True
    except Exception as e:
        print(f"Failed to load models: {e}")
        return False

@sio.event
def connect():
    print(f"Successfully connected to Socket.IO server: {SOCKETIO_SERVER_URL}")
    print("Waiting for 'image' events...")

@sio.event
def disconnect():
    print("Disconnected from Socket.IO server")
    global running
    running = False

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
        sio.emit('biensoxe', {'error': str(e)})

def main():
    global running
    
    # Load models
    if not load_model():
        print("Failed to load models. Exiting...")
        return
    
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
