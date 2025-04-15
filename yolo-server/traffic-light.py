import cv2
import numpy as np
import socketio
import base64
import time
import threading
from ultralytics import YOLO
import queue
import io
from PIL import Image

# --- Configuration ---
MODEL_PATH = "./models/mhiot-dentinhieu-best-new.pt"  # Path to YOLOv11 model
CONFIDENCE_THRESHOLD = 0.4  # Detection confidence threshold
SOCKETIO_SERVER_URL = 'ws://192.168.38.32:3001'
PREVIEW_WINDOW_NAME = 'Traffic Sign Detection'
PREVIEW_FPS = 30  # Maximum FPS for preview display
ENABLE_GPU = True  # Enable GPU acceleration if available
PREVIEW_WINDOW_INIT_DELAY = 2.0  # Delay in seconds before initializing preview window

# Initialize Socket.IO client
sio = socketio.Client()
print(f"Initializing Socket.IO client to connect to {SOCKETIO_SERVER_URL}")

# Global variables
running = True
model = None
last_frame_time = 0
MAX_FPS = 20  # Maximum frames per second

# Queues for thread communication
raw_frame_queue = queue.Queue(maxsize=3)
model_frame_queue = queue.Queue(maxsize=2)
detection_results_queue = queue.Queue(maxsize=2)

def get_model_path():
    return MODEL_PATH

def get_optimal_text_color(bg_color):
    """Determine whether black or white text will be more readable on a given background color."""
    b, g, r = bg_color
    luminance = 0.299 * r + 0.587 * g + 0.114 * b
    return (0, 0, 0) if luminance > 128 else (255, 255, 255)

def process_frames_thread():
    """Thread function to process frames with the model in the background"""
    global running, model
    
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
                
            # Process the frame with YOLO
            start_time = time.time()
            results = model(frame, verbose=False)
            inference_time = (time.time() - start_time) * 1000  # Convert to milliseconds
            
            height, width = frame.shape[:2]
            
            # Process detection results
            detected_signs = []
            bounding_boxes = []
            
            # Traffic sign counts by type
            sign_counts = {}
            
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    confidence = float(box.conf[0])
                    cls_id = int(box.cls[0])
                    
                    # Check if the detected object meets confidence threshold
                    if confidence >= CONFIDENCE_THRESHOLD:
                        # Get bounding box coordinates
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        
                        class_name = model.names[cls_id]
                        
                        # Count by class name
                        if class_name in sign_counts:
                            sign_counts[class_name] += 1
                        else:
                            sign_counts[class_name] = 1
                        
                        # Calculate relative coordinates (0-1 range)
                        rel_x1 = x1 / width
                        rel_y1 = y1 / height
                        rel_x2 = x2 / width
                        rel_y2 = y2 / height
                        
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
                        
                        detected_signs.append(detection_info)
                        
                        # Choose random but consistent color based on class_id for visualization
                        color_r = (cls_id * 50) % 255
                        color_g = (cls_id * 100) % 255
                        color_b = (cls_id * 150) % 255
                        color = (color_b, color_g, color_r)  # BGR format for OpenCV
                        
                        # Store bounding box info for overlay
                        box_info = {
                            'coords': (x1, y1, x2, y2),
                            'class': class_name,
                            'confidence': confidence,
                            'color': color
                        }
                        
                        bounding_boxes.append(box_info)
            
            # Prepare response with detection results
            response = {
                'detections': detected_signs,
                'inference_time': inference_time,
                'image_dimensions': {
                    'width': width,
                    'height': height
                },
                'timestamp': timestamp
            }

            # Emit detection results back to the server
            if detected_signs:
                sio.emit('dentinhieu', response)
                print(f"Detected {len(detected_signs)} traffic signs, inference time: {inference_time:.2f}ms")
                
                # Display sign count summary
                count_summary = ", ".join([f"{count} {sign_type}" 
                                         for sign_type, count in sign_counts.items()])
                print(f"Sign counts: {count_summary}")
            
            # Package detection results for display overlay
            detection_data = {
                'bounding_boxes': bounding_boxes,
                'inference_time': inference_time,
                'sign_counts': sign_counts,
                'timestamp': timestamp
            }
            
            # Add the detection data to result queue (replace if queue full)
            try:
                detection_results_queue.put(detection_data, block=False)
            except queue.Full:
                # Get and discard old data, then add new data
                try:
                    detection_results_queue.get(block=False)
                    detection_results_queue.put(detection_data, block=False)
                except Exception:
                    pass
                    
        except Exception as e:
            print(f"Error in processing thread: {e}")
            time.sleep(0.1)  # Prevent tight loop if there's an error
    
    print("Frame processing thread stopped")

