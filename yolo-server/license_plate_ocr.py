#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# License Plate Recognition Consolidated Script

from PIL import Image
import cv2
import torch
import math
import numpy as np
import os
import io
import socketio
import time
import threading
import queue

# --------- GLOBAL CONSTANTS ---------
# Get the absolute path to the model files
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models')
DETECTOR_PATH = os.path.join(MODEL_DIR, 'LP_detector.pt')
OCR_PATH = os.path.join(MODEL_DIR, 'LP_ocr.pt')
CONFIDENCE_THRESHOLD = 0.30  # Model confidence threshold

# Socket.IO configuration
SOCKETIO_SERVER_URL = 'http://172.28.31.150:3001'  # Same server as in server.py
MAX_FPS = 20  # Maximum frames per second to process

# Initialize Socket.IO client
sio = socketio.Client(reconnection=True, reconnection_attempts=0, reconnection_delay=1, reconnection_delay_max=5000)
print(f"Initializing Socket.IO client to connect to {SOCKETIO_SERVER_URL}")

# Global variables
running = True
last_processing_time = 0
plate_queue = queue.Queue(maxsize=5)  # Queue for license plate processing

# --------- UTILITY FUNCTIONS (from utils_rotate.py) ---------

def changeContrast(img):
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l_channel, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
    cl = clahe.apply(l_channel)
    limg = cv2.merge((cl,a,b))
    enhanced_img = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
    return enhanced_img

def rotate_image(image, angle):
    image_center = tuple(np.array(image.shape[1::-1]) / 2)
    rot_mat = cv2.getRotationMatrix2D(image_center, angle, 1.0)
    result = cv2.warpAffine(image, rot_mat, image.shape[1::-1], flags=cv2.INTER_LINEAR)
    return result

def compute_skew(src_img, center_thres):
    if len(src_img.shape) == 3:
        h, w, _ = src_img.shape
    elif len(src_img.shape) == 2:
        h, w = src_img.shape
    else:
        print('upsupported image type')
    img = cv2.medianBlur(src_img, 3)
    edges = cv2.Canny(img,  threshold1 = 30,  threshold2 = 100, apertureSize = 3, L2gradient = True)
    lines = cv2.HoughLinesP(edges, 1, math.pi/180, 30, minLineLength=w / 1.5, maxLineGap=h/3.0)
    if lines is None:
        return 1

    min_line = 100
    min_line_pos = 0
    for i in range (len(lines)):
        for x1, y1, x2, y2 in lines[i]:
            center_point = [((x1+x2)/2), ((y1+y2)/2)]
            if center_thres == 1:
                if center_point[1] < 7:
                    continue
            if center_point[1] < min_line:
                min_line = center_point[1]
                min_line_pos = i

    angle = 0.0
    nlines = lines.size
    cnt = 0
    for x1, y1, x2, y2 in lines[min_line_pos]:
        ang = np.arctan2(y2 - y1, x2 - x1)
        if math.fabs(ang) <= 30: # excluding extreme rotations
            angle += ang
            cnt += 1
    if cnt == 0:
        return 0.0
    return (angle / cnt)*180/math.pi

def deskew(src_img, change_cons, center_thres):
    if change_cons == 1:
        return rotate_image(src_img, compute_skew(changeContrast(src_img), center_thres))
    else:
        return rotate_image(src_img, compute_skew(src_img, center_thres))

# --------- HELPER FUNCTIONS (from helper.py) ---------

def linear_equation(x1, y1, x2, y2):
    b = y1 - (y2 - y1) * x1 / (x2 - x1)
    a = (y1 - b) / x1
    return a, b

def check_point_linear(x, y, x1, y1, x2, y2):
    a, b = linear_equation(x1, y1, x2, y2)
    y_pred = a*x+b
    return(math.isclose(y_pred, y, abs_tol = 3))

