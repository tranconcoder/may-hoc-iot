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
SOCKETIO_SERVER_URL = 'http://192.168.1.17:3001'
ENABLE_PREVIEW = True  # Enable preview window to show detection results
PREVIEW_WINDOW_NAME = 'Vehicle Detection Preview'  # Name of the preview window
ENABLE_TRACKING = True  # Enable object tracking functionality
PREVIEW_WINDOW_INIT_DELAY = 2.0  # Delay in seconds before initializing preview window
PREVIEW_FPS = 30  # Maximum FPS for preview display
ENABLE_GPU = True  # Enable GPU acceleration if available

# Add tracking-related configurations
TRAIL_DURATION = 5.0  # Duration in seconds to show vehicle trails
MAX_TRAIL_POINTS = 30  # Maximum number of points to store per trail

# Add counting line configuration
ENABLE_COUNTING_LINE = True  # Enable the vehicle counting line
# Default position for counting line (horizontal line in the middle of the frame)
# This will be adjusted based on actual frame dimensions
COUNTING_LINE_POSITION = 0.5  # Position of the line as ratio of frame height (0-1)
# Count in both directions
BIDIRECTIONAL_COUNTING = True  # Count vehicles in both directions
# Colors for statistics display
STATS_COLORS = {
    "header": (255, 255, 255),  # White for headers
    "up": (0, 255, 0),          # Green for upward traffic
    "down": (0, 165, 255),      # Orange for downward traffic
    "total": (255, 255, 0),     # Yellow for totals
    "background": (0, 0, 0, 0.5) # Semi-transparent black for text background
}

# Initialize Socket.IO client
sio = socketio.Client()
print(f"Initializing Socket.IO client to connect to {SOCKETIO_SERVER_URL}")

# Global variables
running = True
model = None
last_frame_time = 0  # To limit frame rate for preview
MAX_FPS = 20  # Maximum frames per second for preview window to avoid overload

# Frame queue for real-time display
raw_frame_queue = queue.Queue(maxsize=3)  # Increased queue size for display thread
model_frame_queue = queue.Queue(maxsize=2)  # Queue for frames to be processed by model
detection_results_queue = queue.Queue(maxsize=2)  # Store detection results (not frames)

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