def draw_overlay(frame, detection_data):
    """Draw bounding boxes and info overlay on a frame"""
    if detection_data is None:
        return frame
    
    # Create a copy of the frame to avoid modifying the original
    overlay = frame.copy()
    
    # Draw bounding boxes
    for box in detection_data['bounding_boxes']:
        x1, y1, x2, y2 = box['coords']
        class_name = box['class']
        confidence = box['confidence']
        color = box['color']
        
        # Draw bounding box
        cv2.rectangle(overlay, (x1, y1), (x2, y2), color, 2)
        
        # Create label with class name and confidence
        label = f"{class_name}: {confidence:.2f}"
        
        # Get text size
        (label_width, label_height), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        
        # Draw label background
        cv2.rectangle(overlay, (x1, y1 - 25), (x1 + label_width, y1), color, -1)
        
        # Choose optimal text color for readability on this background
        text_color = get_optimal_text_color(color)
        
        # Draw label text with adaptive color
        cv2.putText(overlay, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, text_color, 2)
    
    # Create a semi-transparent black background for summary stats
    stats_bg_color = (30, 30, 30)
    stats_text_color = (220, 220, 220)  # Light gray text for stats
    
    # Draw semi-transparent background for text areas
    stats_height = 200  # Approximate height needed for stats
    stats_width = 300   # Width for stats area
    stats_overlay = overlay.copy()
    cv2.rectangle(stats_overlay, (5, 50), (stats_width, 50 + stats_height), stats_bg_color, -1)
    
    # Apply alpha blending for semi-transparency
    alpha = 0.7
    cv2.addWeighted(stats_overlay, alpha, overlay, 1 - alpha, 0, overlay)
    
    y_pos = 70  # Start position for summary text
    
    # Show inference time
    cv2.putText(
        overlay,
        f"Inference: {detection_data['inference_time']:.1f}ms",
        (10, y_pos),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        stats_text_color,
        2
    )
    y_pos += 30
    
    # Show total signs detected
    total_signs = sum(detection_data['sign_counts'].values())
    cv2.putText(
        overlay,
        f"Total traffic signs: {total_signs}",
        (10, y_pos),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        stats_text_color,
        2
    )
    y_pos += 30
    
    # Show count for each sign type with sign-specific colors
    for sign_type, count in detection_data['sign_counts'].items():
        if count > 0:
            # Generate a color based on the sign type name
            hash_val = sum(ord(c) for c in sign_type)
            color_r = (hash_val * 50) % 255
            color_g = (hash_val * 100) % 255
            color_b = (hash_val * 150) % 255
            type_color = (color_b, color_g, color_r)  # BGR format for OpenCV
                
            # Use adaptive text color based on the sign type color
            text_color = get_optimal_text_color(type_color)
            
            # Draw sign count with color-coded background
            count_text = f"{sign_type}: {count}"
            (text_width, text_height), _ = cv2.getTextSize(count_text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
            
            # Draw colored background for each sign type
            cv2.rectangle(overlay, (10, y_pos - 20), (10 + text_width, y_pos + 5), type_color, -1)
            
            # Draw text with adaptive color
            cv2.putText(
                overlay,
                count_text,
                (10, y_pos),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                text_color,
                2
            )
            y_pos += 30
    
    return overlay

def display_updater():
    """Thread function to continuously update the preview window"""
    global running
    
    print("Starting display updater thread")
    
    # Delay the window creation to avoid GUI issues at startup
    time.sleep(PREVIEW_WINDOW_INIT_DELAY)
    
    try:
        # Create a black canvas for initial display
        blank_frame = np.zeros((360, 480, 3), dtype=np.uint8)
        
        # Initialize the window
        cv2.namedWindow(PREVIEW_WINDOW_NAME, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(PREVIEW_WINDOW_NAME, 960, 540)
        
        # Variables for FPS control
        last_update_time = 0
        update_interval = 1.0 / PREVIEW_FPS
        
        # Track FPS
        frame_count = 0
        fps_timer = time.time()
        fps = 0
        
        # Last raw frame and detection data
        latest_frame = None
        latest_detection_data = None
        
        while running:
            current_time = time.time()
            
            # Update display at regular intervals to maintain target FPS
            if current_time - last_update_time >= update_interval:
                last_update_time = current_time
                
                try:
                    # Get latest raw frame - always display the most recent
                    got_new_frame = False
                    while not raw_frame_queue.empty():
                        frame, timestamp = raw_frame_queue.get_nowait()
                        if frame is not None:
                            latest_frame = frame.copy()
                            got_new_frame = True
                    
                    # Check for new detection results
                    got_new_detection = False
                    while not detection_results_queue.empty():
                        latest_detection_data = detection_results_queue.get_nowait()
                        got_new_detection = True
                    
                    # Prepare frame for display
                    display_img = None
                    
                    if latest_frame is not None:
                        # Start with the latest raw frame
                        display_img = latest_frame.copy()
                        
                        # Add timestamp to the frame
                        time_str = time.strftime("%H:%M:%S", time.localtime())
                        cv2.putText(
                            display_img,
                            time_str,
                            (display_img.shape[1] - 150, 30),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.7,
                            (255, 255, 255),  # White for timestamp
                            2
                        )
                        
                        # Calculate and display FPS
                        frame_count += 1
                        if current_time - fps_timer >= 1.0:  # Update FPS every second
                            fps = frame_count
                            frame_count = 0
                            fps_timer = current_time
                        
                        cv2.putText(
                            display_img,
                            f"FPS: {fps}",
                            (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.7,
                            (255, 255, 255),  # White for FPS
                            2
                        )
                        
                        # Apply detection overlay if available
                        if latest_detection_data:
                            display_img = draw_overlay(display_img, latest_detection_data)
                            
                            # Add note that detections are being shown
                            cv2.putText(
                                display_img,
                                "Live Traffic Sign Detection",
                                (10, display_img.shape[0] - 20),
                                cv2.FONT_HERSHEY_SIMPLEX,
                                0.7,
                                (0, 255, 0),  # Green text for detection active
                                2
                            )
                        else:
                            # Add a note that we're waiting for detection results
                            cv2.putText(
                                display_img,
                                "Waiting for detection...",
                                (10, display_img.shape[0] - 20),
                                cv2.FONT_HERSHEY_SIMPLEX,
                                0.7,
                                (0, 165, 255),  # Orange text for waiting
                                2
                            )
                    
                    else:
                        # Show blank frame with waiting message if no frame is available
                        display_img = blank_frame.copy()
                        cv2.putText(
                            display_img,
                            "Waiting for images from Socket.IO...",
                            (20, blank_frame.shape[0] // 2),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.8,
                            (0, 255, 255),  # Yellow text
                            1
                        )
                    
                    # Ensure window exists before showing image
                    try:
                        prop_visible = cv2.getWindowProperty(PREVIEW_WINDOW_NAME, cv2.WND_PROP_VISIBLE)
                        if prop_visible < 1:
                            cv2.namedWindow(PREVIEW_WINDOW_NAME, cv2.WINDOW_NORMAL)
                            cv2.resizeWindow(PREVIEW_WINDOW_NAME, 960, 540)
                    except:
                        cv2.namedWindow(PREVIEW_WINDOW_NAME, cv2.WINDOW_NORMAL)
                        cv2.resizeWindow(PREVIEW_WINDOW_NAME, 960, 540)
                    
                    # Show the image
                    if display_img is not None:
                        cv2.imshow(PREVIEW_WINDOW_NAME, display_img)
                
                except Exception as e:
                    print(f"Error updating display: {e}")
                    time.sleep(0.1)
                    continue
                
                # Process window events and check for exit key
                try:
                    key = cv2.waitKey(1) & 0xFF
                    if key == 27:  # ESC key
                        print("User requested exit from display thread")
                        running = False
                        break
                except Exception as e:
                    print(f"Error handling key events: {e}")
            
            # Small sleep to prevent tight loop
            time.sleep(0.005)
    
    except Exception as e:
        print(f"Display updater thread error: {e}")
    finally:
        # Clean up resources
        try:
            cv2.destroyAllWindows()
        except:
            pass
    
    print("Display updater thread stopped")

def load_model():
    global model
    model_path = get_model_path()
    print(f"Loading YOLO model: {model_path}")
    
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
                else:
                    print("CUDA is not available. Falling back to CPU.")
            except ImportError:
                print("PyTorch not properly installed. Falling back to CPU.")
            except Exception as e:
                print(f"Error checking GPU: {e}. Falling back to CPU.")

        # Load the model with the selected device
        print(f"Loading model on device: {device}")
        model = YOLO(model_path)
        model.to(device)
        print(f"Model loaded successfully! Running on: {device}")
        print(f"Available classes: {model.names}")
        
        return True
    except Exception as e:
        print(f"Failed to load model: {e}")
        return False

# Socket.IO event handlers
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
        
        # Add raw frame to display queue
        try:
            raw_frame_queue.put((frame.copy(), time.time()), block=False)
        except queue.Full:
            # Get and discard old frame, then add new frame
            try:
                raw_frame_queue.get(block=False)
                raw_frame_queue.put((frame.copy(), time.time()), block=False)
            except Exception as e:
                print(f"Error managing raw frame queue: {e}")
        
        # Also add the frame to the model processing queue
        try:
            model_frame_queue.put((frame.copy(), time.time()), block=False)
        except queue.Full:
            # If model queue is full, just discard this frame for processing
            # This ensures display remains responsive even if model can't keep up
            pass
    
    except Exception as e:
        print(f"Error processing image: {e}")
        # Send error response
        sio.emit('dentinhieu', {'error': str(e)})

def main():
    global running
    
    # Load YOLO model
    if not load_model():
        print("Failed to load model. Exiting...")
        return
    
    # Connect to Socket.IO server
    try:
        print(f"Connecting to Socket.IO server at {SOCKETIO_SERVER_URL}")
        sio.connect(SOCKETIO_SERVER_URL, transports=['websocket'])
    except Exception as e:
        print(f"Failed to connect to Socket.IO server: {e}")
        return
    
    # Start processing thread
    processing_thread = threading.Thread(target=process_frames_thread, daemon=True)
    processing_thread.start()
    print("Processing thread started")
    
    # Start display thread
    display_thread = threading.Thread(target=display_updater, daemon=True)
    display_thread.start()
    print("Display thread started")
    
    # Keep the main thread running
    try:
        while running:
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("Interrupted by user. Shutting down...")
    finally:
        running = False
        if sio.connected:
            sio.disconnect()
        
        # Wait for threads to finish
        processing_thread.join(timeout=2)
        display_thread.join(timeout=2)
        
        print("Application stopped.")

if __name__ == "__main__":
    main()