# detect character and number in license plate
def read_plate(yolo_license_plate, im):
    LP_type = "1"
    results = yolo_license_plate(im)
    bb_list = results.pandas().xyxy[0].values.tolist()
    if len(bb_list) == 0 or len(bb_list) < 7 or len(bb_list) > 10:
        return "unknown"
    center_list = []
    y_mean = 0
    y_sum = 0
    for bb in bb_list:
        x_c = (bb[0]+bb[2])/2
        y_c = (bb[1]+bb[3])/2
        y_sum += y_c
        center_list.append([x_c,y_c,bb[-1]])

    # find 2 point to draw line
    l_point = center_list[0]
    r_point = center_list[0]
    for cp in center_list:
        if cp[0] < l_point[0]:
            l_point = cp
        if cp[0] > r_point[0]:
            r_point = cp
    for ct in center_list:
        if l_point[0] != r_point[0]:
            if (check_point_linear(ct[0], ct[1], l_point[0], l_point[1], r_point[0], r_point[1]) == False):
                LP_type = "2"

    y_mean = int(int(y_sum) / len(bb_list))
    size = results.pandas().s

    # 1 line plates and 2 line plates
    line_1 = []
    line_2 = []
    license_plate = ""
    if LP_type == "2":
        for c in center_list:
            if int(c[1]) > y_mean:
                line_2.append(c)
            else:
                line_1.append(c)
        for l1 in sorted(line_1, key = lambda x: x[0]):
            license_plate += str(l1[2])
        license_plate += "-"
        for l2 in sorted(line_2, key = lambda x: x[0]):
            license_plate += str(l2[2])
    else:
        for l in sorted(center_list, key = lambda x: x[0]):
            license_plate += str(l[2])
    return license_plate

# --------- MAIN LICENSE PLATE RECOGNITION CODE (from ocr.py) ---------

def recognize_license_plate(image_path=None, image_array=None):
    """
    Recognize license plates from either an image path or image array
    Args:
        image_path: Path to the image file
        image_array: OpenCV image array (if image_path is None)
    
    Returns:
        A set of detected license plate numbers
    """
    # Temporarily redirect stdout to suppress YOLOv5 loading messages
    import sys
    import os
    original_stdout = sys.stdout
    sys.stdout = open(os.devnull, 'w')
    
    try:
        # Load YOLO models using the global constants with verbose=False
        yolo_LP_detect = torch.hub.load('yolov5', 'custom', path=DETECTOR_PATH, force_reload=True, source='local', verbose=False)
        yolo_license_plate = torch.hub.load('yolov5', 'custom', path=OCR_PATH, force_reload=True, source='local', verbose=False)
        
        # Set model confidence threshold
        yolo_license_plate.conf = CONFIDENCE_THRESHOLD
    finally:
        # Restore stdout
        sys.stdout.close()
        sys.stdout = original_stdout
    
    # Read the image
    if image_path is not None:
        print(f"Reading image from: {image_path}")
        img = cv2.imread(image_path)
        if img is None:
            print(f"Error: Could not read image from {image_path}. Check if file exists and is not corrupted.")
            return set()
    elif image_array is not None:
        img = image_array
    else:
        print("Error: Either image_path or image_array must be provided.")
        return set()
    
    # Detect license plates
    plates = yolo_LP_detect(img, size=640)
    
    # Process detection results
    list_plates = plates.pandas().xyxy[0].values.tolist()
    list_read_plates = set()
    
    if len(list_plates) == 0:
        # If no license plate detected, try to read directly from the image
        lp = read_plate(yolo_license_plate, img)
        if lp != "unknown":
            list_read_plates.add(lp)
    else:
        # Process each detected license plate
        for plate in list_plates:
            flag = 0
            x = int(plate[0])  # xmin
            y = int(plate[1])  # ymin
            w = int(plate[2] - plate[0])  # xmax - xmin
            h = int(plate[3] - plate[1])  # ymax - ymin  
            
            # Crop the license plate
            crop_img = img[y:y+h, x:x+w]
            
            # Draw rectangle around the license plate on the original image
            cv2.rectangle(img, (int(plate[0]), int(plate[1])), (int(plate[2]), int(plate[3])), color=(0, 0, 225), thickness=2)
            
            # Save the cropped image (for debugging)
            crop_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "crop.jpg")
            cv2.imwrite(crop_file, crop_img)
            
            # Read the license plate text
            for cc in range(0, 2):
                for ct in range(0, 2):
                    lp = read_plate(yolo_license_plate, deskew(crop_img, cc, ct))
                    if lp != "unknown":
                        list_read_plates.add(lp)
                        flag = 1
                        break
                if flag == 1:
                    break
    
    return list_read_plates, img

