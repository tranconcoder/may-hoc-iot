import cv2
import time
import threading
import queue
import numpy as np
from ultralytics import YOLO
import copy # Import copy module

# --- Configuration ---
# Using YOLO11n model from Ultralytics for vehicle detection
MODEL_PATH = 'yolo11n.pt'  # Using your existing model
WEBCAM_INDEX = 0
CONFIDENCE_THRESHOLD = 0.4  # Slightly lower threshold for better detection
MAX_RESULT_QUEUE_SIZE = 5   # Keep result queue to decouple display
VEHICLE_CLASSES = ['car', 'truck', 'bus', 'motorcycle', 'bicycle']  # Vehicle classes in COCO dataset
ENABLE_TRACKING = True  # Enable object tracking functionality

# --- Global Variables ---
result_queue = queue.Queue(maxsize=MAX_RESULT_QUEUE_SIZE)
running = True # Flag to control threads
latest_frame = None # Shared variable for the latest frame
frame_lock = threading.Lock() # Lock to protect access to latest_frame

# --- Inference Thread ---
def inference_worker(model_path):
    global latest_frame, frame_lock # Access global variables
    print(f"Loading model: {model_path}")
    
    # Initialize the model for either detection or tracking
    if ENABLE_TRACKING:
        try:
            # For tracking, we need to install and import ByteTrack
            import sys
            import subprocess
            import pkg_resources
            
            # Check if bytetrack is installed
            required_packages = {"ultralytics[track]"}
            installed = {pkg.key for pkg in pkg_resources.working_set}
            missing = required_packages - installed
            
            if missing:
                print("Installing required packages for tracking...")
                subprocess.check_call([sys.executable, "-m", "pip", "install", "ultralytics[track]"])
                print("Tracking packages installed successfully!")
            
            print("Initializing model with tracking...")
            model = YOLO(model_path)
            print(f"Model loaded successfully with available classes: {model.names}")
            print("Tracking enabled - will use ByteTrack algorithm")
        except Exception as e:
            print(f"Warning: Could not initialize tracking due to: {e}")
            print("Falling back to detection only mode")
            model = YOLO(model_path)
    else:
        model = YOLO(model_path)
        print("Model loaded successfully for detection only.")
        print(f"Available classes: {model.names}")

    while running:
        current_frame_to_process = None
        # frame_capture_time = None # Keep track of the frame's capture time if needed

        # Safely get the latest frame
        with frame_lock:
            if latest_frame is not None:
                # Make a deep copy to process independently
                current_frame_to_process = copy.deepcopy(latest_frame)
                # Optionally get timestamp if stored with frame
                # current_frame_to_process, frame_capture_time = latest_frame

        if current_frame_to_process is not None:
            try:
                # Perform inference with or without tracking
                inf_start_time = time.time()
                if ENABLE_TRACKING:
                    # Use tracking mode
                    results = model.track(current_frame_to_process, verbose=False, persist=True, tracker="bytetrack.yaml")
                else:
                    # Use detection only mode
                    results = model(current_frame_to_process, verbose=False)
                
                inf_end_time = time.time()
                inference_time_ms = (inf_end_time - inf_start_time) * 1000

                # Put results into the result queue
                if not result_queue.full():
                    # Send results and inference time
                    result_queue.put((results, inference_time_ms))
                else:
                    # print("Warning: Result queue is full. Dropping inference result.")
                    # Clear one item to make space
                    try:
                        result_queue.get_nowait() # Remove oldest item
                        result_queue.put((results, inference_time_ms)) # Add newest item
                    except queue.Empty:
                        pass # Should not happen if full check passed, but safety first

            except Exception as e:
                print(f"Error in inference thread: {e}")
                time.sleep(0.5) # Avoid busy-looping on error
        else:
            # No frame available yet, wait a bit
            time.sleep(0.01) # Prevent busy-waiting

    print("Inference thread stopping.")

