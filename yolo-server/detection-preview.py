import cv2
import numpy as np
import socketio
import time
import threading
import queue
import base64
import io
from PIL import Image

# --- Configuration ---
SOCKETIO_SERVER_URL = 'ws://172.28.31.150:3001'
PREVIEW_WINDOW_NAME = 'Combined Detection Preview'
PREVIEW_FPS = 30  # Maximum FPS for preview display
MAX_FRAMES_BUFFER = 3  # Maximum number of frames to buffer
WINDOW_WIDTH = 1280  # Initial window width
WINDOW_HEIGHT = 720  # Initial window height
WINDOW_INIT_DELAY = 2.0  # Delay in seconds before initializing preview window

# Colors for display elements
COLORS = {
    "background": (30, 30, 30),     # Dark gray for backgrounds
    "header": (255, 255, 255),      # White for headers
    "traffic_signs": (0, 255, 0),   # Green for traffic signs
    "vehicles": (0, 165, 255),      # Orange for vehicles
    "counting_line": (0, 255, 255), # Yellow for counting line
    "trails": (255, 255, 0),        # Yellow for vehicle trails
    "up_count": (0, 255, 0),        # Green for upward count
    "down_count": (0, 165, 255),    # Orange for downward count
}

# Initialize Socket.IO client
sio = socketio.Client(reconnection=True, reconnection_attempts=0, reconnection_delay=1, reconnection_delay_max=10)
print(f"Initializing Socket.IO client to connect to {SOCKETIO_SERVER_URL}")

# Global variables
running = True
connected = False
latest_frame = None
latest_traffic_sign_data = None
latest_vehicle_data = None
frame_timestamp = 0
traffic_sign_timestamp = 0
vehicle_timestamp = 0

# Queue for frames
frame_queue = queue.Queue(maxsize=MAX_FRAMES_BUFFER)

# Function to determine optimal text color based on background
def get_optimal_text_color(bg_color):
    """Determine whether black or white text will be more readable on a given background color."""
    b, g, r = bg_color
    luminance = 0.299 * r + 0.587 * g + 0.114 * b
    return (0, 0, 0) if luminance > 128 else (255, 255, 255)

