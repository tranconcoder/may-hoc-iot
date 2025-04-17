from PIL import Image
import cv2
import torch
import math 
import function.utils_rotate as utils_rotate
from IPython.display import display
import os
import function.helper as helper

# load yolo model for detect and character detection stage
# please download yolov5 from our link on github
import os

# Get the absolute path to the model files
model_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'model')
detector_path = os.path.join(model_dir, 'LP_detector.pt')
ocr_path = os.path.join(model_dir, 'LP_ocr.pt')

yolo_LP_detect = torch.hub.load('yolov5', 'custom', path=detector_path, force_reload=True, source='local')
yolo_license_plate = torch.hub.load('yolov5', 'custom', path=ocr_path, force_reload=True, source='local')

# set model confidence threshold 
# yolo_LP_detect.conf = 0.6
yolo_license_plate.conf = 0.60


#enter image path here
# Use absolute path to ensure the image is found
img_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_image/119.jpg")
print(f"Attempting to read image from: {img_file}")
img = cv2.imread(img_file)
if img is None:
    print(f"Error: Could not read image from {img_file}. Check if file exists and is not corrupted.")
    exit(1)
plates = yolo_LP_detect(img, size=640)


list_plates = plates.pandas().xyxy[0].values.tolist()
list_read_plates = set()
count = 0
if len(list_plates) == 0:
    lp = helper.read_plate(yolo_license_plate,img)
    if lp != "unknown":
        list_read_plates.add(lp)
else:
    for plate in list_plates:
        flag = 0
        x = int(plate[0]) # xmin
        y = int(plate[1]) # ymin
        w = int(plate[2] - plate[0]) # xmax - xmin
        h = int(plate[3] - plate[1]) # ymax - ymin  
        crop_img = img[y:y+h, x:x+w]
        cv2.rectangle(img, (int(plate[0]),int(plate[1])), (int(plate[2]),int(plate[3])), color = (0,0,225), thickness = 2)
        cv2.imwrite("crop.jpg", crop_img)
        rc_image = cv2.imread("crop.jpg")
        lp = ""
        count+=1
        for cc in range(0,2):
            for ct in range(0,2):
                lp = helper.read_plate(yolo_license_plate, utils_rotate.deskew(crop_img, cc, ct))
                if lp != "unknown":
                    list_read_plates.add(lp)
                    flag = 1
                    break
            if flag == 1:
                break


print(list_read_plates)
img = Image.open(img_file)
basewidth = 500
wpercent = (basewidth/float(img.size[0]))
hsize = int((float(img.size[1])*float(wpercent)))
# ANTIALIAS is deprecated, use Resampling.LANCZOS instead
try:
    # For newer Pillow versions (9.0.0+)
    from PIL import Image
    img = img.resize((basewidth,hsize), Image.Resampling.LANCZOS)
except AttributeError:
    # For older Pillow versions
    img = img.resize((basewidth,hsize), Image.LANCZOS)
display(img)