# --- Main Thread (Webcam Reading & Display) ---
def main():
    global running, latest_frame, frame_lock # Access global variables

    # Start the inference worker thread
    inference_thread = threading.Thread(target=inference_worker, args=(MODEL_PATH,), daemon=True)
    inference_thread.start()

    # Initialize webcam
    cap = cv2.VideoCapture(WEBCAM_INDEX)
    if not cap.isOpened():
        print(f"Error: Could not open webcam index {WEBCAM_INDEX}")
        running = False
        if inference_thread.is_alive():
             inference_thread.join()
        return

    print("Webcam opened successfully.")

    frame_count = 0
    fps_start_time = time.time()
    display_fps = 0

    # Store the latest available results and inference time from result_queue
    latest_results_data = None

    while True:
        # Read frame from webcam
        ret, frame = cap.read()
        current_frame_time = time.time()
        if not ret:
            print("Error: Cannot read frame from webcam. Exiting.")
            break

        # Update the latest frame shared variable
        with frame_lock:
            latest_frame = frame # Update shared frame (inference thread will copy)
            # Optionally store timestamp: latest_frame = (frame, current_frame_time)

        # Make a copy for drawing locally
        display_frame = frame.copy()

        # Try to get the latest processed results from the result queue (non-blocking)
        try:
            # Get results and inference time
            latest_results_data = result_queue.get_nowait()
        except queue.Empty:
            # No new results available yet, continue using the previous latest_results_data
            pass

        # Draw bounding boxes from the latest available results onto the current display_frame
        latest_inference_time_ms = 0 # Default
        if latest_results_data:
            results_from_queue, inference_time_from_queue = latest_results_data
            latest_inference_time_ms = inference_time_from_queue # Update inference time
            
            # Keep track of vehicles detected in this frame
            detected_vehicles_count = {vehicle_type: 0 for vehicle_type in VEHICLE_CLASSES}
            
            for result in results_from_queue:
                boxes = result.boxes
                for box in boxes:
                    confidence = box.conf[0]
                    cls = int(box.cls[0])
                    # Ensure class ID exists in model names before accessing
                    if cls in result.names:
                        class_name = result.names[cls]
                        # Check if the detected object is a vehicle
                        if class_name in VEHICLE_CLASSES and confidence >= CONFIDENCE_THRESHOLD:
                            x1, y1, x2, y2 = map(int, box.xyxy[0])
                            
                            # Use different colors for different vehicle types
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
                            
                            # Check if we have tracking info
                            track_id = None
                            if hasattr(box, 'id') and box.id is not None:
                                track_id = box.id.item()  # Get the tracking ID
                                label = f"{class_name} #{track_id}: {confidence:.2f}"
                            else:
                                # No tracking info available
                                label = f"{class_name}: {confidence:.2f}"
                            
                            # Draw bounding box on the display_frame
                            cv2.rectangle(display_frame, (x1, y1), (x2, y2), color, 2)
                            
                            # Draw label background on the display_frame
                            (w, h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
                            cv2.rectangle(display_frame, (x1, y1 - 20), (x1 + w, y1), color, -1)
                            cv2.putText(display_frame, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
                            
                            # For tracking visualization with trails (optional)
                            if track_id is not None:
                                center_x = int((x1 + x2) / 2)
                                center_y = int((y1 + y2) / 2)
                                # Draw a small circle at the center
                                cv2.circle(display_frame, (center_x, center_y), 5, color, -1)
                            
                            # Increment the counter for this vehicle type
                            detected_vehicles_count[class_name] += 1
            
            # Display vehicle counts in the top-right corner
            y_offset = 30
            for vehicle_type, count in detected_vehicles_count.items():
                if count > 0:  # Only show vehicle types that are detected
                    count_text = f"{vehicle_type}s: {count}"
                    # Right-align the text
                    text_size = cv2.getTextSize(count_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
                    x_position = display_frame.shape[1] - text_size[0] - 10
                    cv2.putText(display_frame, count_text, (x_position, y_offset), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                    y_offset += 25

        # Calculate FPS based on webcam read speed
        frame_count += 1
        if current_frame_time - fps_start_time >= 1.0:
            display_fps = frame_count / (current_frame_time - fps_start_time)
            frame_count = 0
            fps_start_time = current_frame_time

        # Display FPS and the latest Inference Time on the display_frame
        fps_text = f"FPS: {display_fps:.2f}"
        inf_text = f"Inference: {latest_inference_time_ms:.1f} ms"
        cv2.putText(display_frame, fps_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        cv2.putText(display_frame, inf_text, (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

        # Show the latest frame from the webcam with drawings from the latest results
        cv2.imshow('YOLO Webcam Detection', display_frame)

        # Exit on 'q' press
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("Exit key pressed.")
            break

    # Cleanup
    print("Cleaning up...")
    running = False # Signal inference thread to stop
    if inference_thread.is_alive():
        inference_thread.join(timeout=2) # Wait for thread to finish
    cap.release()
    cv2.destroyAllWindows()
    print("Cleanup complete.")

if __name__ == "__main__":
    main()
