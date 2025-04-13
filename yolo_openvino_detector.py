import cv2
import numpy as np
import time
from openvino.runtime import Core
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("YOLOv11_OpenVINO")

class YOLOOpenVINODetector:
    def __init__(self, model_path, device="GPU", conf_threshold=0.5, nms_threshold=0.45):
        self.conf_threshold = conf_threshold
        self.nms_threshold = nms_threshold
        
        # Initialize OpenVINO runtime
        self.core = Core()
        self.available_devices = self.core.available_devices
        logger.info(f"Available OpenVINO devices: {self.available_devices}")
        
        # Choose GPU if available or fall back to CPU
        self.device = device if device in self.available_devices else "CPU"
        logger.info(f"Using OpenVINO device: {self.device}")
        
        # Load the model
        logger.info(f"Loading model from: {model_path}")
        self._load_model(model_path)
        
        # FPS calculation variables
        self.frame_count = 0
        self.fps = 0
        self.fps_start_time = time.time()
    
    def _load_model(self, model_path):
        try:
            # Read and compile the model
            model = self.core.read_model(model_path)
            self.compiled_model = self.core.compile_model(model=model, device_name=self.device)
            
            # Get input and output info
            self.input_layer = self.compiled_model.input(0)
            self.input_shape = self.input_layer.shape
            self.output_layer = self.compiled_model.output(0)
            
            # Get model dimensions
            self.height, self.width = self.input_shape[2], self.input_shape[3]
            logger.info(f"Model loaded successfully. Input shape: {self.input_shape}")
            
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            raise
    
    def preprocess_image(self, frame):
        """Preprocess image for OpenVINO inference"""
        # Resize to model input dimensions
        resized = cv2.resize(frame, (self.width, self.height))
        
        # Normalize pixel values to 0-1
        normalized = resized / 255.0
        
        # Convert from HWC to NCHW format (batch, channels, height, width)
        input_tensor = np.expand_dims(normalized.transpose(2, 0, 1), 0)
        
        return input_tensor.astype(np.float32)
    
    def postprocess_detections(self, detections, frame_shape):
        """Process model output to get bounding boxes, classes and scores"""
        orig_h, orig_w = frame_shape[:2]
        boxes = []
        scores = []
        class_ids = []
        
        detection_format = None
        # Determine the output format
        if len(detections.shape) == 3 and detections.shape[2] == 7:
            # Format 1: OpenVINO standard detection output [batch, num_boxes, 7]
            # Each detection: [image_id, class_id, confidence, x_min, y_min, x_max, y_max]
            detection_format = "standard"
            
            for detection in detections[0]:
                confidence = float(detection[2])
                
                if confidence >= self.conf_threshold:
                    class_id = int(detection[1])
                    
                    # Coordinates are normalized [0-1]
                    xmin = int(detection[3] * orig_w)
                    ymin = int(detection[4] * orig_h)
                    xmax = int(detection[5] * orig_w)
                    ymax = int(detection[6] * orig_h)
                    
                    boxes.append([xmin, ymin, xmax, ymax])
                    scores.append(confidence)
                    class_ids.append(class_id)
        
        elif len(detections.shape) == 2 or (len(detections.shape) == 3 and detections.shape[0] == 1):
            # Format 2: Raw YOLO output 
            # Handle YOLOv8 style output
            detection_format = "yolov8"
            
            if len(detections.shape) == 3:
                detections = detections[0]  # Remove batch dimension
            
            # YOLOv8 format [num_boxes, 4+1+num_classes]
            # Each row: [x, y, w, h, obj_score, class_scores...]
            
            for detection in detections:
                # First 4 elements are box coordinates
                if detection[4] < self.conf_threshold:
                    continue
                    
                # Find best class
                class_scores = detection[5:]
                class_id = np.argmax(class_scores)
                confidence = float(class_scores[class_id] * detection[4])  # class_conf * obj_conf
                
                if confidence < self.conf_threshold:
                    continue
                
                # The coordinates might be either:
                # 1. [x_center, y_center, width, height] normalized to 0-1
                # 2. [x1, y1, x2, y2] normalized to 0-1
                # Let's assume they are centered (most common in YOLO)
                
                x, y, w, h = detection[0:4]
                
                # Check if normalized
                if max(x, y, w, h) <= 1:
                    # Convert normalized to pixel coordinates
                    x_center = x * orig_w
                    y_center = y * orig_h
                    width = w * orig_w
                    height = h * orig_h
                else:
                    # Already in pixel coordinates
                    x_center = x
                    y_center = y
                    width = w
                    height = h
                
                # Calculate box corners
                xmin = int(x_center - width / 2)
                ymin = int(y_center - height / 2)
                xmax = int(x_center + width / 2)
                ymax = int(y_center + height / 2)
                
                # Clip to image boundaries
                xmin = max(0, min(xmin, orig_w - 1))
                ymin = max(0, min(ymin, orig_h - 1))
                xmax = max(xmin + 1, min(xmax, orig_w))
                ymax = max(ymin + 1, min(ymax, orig_h))
                
                boxes.append([xmin, ymin, xmax, ymax])
                scores.append(confidence)
                class_ids.append(class_id)
        
        else:
            logger.error(f"Unsupported output format: {detections.shape}")
            return [], [], []
            
        logger.debug(f"Detected {len(boxes)} objects using {detection_format} format")
        
        # Apply NMS to remove overlapping boxes
        if boxes:
            indices = cv2.dnn.NMSBoxes(boxes, scores, self.conf_threshold, self.nms_threshold)
            result_boxes, result_scores, result_class_ids = [], [], []
            
            for idx in indices:
                if isinstance(idx, (list, tuple)):  # OpenCV < 4.5.4
                    idx = idx[0]
                
                result_boxes.append(boxes[idx])
                result_scores.append(scores[idx])
                result_class_ids.append(class_ids[idx])
                
            return result_boxes, result_scores, result_class_ids
        
        return [], [], []
    
    def process_frame(self, frame):
        """Process a single frame and return the result with detections"""
        if frame is None:
            return None
            
        # Update FPS counter
        self.frame_count += 1
        current_time = time.time()
        if current_time - self.fps_start_time >= 1:
            self.fps = self.frame_count
            self.frame_count = 0
            self.fps_start_time = current_time
            
        # Preprocess
        input_tensor = self.preprocess_image(frame)
        
        # Inference
        start_time = time.time()
        results = self.compiled_model([input_tensor])[self.output_layer]
        inference_time = (time.time() - start_time) * 1000  # ms
        
        # Debug information
        logger.debug(f"Output shape: {results.shape}")
        
        # Postprocess
        boxes, scores, class_ids = self.postprocess_detections(results, frame.shape)
        
        # Draw results on the frame
        result_frame = frame.copy()
        self._draw_detections(result_frame, boxes, scores, class_ids)
        
        # Add performance info
        cv2.putText(result_frame, f"FPS: {self.fps} | {self.device}", 
                   (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        cv2.putText(result_frame, f"Inference: {inference_time:.1f}ms", 
                   (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                   
        return result_frame
    
    def _draw_detections(self, frame, boxes, scores, class_ids):
        """Draw bounding boxes, class names and confidence scores"""
        # Define class names and colors (replace with your actual class names)
        class_names = [f"Class {i}" for i in range(1000)]
        # Generate distinct colors for each class
        np.random.seed(42)  # For reproducible colors
        colors = np.random.randint(0, 255, size=(1000, 3)).tolist()
        
        for i, box in enumerate(boxes):
            # Only draw boxes with confidence above threshold
            if scores[i] >= self.conf_threshold:
                x1, y1, x2, y2 = box
                class_id = class_ids[i]
                color = colors[class_id % len(colors)]
                
                # Draw bounding box
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                
                # Prepare label with class name and score
                class_name = class_names[class_id] if class_id < len(class_names) else f"Class {class_id}"
                label = f"{class_name}: {scores[i]:.2f}"
                
                # Calculate label size for background
                text_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                
                # Draw label background
                cv2.rectangle(frame, (x1, y1 - text_size[1] - 10), 
                             (x1 + text_size[0], y1), color, cv2.FILLED)
                
                # Draw label text
                cv2.putText(frame, label, (x1, y1 - 5), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
    
    def run_webcam(self, cam_index=0):
        """Run detection on webcam feed"""
        # Initialize webcam
        cap = cv2.VideoCapture(cam_index)
        if not cap.isOpened():
            logger.error("Could not open webcam")
            return
        
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    logger.error("Failed to grab frame")
                    break
                
                # Process the frame
                result_frame = self.process_frame(frame)
                
                # Display result
                cv2.imshow("YOLOv11 OpenVINO Detection", result_frame)
                
                # Exit on 'q' press
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
        
        finally:
            cap.release()
            cv2.destroyAllWindows()
            logger.info("Webcam detection stopped")


if __name__ == "__main__":
    # Path to your OpenVINO IR model (.xml file)
    model_path = "/home/tranv/Workspace/mh-iot-new/models/yolov11_openvino_model/model.xml"
    
    # Create and run detector
    detector = YOLOOpenVINODetector(
        model_path=model_path,
        device="GPU",  # Will fall back to CPU if GPU not available
        conf_threshold=0.5,
        nms_threshold=0.45
    )
    
    # Start webcam detection
    detector.run_webcam(cam_index=0)  # Usually 0 is the default webcam