def display_image(img_file, img):
    """Display the image with the original size or resized"""
    try:
        # For PIL Image
        if isinstance(img, np.ndarray):
            # Convert OpenCV image to PIL Image
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(img_rgb)
        else:
            # If it's already a PIL Image, use it directly
            pil_img = img
            
        # Resize the image for display
        basewidth = 500
        wpercent = (basewidth/float(pil_img.size[0]))
        hsize = int((float(pil_img.size[1])*float(wpercent)))
        
        # Use appropriate resize method based on PIL version
        try:
            # For newer Pillow versions (9.0.0+)
            from PIL import Image
            pil_img = pil_img.resize((basewidth, hsize), Image.Resampling.LANCZOS)
        except AttributeError:
            # For older Pillow versions
            pil_img = pil_img.resize((basewidth, hsize), Image.LANCZOS)
            
        # Display the image
        try:
            from IPython.display import display
            display(pil_img)
        except ImportError:
            # If not in IPython environment, save the result
            pil_img.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), "result.jpg"))
            print("Saved result to 'result.jpg'")
            
        # Return the resized PIL image
        return pil_img
        
    except Exception as e:
        print(f"Error displaying image: {e}")
        return None

def detect_license_plate_from_car_event(vehicle_data):
    """
    Detect license plate from a vehicle image in a car event
    Args:
        vehicle_data: Dictionary containing vehicle information
    
    Returns:
        Updated vehicle_data with license plate information
    """
    try:
        # Convert image data to numpy array
        if 'image_data' in vehicle_data:
            image_bytes = vehicle_data['image_data']
            
            # Convert bytes to image
            try:
                # Open as PIL image first
                image = Image.open(io.BytesIO(image_bytes))
                # Convert PIL image to OpenCV format (RGB to BGR)
                frame = np.array(image)
                frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
            except Exception as e:
                print(f"Error decoding image: {e}")
                return vehicle_data
            
            # Detect license plates
            license_plates, _ = recognize_license_plate(image_array=frame)
            
            # Add license plate information to vehicle data
            if license_plates:
                vehicle_data['license_plate'] = list(license_plates)
                print(f"Detected license plate: {list(license_plates)}")
            else:
                vehicle_data['license_plate'] = ["UNKNOWN"]
                
    except Exception as e:
        print(f"Error detecting license plate: {e}")
        vehicle_data['license_plate'] = ["ERROR"]
        
    return vehicle_data

# --------- SOCKETIO EVENT HANDLERS AND PROCESSING ---------

@sio.event
def connect():
    """Handler for connection event"""
    print(f"Successfully connected to Socket.IO server: {SOCKETIO_SERVER_URL}")
    print("Waiting for 'license_plate' events with vehicle images...")

@sio.event
def disconnect():
    """Handler for disconnection event"""
    print("Disconnected from Socket.IO server")
    global running
    running = False

@sio.on('license_plate')
def on_license_plate(data):
    """
    Handler for receiving license plate detection events
    Args:
        data: Dictionary containing license plate data with image
    """
    global last_processing_time
    
    # Limit processing rate to avoid overload
    current_time = time.time()
    if current_time - last_processing_time < 1.0/MAX_FPS:
        return  # Skip this frame to maintain reasonable frame rate
    
    last_processing_time = current_time
    
    try:
        # Check if we have a valid license plate event with image data
        if not isinstance(data, dict):
            print("Warning: Received license_plate event with invalid data format")
            return
        
        # Add to processing queue
        try:
            plate_queue.put(data, block=False)
            print(f"Added license plate image to processing queue")
        except queue.Full:
            # If queue is full, just discard this data
            pass
    
    except Exception as e:
        print(f"Error handling license_plate event: {e}")

