#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# License Plate Recognition Simplified Script

from PIL import Image
import cv2
import torch
import math
import numpy as np
import os
import io
import sys

# --------- GLOBAL CONSTANTS ---------
# Get the absolute path to the model files
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'model')
DETECTOR_PATH = os.path.join(MODEL_DIR, 'LP_detector.pt')
OCR_PATH = os.path.join(MODEL_DIR, 'LP_ocr.pt')
CONFIDENCE_THRESHOLD = 0.60  # Model confidence threshold

# --------- UTILITY FUNCTIONS ---------

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

# --------- MAIN LICENSE PLATE RECOGNITION CODE ---------

def load_models():
    """Load YOLO models only once"""
    print("Loading models...")
    
    # Disable autoinstall by setting environment variables
    os.environ["YOLOv5_AUTOINSTALL"] = "false"
    
    # Load models
    yolo_LP_detect = torch.hub.load('yolov5', 'custom', path=DETECTOR_PATH, force_reload=True, source='local')
    yolo_license_plate = torch.hub.load('yolov5', 'custom', path=OCR_PATH, force_reload=True, source='local')
    
    # Set model confidence threshold
    yolo_license_plate.conf = CONFIDENCE_THRESHOLD
    
    print("Models loaded successfully")
    return yolo_LP_detect, yolo_license_plate

# Global model variables
yolo_LP_detect = None
yolo_license_plate = None

def recognize_license_plate(image_path=None, image_array=None):
    """
    Recognize license plates from either an image path or image array
    Args:
        image_path: Path to the image file
        image_array: OpenCV image array (if image_path is None)
    
    Returns:
        A set of detected license plate numbers and the image with detections
    """
    global yolo_LP_detect, yolo_license_plate
    
    # Load models if not already loaded
    if yolo_LP_detect is None or yolo_license_plate is None:
        yolo_LP_detect, yolo_license_plate = load_models()
    
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
        return set(), None
    
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
            
            # Save the cropped image (optional, for debugging)
            # crop_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "crop.jpg")
            # cv2.imwrite(crop_file, crop_img)
            
            # Read the license plate text
            for cc in range(0, 2):
                for ct in range(0, 2):
                    try:
                        lp = read_plate(yolo_license_plate, deskew(crop_img, cc, ct))
                        if lp != "unknown":
                            list_read_plates.add(lp)
                            flag = 1
                            break
                    except Exception as e:
                        print(f"Error processing plate: {e}")
                if flag == 1:
                    break
    
    return list_read_plates, img

def process_violation_event(data):
    """
    Process a violation event by detecting license plates from vehicle detections
    Args:
        data: Dictionary containing event data with buffer and detections
    """
    if not isinstance(data, dict):
        print("Invalid data format - expected dictionary")
        return
    
    # Get image data and detections
    buffer = data.get('buffer')
    detections = data.get('detections', [])
    
    if not buffer or not detections:
        print("No image buffer or detections in event data")
        return
    
    try:
        # Convert image bytes to OpenCV image
        image = Image.open(io.BytesIO(buffer))
        frame = np.array(image)
        if frame.shape[-1] == 4:  # RGBA
            frame = cv2.cvtColor(frame, cv2.COLOR_RGBA2BGR)
        elif frame.shape[-1] == 3:  # RGB
            frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        
        # Process each detection
        height, width = frame.shape[:2]
        license_plates = []
        
        for det in detections:
            bbox = det.get('bbox')
            if not bbox or len(bbox) != 4:
                continue
                
            x1, y1, x2, y2 = bbox
            # Convert normalized coordinates to pixel coordinates if needed
            if x1 < 1 and x2 <= 1 and y1 < 1 and y2 <= 1:
                x1 = int(x1 * width)
                x2 = int(x2 * width)
                y1 = int(y1 * height)
                y2 = int(y2 * height)
            else:
                x1, y1, x2, y2 = map(int, [x1, y1, x2, y2])
                
            # Crop vehicle image
            crop_img = frame[y1:y2, x1:x2]
            
            # Detect license plate in the cropped image
            plates, _ = recognize_license_plate(image_array=crop_img)
            if plates:
                print(f"Detected license plate: {plates}")
                license_plates.extend(list(plates))
        
        # Return results
        return license_plates
    
    except Exception as e:
        print(f"Error processing violation event: {e}")
        import traceback
        traceback.print_exc()
        return []

# --------- SOCKETIO CLIENT FOR VIOLATION DETECTION ---------

def setup_socketio_client(server_url='ws://localhost:3001'):
    """Setup SocketIO client to listen for violation_detect events"""
    import socketio
    
    # Initialize SocketIO client
    sio = socketio.Client()
    
    @sio.on('connect')
    def on_connect():
        print(f"Connected to server: {server_url}")
        print("Waiting for 'violation_detect' events...")
    
    @sio.on('disconnect')
    def on_disconnect():
        print("Disconnected from server")
    
    @sio.on('violation_detect')
    def on_violation_detect(data):
        print("[violation_detect] event received")
        license_plates = process_violation_event(data)
        
        if license_plates:
            for lp in license_plates:
                print(f"Biển số hợp lệ: {lp}")
    
    # Connect to server
    try:
        print(f"Connecting to {server_url}...")
        sio.connect(server_url, transports=['websocket'])
        return sio
    except Exception as e:
        print(f"Error connecting to server: {e}")
        return None

# --------- MAIN FUNCTION ---------

def main():
    """Main function for running the script directly"""
    if len(sys.argv) > 1:
        if sys.argv[1] == "--server":
            # Run as socket.io client
            server_url = sys.argv[2] if len(sys.argv) > 2 else 'ws://localhost:3001'
            sio = setup_socketio_client(server_url)
            if sio:
                sio.wait()
        else:
            # Process a single image
            img_path = sys.argv[1]
            license_plates, img = recognize_license_plate(image_path=img_path)
            print(f"Detected license plates: {license_plates}")
    else:
        # Default to processing a test image
        print("Usage: python ocr_simplified.py [image_path | --server [server_url]]")
        print("Falling back to test image...")
        test_image = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_image/119.jpg")
        if os.path.exists(test_image):
            license_plates, img = recognize_license_plate(image_path=test_image)
            print(f"Detected license plates: {license_plates}")
        else:
            print(f"Test image not found at {test_image}")

if __name__ == "__main__":
    main()
