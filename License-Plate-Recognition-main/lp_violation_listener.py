import socketio
import cv2
import numpy as np
from PIL import Image
import io
import re
import torch

# --- CONFIG ---
SOCKETIO_SERVER_URL = 'ws://localhost:3001'  # Sửa lại nếu cần
YOLO_LP_DETECTOR_PATH = './model/LP_detector.pt'
YOLO_LP_OCR_PATH = './model/LP_ocr.pt'

# --- Biển số Việt Nam regex (cơ bản, có thể mở rộng) ---
VN_LP_REGEX = r"^(\d{2}[A-Z]-?\d{3,4}\.?\d{2,3})$"

def is_vn_license_plate(text):
    text = text.replace(" ", "").replace("-", "-").replace(".", ".")
    return re.match(VN_LP_REGEX, text)

# --- Model load ---
yolo_LP_detect = torch.hub.load('yolov5', 'custom', path=YOLO_LP_DETECTOR_PATH, force_reload=True, source='local')
yolo_license_plate = torch.hub.load('yolov5', 'custom', path=YOLO_LP_OCR_PATH, force_reload=True, source='local')
yolo_license_plate.conf = 0.60

# --- SocketIO client ---
sio = socketio.Client()

@sio.on('violation_detect')
def on_violation_detect(data):
    print("[violation_detect] event received")
    buffer = data.get('buffer')
    detections = data.get('detections', [])
    if not buffer or not detections:
        print("No image or detections in event")
        return
    image = Image.open(io.BytesIO(buffer))
    frame = np.array(image)
    if frame.shape[-1] == 4:
        frame = cv2.cvtColor(frame, cv2.COLOR_RGBA2BGR)
    elif frame.shape[-1] == 3:
        frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
    height, width = frame.shape[:2]
    for det in detections:
        bbox = det.get('bbox')
        if not bbox or len(bbox) != 4:
            continue
        x1, y1, x2, y2 = bbox
        # Nếu bbox là tỷ lệ, chuyển sang pixel
        if x1 < 1 and x2 <= 1 and y1 < 1 and y2 <= 1:
            x1 = int(x1 * width)
            x2 = int(x2 * width)
            y1 = int(y1 * height)
            y2 = int(y2 * height)
        else:
            x1, y1, x2, y2 = map(int, [x1, y1, x2, y2])
        crop_img = frame[y1:y2, x1:x2]
        # Nhận diện biển số
        lp_result = yolo_license_plate(crop_img, size=320)
        lp_list = lp_result.pandas().xyxy[0].values.tolist()
        for lp in lp_list:
            lp_text = lp[6] if len(lp) > 6 else ''
            if lp_text and is_vn_license_plate(lp_text):
                print(f"Biển số hợp lệ: {lp_text}")

if __name__ == "__main__":
    print(f"Connecting to {SOCKETIO_SERVER_URL} ...")
    sio.connect(SOCKETIO_SERVER_URL, transports=['websocket'])
    sio.wait()