def draw_traffic_sign_overlay(frame, data):
    """Draw traffic sign detection overlay on the frame"""
    if not data or 'detections' not in data:
        return frame
    
    overlay = frame.copy()
    height, width = overlay.shape[:2]
    
    # Draw bounding boxes for traffic signs
    for detection in data['detections']:
        # Get bounding box coordinates (convert from normalized to pixel values)
        bbox = detection['bbox']
        x1 = int(bbox['x1'] * width)
        y1 = int(bbox['y1'] * height)
        x2 = int(bbox['x2'] * width)
        y2 = int(bbox['y2'] * height)
        
        # Traffic sign class and confidence
        class_name = detection['class']
        confidence = detection['confidence']
        
        # Choose color based on sign type for better visualization
        # Generate a consistent color based on the class name
        hash_val = sum(ord(c) for c in class_name)
        color_r = (hash_val * 50) % 255
        color_g = (hash_val * 100) % 255
        color_b = (hash_val * 150) % 255
        color = (color_b, color_g, color_r)  # BGR format for OpenCV
        
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
    
    # Draw traffic sign statistics on top-left corner
    sign_counts = data.get('sign_counts', {})
    if sign_counts:
        y_pos = 150  # Start position (leaving space for general stats at the top)
        
        # Background for traffic sign stats
        stats_overlay = overlay.copy()
        stats_width = 300
        stats_height = 35 + 30 * len(sign_counts)
        cv2.rectangle(stats_overlay, (5, y_pos - 35), (stats_width, y_pos + stats_height), COLORS["background"], -1)
        
        # Apply alpha blending for semi-transparency
        alpha = 0.7
        cv2.addWeighted(stats_overlay, alpha, overlay, 1 - alpha, 0, overlay)
        
        # Draw header
        cv2.putText(
            overlay,
            "Traffic Signs",
            (10, y_pos),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            COLORS["traffic_signs"],
            2
        )
        y_pos += 30
        
        # Show count for each sign type
        for sign_type, count in sign_counts.items():
            # Generate color based on sign type
            hash_val = sum(ord(c) for c in sign_type)
            color_r = (hash_val * 50) % 255
            color_g = (hash_val * 100) % 255
            color_b = (hash_val * 150) % 255
            type_color = (color_b, color_g, color_r)
            
            # Determine optimal text color
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
    
    # Add inference time
    if 'inference_time' in data:
        cv2.putText(
            overlay,
            f"Sign Detection: {data['inference_time']:.1f}ms",
            (width - 300, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            COLORS["traffic_signs"],
            2
        )
    
    return overlay

def draw_vehicle_overlay(frame, data):
    """Draw vehicle detection and tracking overlay on the frame"""
    if not data or 'detections' not in data:
        return frame
    
    overlay = frame.copy()
    height, width = overlay.shape[:2]
    
    # Draw counting line if present
    if 'counting_line' in data and data['counting_line']['y'] is not None:
        line_y = data['counting_line']['y']
        start_x = data['counting_line']['start_x'] or 0
        end_x = data['counting_line']['end_x'] or width
        
        # Draw the counting line
        cv2.line(overlay, (start_x, line_y), (end_x, line_y), COLORS["counting_line"], 2)
        
        # Add text to indicate counting line
        cv2.putText(
            overlay,
            "Vehicle Counting Line",
            (start_x + 10, line_y - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            COLORS["counting_line"],
            2
        )
    
    # Draw vehicle tracks if present
    if 'tracks' in data and data['tracks']:
        for track in data['tracks']:
            track_id = track['id']
            positions = track['positions']
            vehicle_class = track['class']
            
            # Skip if there are not enough points
            if len(positions) < 2:
                continue
            
            # Determine color based on vehicle class
            if vehicle_class == 'car':
                color = (0, 255, 0)  # Green for cars
            elif vehicle_class == 'truck':
                color = (0, 0, 255)  # Red for trucks
            elif vehicle_class == 'bus':
                color = (255, 0, 0)  # Blue for buses
            elif vehicle_class == 'motorcycle':
                color = (255, 255, 0)  # Yellow for motorcycles
            elif vehicle_class == 'bicycle':
                color = (255, 0, 255)  # Purple for bicycles
            else:
                color = COLORS["trails"]  # Default yellow for unknown
            
            # Draw trail lines connecting positions
            for i in range(1, len(positions)):
                pt1 = (positions[i-1]['x'], positions[i-1]['y'])
                pt2 = (positions[i]['x'], positions[i]['y'])
                
                # Make older points more transparent/thinner
                alpha = 0.5 + 0.5 * (i / len(positions))  # 0.5-1.0 based on age
                thickness = max(1, int(3 * alpha))
                
                cv2.line(overlay, pt1, pt2, color, thickness)
            
            # Draw ID at the last position
            last_pos = (positions[-1]['x'], positions[-1]['y'])
            cv2.putText(
                overlay,
                f"ID:{track_id}",
                (last_pos[0] + 10, last_pos[1]),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                color,
                2
            )
    
    # Draw bounding boxes for vehicles
    for detection in data['detections']:
        # Get bounding box coordinates (convert from normalized to pixel values)
        bbox = detection['bbox']
        x1 = int(bbox['x1'] * width)
        y1 = int(bbox['y1'] * height)
        x2 = int(bbox['x2'] * width)
        y2 = int(bbox['y2'] * height)
        
        # Vehicle class and confidence
        class_name = detection['class']
        confidence = detection['confidence']
        track_id = detection.get('track_id', None)
        
        # Choose color based on vehicle type
        if class_name == 'car':
            color = (0, 255, 0)  # Green for cars
        elif class_name == 'truck':
            color = (0, 0, 255)  # Red for trucks
        elif class_name == 'bus':
            color = (255, 0, 0)  # Blue for buses
        elif class_name == 'motorcycle':
            color = (255, 255, 0)  # Yellow for motorcycles
        elif class_name == 'bicycle':
            color = (255, 0, 255)  # Purple for bicycles
        else:
            color = (0, 255, 0)  # Default green
        
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
    
    # Draw vehicle counting statistics on top-right corner
    vehicle_count = data.get('vehicle_count', {})
    if vehicle_count:
        current_counts = vehicle_count.get('current', {})
        total_up = vehicle_count.get('total_up', 0)
        total_down = vehicle_count.get('total_down', 0)
        
        # Background for vehicle stats
        y_pos = 150  # Start position (leaving space for general stats at the top)
        stats_overlay = overlay.copy()
        stats_width = 300
        stats_height = 35 + 30 * (len(current_counts) + 4)  # Extra rows for headers and totals
        
        cv2.rectangle(stats_overlay, (width - stats_width - 5, y_pos - 35), 
                     (width - 5, y_pos + stats_height), COLORS["background"], -1)
        
        # Apply alpha blending for semi-transparency
        alpha = 0.7
        cv2.addWeighted(stats_overlay, alpha, overlay, 1 - alpha, 0, overlay)
        
        # Draw header
        cv2.putText(
            overlay,
            "Vehicle Detection",
            (width - stats_width, y_pos),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            COLORS["vehicles"],
            2
        )
        y_pos += 30
        
        # Show current vehicle counts by type
        for v_type, count in current_counts.items():
            if v_type in ['car', 'truck', 'bus', 'motorcycle', 'bicycle']:
                # Choose color based on vehicle type
                if v_type == 'car':
                    type_color = (0, 255, 0)  # Green for cars
                elif v_type == 'truck':
                    type_color = (0, 0, 255)  # Red for trucks
                elif v_type == 'bus':
                    type_color = (255, 0, 0)  # Blue for buses
                elif v_type == 'motorcycle':
                    type_color = (255, 255, 0)  # Yellow for motorcycles
                elif v_type == 'bicycle':
                    type_color = (255, 0, 255)  # Purple for bicycles
                else:
                    type_color = COLORS["vehicles"]
                    
                # Determine optimal text color
                text_color = get_optimal_text_color(type_color)
                
                # Draw vehicle count with color-coded background
                count_text = f"{v_type}s: {count}"
                (text_width, text_height), _ = cv2.getTextSize(count_text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
                
                # Draw colored background for each vehicle type
                cv2.rectangle(overlay, (width - stats_width, y_pos - 20), 
                             (width - stats_width + text_width, y_pos + 5), type_color, -1)
                
                # Draw text with adaptive color
                cv2.putText(
                    overlay,
                    count_text,
                    (width - stats_width, y_pos),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    text_color,
                    2
                )
                y_pos += 30
        
        y_pos += 10  # Add some space before counting stats
        
        # Draw up/down counting statistics
        cv2.putText(
            overlay,
            "Vehicle Counting",
            (width - stats_width, y_pos),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            COLORS["header"],
            2
        )
        y_pos += 30
        
        # Draw total up count
        cv2.putText(
            overlay,
            f"▲ Total Up: {total_up}",
            (width - stats_width, y_pos),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            COLORS["up_count"],
            2
        )
        y_pos += 30
        
        # Draw total down count
        cv2.putText(
            overlay,
            f"▼ Total Down: {total_down}",
            (width - stats_width, y_pos),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            COLORS["down_count"],
            2
        )
    
    # Add inference time
    if 'inference_time' in data:
        cv2.putText(
            overlay,
            f"Vehicle Detection: {data['inference_time']:.1f}ms",
            (width - 300, 60),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            COLORS["vehicles"],
            2
        )
    
    return overlay

def display_updater():
    """Thread function to continuously update the preview window"""
    global running, latest_frame, latest_traffic_sign_data, latest_vehicle_data
    global frame_timestamp, traffic_sign_timestamp, vehicle_timestamp
    
    print("Starting display updater thread")
    
    # Delay the window creation to avoid GUI issues at startup
    time.sleep(WINDOW_INIT_DELAY)
    
    try:
        # Create a black canvas for initial display
        blank_frame = np.zeros((WINDOW_HEIGHT, WINDOW_WIDTH, 3), dtype=np.uint8)
        
        # Initialize the window
        cv2.namedWindow(PREVIEW_WINDOW_NAME, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(PREVIEW_WINDOW_NAME, WINDOW_WIDTH, WINDOW_HEIGHT)
        
        # Variables for FPS control
        last_update_time = 0
        update_interval = 1.0 / PREVIEW_FPS
        
        # Track FPS
        frame_count = 0
        fps_timer = time.time()
        fps = 0
        
        while running:
            current_time = time.time()
            
            # Update display at regular intervals to maintain target FPS
            if current_time - last_update_time >= update_interval:
                last_update_time = current_time
                
                try:
                    # Get latest frame - always display the most recent
                    got_new_frame = False
                    while not frame_queue.empty():
                        frame, timestamp = frame_queue.get_nowait()
                        if frame is not None:
                            latest_frame = frame.copy()
                            frame_timestamp = timestamp
                            got_new_frame = True
                    
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
                            COLORS["header"],
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
                            COLORS["header"],
                            2
                        )
                        
                        # Apply traffic sign detection overlay if available
                        if latest_traffic_sign_data:
                            display_img = draw_traffic_sign_overlay(display_img, latest_traffic_sign_data)
                        
                        # Apply vehicle detection overlay if available
                        if latest_vehicle_data:
                            display_img = draw_vehicle_overlay(display_img, latest_vehicle_data)
                        
                        # Add combined detection status
                        status_text = "Detection Status: "
                        if latest_traffic_sign_data and latest_vehicle_data:
                            status_text += "Traffic Signs + Vehicles"
                            status_color = (0, 255, 0)  # Green for both active
                        elif latest_traffic_sign_data:
                            status_text += "Traffic Signs Only"
                            status_color = (0, 255, 255)  # Yellow for signs only
                        elif latest_vehicle_data:
                            status_text += "Vehicles Only"
                            status_color = (0, 165, 255)  # Orange for vehicles only
                        else:
                            status_text += "Waiting for Detection Data..."
                            status_color = (0, 0, 255)  # Red for waiting
                        
                        cv2.putText(
                            display_img,
                            status_text,
                            (10, display_img.shape[0] - 20),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.7,
                            status_color,
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
                            cv2.resizeWindow(PREVIEW_WINDOW_NAME, WINDOW_WIDTH, WINDOW_HEIGHT)
                    except:
                        cv2.namedWindow(PREVIEW_WINDOW_NAME, cv2.WINDOW_NORMAL)
                        cv2.resizeWindow(PREVIEW_WINDOW_NAME, WINDOW_WIDTH, WINDOW_HEIGHT)
                    
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
                    if key == 27 or key == ord('q'):  # ESC or 'q' key
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

# Socket.IO event handlers
@sio.event
def connect():
    global connected
    connected = True
    print(f"Successfully connected to Socket.IO server: {SOCKETIO_SERVER_URL}")
    print("Waiting for 'image', 'dentinhieu', and 'giaothong' events...")

@sio.event
def connect_error(error):
    print(f"Connection error: {error}")

@sio.event
def disconnect():
    global connected
    connected = False
    print("Disconnected from Socket.IO server")
    print("Will attempt to reconnect automatically...")

# Function to handle connection management
def maintain_connection():
    global connected, running
    
    while running:
        try:
            if not connected:
                try:
                    print(f"Attempting to connect to Socket.IO server at {SOCKETIO_SERVER_URL}...")
                    sio.connect(SOCKETIO_SERVER_URL, transports=['websocket'])
                except Exception as e:
                    print(f"Failed to connect: {e}")
                    time.sleep(5)  # Wait before retry
            time.sleep(1)  # Check connection status periodically
        except Exception as e:
            print(f"Connection manager error: {e}")
            time.sleep(1)

# Socket.IO message handlers
@sio.on('image')
def on_image(data):
    global latest_frame, frame_timestamp
    
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
        max_dimension = 1280  # Maximum dimension for display
        if width > max_dimension or height > max_dimension:
            scale = max_dimension / max(width, height)
            frame = cv2.resize(frame, (int(width * scale), int(height * scale)))
        
        # Add frame to display queue
        try:
            frame_queue.put((frame.copy(), time.time()), block=False)
        except queue.Full:
            # Get and discard old frame, then add new frame
            try:
                frame_queue.get(block=False)
                frame_queue.put((frame.copy(), time.time()), block=False)
            except Exception as e:
                print(f"Error managing frame queue: {e}")
    
    except Exception as e:
        print(f"Error processing image: {e}")

@sio.on('dentinhieu')
def on_traffic_sign_detection(data):
    global latest_traffic_sign_data, traffic_sign_timestamp
    
    try:
        # Store the traffic sign detection data
        latest_traffic_sign_data = data
        traffic_sign_timestamp = time.time()
        
        # Print a summary of detected traffic signs
        if 'detections' in data:
            num_signs = len(data['detections'])
            if num_signs > 0:
                print(f"Received traffic sign data: {num_signs} signs detected")
                if 'sign_counts' in data:
                    count_summary = ", ".join([f"{count} {sign_type}" 
                                             for sign_type, count in data['sign_counts'].items()])
                    print(f"Sign counts: {count_summary}")
    except Exception as e:
        print(f"Error processing traffic sign detection data: {e}")

@sio.on('giaothong')
def on_vehicle_detection(data):
    global latest_vehicle_data, vehicle_timestamp
    
    try:
        # Store the vehicle detection data
        latest_vehicle_data = data
        vehicle_timestamp = time.time()
        
        # Print a summary of detected vehicles
        if 'detections' in data:
            num_vehicles = len(data['detections'])
            if num_vehicles > 0:
                print(f"Received vehicle data: {num_vehicles} vehicles detected")
                
                # Print vehicle counting information if available
                if 'vehicle_count' in data:
                    vehicle_count = data['vehicle_count']
                    print(f"Vehicle counts - Up: {vehicle_count.get('total_up', 0)}, Down: {vehicle_count.get('total_down', 0)}")
                    
                    # Print current vehicle counts by type
                    current_counts = vehicle_count.get('current', {})
                    if current_counts:
                        count_summary = ", ".join([f"{count} {v_type}{('s' if count != 1 else '')}" 
                                                for v_type, count in current_counts.items() if count > 0])
                        print(f"Current vehicles: {count_summary}")
    except Exception as e:
        print(f"Error processing vehicle detection data: {e}")

def main():
    global running
    
    # Start connection manager thread
    connection_thread = threading.Thread(target=maintain_connection, daemon=True)
    connection_thread.start()
    print("Connection manager started")
    
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
        display_thread.join(timeout=2)
        
        print("Preview application stopped.")

if __name__ == "__main__":
    main()