def process_frames_thread():
    """Thread function to process frames with the model in the background"""
    global running, model, vehicle_tracks, counted_vehicles
    global vehicle_counts_up, vehicle_counts_down, total_counted_up, total_counted_down
    global counting_line_y, counting_line_start_x, counting_line_end_x
    
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
            bounding_boxes = []  # Store bounding boxes for overlay
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
                        
                        # Choose color based on class
                        if class_name == 'car':
                            color = (0, 255, 0)  # Green for cars
                        elif class_name == 'truck':
                            color = (0, 0, 255)  # Blue for trucks
                        elif class_name == 'bus':
                            color = (255, 0, 0)  # Red for buses
                        elif class_name == 'motorcycle':
                            color = (255, 255, 0)  # Yellow for motorcycles
                        elif class_name == 'bicycle':
                            color = (255, 0, 255)  # Purple for bicycles
                        else:
                            color = (0, 255, 0)  # Default green
                        
                        # Store bounding box info for overlay with track_id
                        box_info = {
                            'coords': (x1, y1, x2, y2),
                            'class': class_name,
                            'confidence': confidence,
                            'color': color,
                            'center': (center_x, center_y)
                        }
                        
                        if track_id is not None:
                            box_info['track_id'] = track_id
                            
                            # Add to current tracks
                            current_time = time.time()
                            current_tracks[track_id] = {
                                'position': (center_x, center_y),
                                'time': current_time,
                                'class': class_name
                            }
                            
                        bounding_boxes.append(box_info)
            
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
                    'by_type_down': vehicle_counts_down
                }
            }

            # Emit detection results back to the server
            sio.emit('giaothong', response)
            
            print(f"Processed image, found {len(detected_objects)} vehicles, inference time: {inference_time:.2f}ms")
            
            # Display vehicle count summary
            if detected_objects:
                count_summary = ", ".join([f"{count} {v_type}{'s' if count != 1 else ''}" 
                                         for v_type, count in vehicle_counts.items() if count > 0])
                print(f"Vehicle counts: {count_summary}")
            
            # Package detection results for display overlay with tracking data
            detection_data = {
                'bounding_boxes': bounding_boxes,
                'inference_time': inference_time,
                'vehicle_counts': vehicle_counts,
                'timestamp': timestamp,
                'tracks': vehicle_tracks.copy(),  # Include tracking data
                'counting_line': {
                    'y': counting_line_y,
                    'start_x': counting_line_start_x,
                    'end_x': counting_line_end_x
                },
                'counts_up': vehicle_counts_up.copy(),
                'total_up': total_counted_up,
                'counts_down': vehicle_counts_down.copy(),
                'total_down': total_counted_down,
                'new_crossings': new_crossings  # List of vehicles that just crossed the line with direction
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

# Add this utility function for determining optimal text color based on background
def get_optimal_text_color(bg_color):
    """Determine whether black or white text will be more readable on a given background color."""
    # Extract BGR components (OpenCV uses BGR)
    b, g, r = bg_color
    
    # Calculate luminance (perceived brightness)
    # Using the formula: 0.299*R + 0.587*G + 0.114*B
    luminance = 0.299 * r + 0.587 * g + 0.114 * b
    
    # Use white text on dark backgrounds, black text on light backgrounds
    return (0, 0, 0) if luminance > 128 else (255, 255, 255)

def draw_overlay(frame, detection_data):
    """Draw bounding boxes and info overlay on a frame"""
    if detection_data is None:
        return frame
    
    # Create a copy of the frame to avoid modifying the original
    overlay = frame.copy()
    
    # Draw tracking trails if available
    if 'tracks' in detection_data:
        tracks = detection_data['tracks']
        for track_id, points in tracks.items():
            if len(points) < 2:  # Need at least 2 points for a line
                continue
                
            # Draw lines connecting trail points
            points_sorted = sorted(points, key=lambda x: x['time'])
            for i in range(1, len(points_sorted)):
                pt1 = points_sorted[i-1]['position']
                pt2 = points_sorted[i]['position']
                
                # Make older points more transparent/thinner
                alpha = 0.5 + 0.5 * (i / len(points_sorted))  # 0.5-1.0 based on age
                thickness = max(1, int(3 * alpha))
                
                # Use a default color for trails (yellow)
                cv2.line(overlay, pt1, pt2, (0, 255, 255), thickness)
    
    # Draw bounding boxes
    for box in detection_data['bounding_boxes']:
        x1, y1, x2, y2 = box['coords']
        class_name = box['class']
        confidence = box['confidence']
        color = box['color']
        track_id = box.get('track_id', None)
        
        # Draw bounding box
        cv2.rectangle(overlay, (x1, y1), (x2, y2), color, 2)
        
        # Create label with class name and confidence
        label = f"{class_name}: {confidence:.2f}"
        if track_id is not None:
            label += f" ID:{track_id}"
        
        # Get text size
        (label_width, label_height), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        
        # Draw label background
        cv2.rectangle(overlay, (x1, y1 - 25), (x1 + label_width, y1), color, -1)
        
        # Choose optimal text color for readability on this background
        text_color = get_optimal_text_color(color)
        
        # Draw label text with adaptive color
        cv2.putText(overlay, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, text_color, 2)
        
        # Draw center point if it exists
        if 'center' in box:
            center_x, center_y = box['center']
            cv2.circle(overlay, (center_x, center_y), 4, (0, 0, 255), -1)  # Red dot for center
    
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
    
    # Show total vehicles detected
    total_vehicles = sum(detection_data['vehicle_counts'].values())
    cv2.putText(
        overlay,
        f"Total vehicles: {total_vehicles}",
        (10, y_pos),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        stats_text_color,
        2
    )
    y_pos += 30
    
    # Show count for each vehicle type with vehicle-specific colors
    for v_type, count in detection_data['vehicle_counts'].items():
        if count > 0:
            # Choose color based on vehicle type for better visualization
            if v_type == 'car':
                type_color = (0, 255, 0)  # Green for cars
            elif v_type == 'truck':
                type_color = (0, 0, 255)  # Blue for trucks
            elif v_type == 'bus':
                type_color = (255, 0, 0)  # Red for buses
            elif v_type == 'motorcycle':
                type_color = (255, 255, 0)  # Yellow for motorcycles
            elif v_type == 'bicycle':
                type_color = (255, 0, 255)  # Purple for bicycles
            else:
                type_color = stats_text_color
                
            # Use adaptive text color based on the vehicle type color
            text_color = get_optimal_text_color(type_color)
            
            # Draw vehicle count with color-coded background
            count_text = f"{v_type}s: {count}"
            (text_width, text_height), _ = cv2.getTextSize(count_text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
            
            # Draw colored background for each vehicle type
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
    
    # Add tracking information text
    y_pos += 10
    cv2.putText(
        overlay,
        f"Tracking: {len(detection_data.get('tracks', {}))} objects",
        (10, y_pos),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        stats_text_color,
        2
    )
    
    # Draw counting line if enabled
    if ENABLE_COUNTING_LINE and 'counting_line' in detection_data:
        line_y = detection_data['counting_line']['y']
        start_x = detection_data['counting_line']['start_x']
        end_x = detection_data['counting_line']['end_x']
        
        # Draw the counting line with a bright color
        line_color = (0, 255, 255)  # Yellow line
        cv2.line(overlay, (start_x, line_y), (end_x, line_y), line_color, 2)
        
        # Add counters for each direction with direction-specific colors
        if 'total_up' in detection_data and 'total_down' in detection_data:
            # Background for counters
            counter_bg = overlay.copy()
            counter_width = 180
            counter_height = 80
            
            # Up counter (right side)
            up_bg_color = STATS_COLORS["up"]
            up_text_color = get_optimal_text_color(up_bg_color)
            up_x = end_x - counter_width - 20
            up_y = line_y - counter_height - 20
            
            cv2.rectangle(counter_bg, (up_x, up_y), (up_x + counter_width, up_y + counter_height), up_bg_color, -1)
            cv2.addWeighted(counter_bg, 0.7, overlay, 0.3, 0, overlay)
            
            # Up count text
            cv2.putText(
                overlay,
                "▲ UP COUNT",
                (up_x + 10, up_y + 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                up_text_color,
                2
            )
            cv2.putText(
                overlay,
                f"{detection_data['total_up']}",
                (up_x + 10, up_y + 65),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.2,
                up_text_color,
                2
            )
            
            # Down counter (left side)
            down_bg_color = STATS_COLORS["down"]
            down_text_color = get_optimal_text_color(down_bg_color)
            down_x = start_x + 20
            down_y = line_y + 20
            
            cv2.rectangle(counter_bg, (down_x, down_y), (down_x + counter_width, down_y + counter_height), down_bg_color, -1)
            cv2.addWeighted(counter_bg, 0.7, overlay, 0.3, 0, overlay)
            
            # Down count text
            cv2.putText(
                overlay,
                "▼ DOWN COUNT",
                (down_x + 10, down_y + 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                down_text_color,
                2
            )
            cv2.putText(
                overlay,
                f"{detection_data['total_down']}",
                (down_x + 10, down_y + 65),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.2,
                down_text_color,
                2
            )
    
    return overlay

def display_updater():
    """Thread function to continuously update the preview window with raw frames 
    and overlay detection results when available"""
    global running
    
    print("Starting display updater thread - raw frames with detection overlay when available")
    
    # Delay the window creation to avoid GUI issues at startup
    time.sleep(PREVIEW_WINDOW_INIT_DELAY)
    
    try:
        # Create a black canvas for initial display
        blank_frame = np.zeros((360, 480, 3), dtype=np.uint8)
        
        # Initialize the window once outside the main loop
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
                            STATS_COLORS["header"],
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
                            STATS_COLORS["header"],
                            2
                        )
                        
                        # Apply detection overlay if available
                        if latest_detection_data:
                            display_img = draw_overlay(display_img, latest_detection_data)
                            
                            # Add note that detections are being shown
                            cv2.putText(
                                display_img,
                                "Live Detection with Tracking",
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
                            (0, 255, 255),
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
                    if key == ord('q'):
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
    global model, display_thread, processing_thread
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
        
        if ENABLE_PREVIEW:
            print(f"Preview window will be initialized after a {PREVIEW_WINDOW_INIT_DELAY}s delay")
            
            # Start display updater thread
            display_thread = threading.Thread(target=display_updater, daemon=True)
            display_thread.start()
            print("Display updater thread started")
            
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
        sio.emit('giaothong', {'error': str(e)})

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
    
    # Keep the main thread running
    try:
        while running:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Interrupted by user. Shutting down...")
    finally:
        if sio.connected:
            sio.disconnect()
        print("Server stopped.")

if __name__ == "__main__":
    main()