def process_license_plates_thread():
    """Background thread to process license plate images"""
    global running
    
    print("Starting license plate OCR thread")
    
    # Temporarily redirect stdout to suppress YOLOv5 loading messages
    import sys
    import os
    original_stdout = sys.stdout
    sys.stdout = open(os.devnull, 'w')
    
    try:
        # Load YOLO models for OCR with verbose=False
        yolo_LP_detect = torch.hub.load('yolov5', 'custom', path=DETECTOR_PATH, force_reload=True, source='local', verbose=False)
        yolo_license_plate = torch.hub.load('yolov5', 'custom', path=OCR_PATH, force_reload=True, source='local', verbose=False)
        
        # Set model confidence threshold
        yolo_license_plate.conf = CONFIDENCE_THRESHOLD
    finally:
        # Restore stdout
        sys.stdout.close()
        sys.stdout = original_stdout
    
    while running:
        try:
            # Try to get a plate event from the queue, non-blocking
            try:
                plate_data = plate_queue.get(block=False)
                if plate_data is None:
                    time.sleep(0.01)
                    continue
            except queue.Empty:
                time.sleep(0.01)
                continue
            
            # Extract data from the plate event
            vehicle_id = plate_data.get('vehicle_id', 'unknown')
            image_data = plate_data.get('image_data')
            original_data = plate_data  # Keep original data to include in response
            
            if not image_data:
                continue  # Skip if missing required data
            
            # Convert buffer to image
            try:
                # Convert bytes to numpy array
                nparr = np.frombuffer(image_data, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if img is None:
                    print(f"Error: Could not decode image for plate")
                    continue
            except Exception as e:
                print(f"Error decoding image: {e}")
                continue
            
            # Start timing for inference
            start_time = time.time()
            
            # Detect and recognize license plates
            license_plates, marked_img = recognize_license_plate(image_array=img)
            
            # Calculate inference time
            inference_time = (time.time() - start_time) * 1000  # ms
            
            # Prepare response with recognition results and include the original data
            response = {
                'vehicle_id': vehicle_id,
                'timestamp': time.time(),
                'inference_time': inference_time,
                'license_plates': list(license_plates) if license_plates else ["UNKNOWN"],
                'recognized_image': None,  # Will be populated below
                'original_data': original_data  # Include original data for reference
            }
            
            # Encode the marked image with license plate boxes
            if marked_img is not None:
                _, buffer = cv2.imencode('.jpg', marked_img)
                response['recognized_image'] = buffer.tobytes()
            
            # Emit license plate OCR results using 'license_plate_ocr' event
            sio.emit('license_plate_ocr', response)
            
            # Print detection summary with improved formatting
            if license_plates:
                plate_text = ", ".join(license_plates)
                print(f"\n{'='*60}")
                print(f"✅ BIỂN SỐ XE NHẬN DIỆN THÀNH CÔNG")
                print(f"{'='*60}")
                print(f"🚗 Vehicle ID: {vehicle_id}")
                print(f"🔢 License Plate: {plate_text}")
                print(f"⏱️ Thời gian xử lý: {inference_time:.2f}ms")
                print(f"🕒 Thời gian: {time.strftime('%H:%M:%S %d-%m-%Y', time.localtime())}")
                print(f"{'='*60}")
            else:
                print(f"\n{'='*60}")
                print(f"❌ KHÔNG THỂ NHẬN DIỆN BIỂN SỐ XE")
                print(f"{'='*60}")
                print(f"🚗 Vehicle ID: {vehicle_id}")
                print(f"⏱️ Thời gian xử lý: {inference_time:.2f}ms")
                print(f"🕒 Thời gian: {time.strftime('%H:%M:%S %d-%m-%Y', time.localtime())}")
                print(f"{'='*60}")
            
            print(f"📤 Đã gửi dữ liệu qua event 'license_plate_ocr'")
            
        except Exception as e:
            print(f"Error in license plate OCR thread: {e}")
            time.sleep(0.1)  # Prevent tight loop if there's an error
    
    print("License plate OCR thread stopped")

# --------- MAIN FUNCTION (Entry Point) ---------

def main():
    """Main function for running the script directly"""
    global running
    
    import sys
    
    # Check for command-line arguments to run in traditional mode (single image)
    if len(sys.argv) > 1 and sys.argv[1] == '--image':
        if len(sys.argv) > 2:
            img_file = sys.argv[2]
        else:
            # Default image path
            img_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_image/119.jpg")
        
        # Recognize license plates
        license_plates, img = recognize_license_plate(image_path=img_file)
        
        # Print the results
        print(license_plates)
        
        # Display the image
        display_image(img_file, img)
    else:
        # Run in SocketIO mode
        print("Starting license plate OCR service with SocketIO...")
        
        # Start the processing thread
        processing_thread = threading.Thread(target=process_license_plates_thread, daemon=True)
        processing_thread.start()
        print("License plate OCR thread started")
        
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
            print("License plate OCR service stopped.")

if __name__ == "__main__":
    main()
